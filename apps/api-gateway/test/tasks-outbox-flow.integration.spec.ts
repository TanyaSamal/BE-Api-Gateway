import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { RmqRecord } from '@nestjs/microservices';
import * as request from 'supertest';
import { TasksModule } from '../src/tasks/tasks.module';
import { OutboxProcessor } from '../src/tasks/infrastructure/cron/outbox.processor';
import { MASTER_DB_CONNECTION } from '../src/tasks/infrastructure/persistence/database.module';
import { InMemoryEventStore } from '../src/tasks/infrastructure/persistence/in-memory-event-store';
import { OutboxEvent } from '../src/tasks/domain/models/outbox-event.model';

interface QueuedMessage {
  pattern: string;
  record: RmqRecord<TrackActionPayload>;
}

interface TrackActionPayload {
  userId: string | number;
  eventName: string;
  properties: {
    userId: string;
    action: string;
    taskId: string;
  };
}

/**
 * Фейковая очередь RabbitMQ: заменяет ClientProxy 'ANALYTICS_SERVICE'
 * и запоминает все события, "отправленные" через emit().
 */
class FakeAnalyticsQueue {
  public readonly messages: QueuedMessage[] = [];

  emit(pattern: string, record: RmqRecord<TrackActionPayload>): void {
    this.messages.push({ pattern, record });
  }
}

/**
 * E2E: POST /tasks -> запись в Outbox (PENDING) -> OutboxProcessor -> очередь -> PROCESSED
 */
describe('Tasks -> Outbox -> Queue (E2E)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let masterDb: InMemoryEventStore;
  let processor: OutboxProcessor;
  const queue: FakeAnalyticsQueue = new FakeAnalyticsQueue();

  const httpServer = (): string => app.getHttpServer();

  /** Читаем всю outbox-таблицу (включая PROCESSED) для проверки итогового статуса. */
  const readOutboxTable = (): OutboxEvent[] =>
    (masterDb as unknown as { outboxTable: OutboxEvent[] }).outboxTable;

  /** Запускаем один тик фоновой задачи и ждём, пока она освободит isProcessing. */
  const runOutboxTick = async (): Promise<void> => {
    processor.handleOutboxPolling();
    const state = processor as unknown as { isProcessing: boolean };
    for (let i = 0; i < 100 && state.isProcessing; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
    expect(state.isProcessing).toBe(false);
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [TasksModule],
    })
      .overrideProvider('ANALYTICS_SERVICE')
      .useValue(queue)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    masterDb = moduleRef.get<InMemoryEventStore>(MASTER_DB_CONNECTION);
    processor = moduleRef.get<OutboxProcessor>(OutboxProcessor);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    queue.messages.length = 0;
  });

  it('создаёт задачу, кладёт событие в Outbox, процессор отправляет его в очередь и помечает PROCESSED', async () => {
    // Чистое состояние: ничего не ожидает отправки
    await runOutboxTick();
    queue.messages.length = 0;

    // 1. POST /tasks
    const response = await request(httpServer())
      .post('/tasks')
      .send({ title: 'E2E task', description: 'Outbox flow' })
      .expect(201);

    const body = response.body as { id: string };
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
    const taskId: string = body.id;

    // 2. Запись появилась в Outbox со статусом PENDING
    const pending = await masterDb.getPendingOutboxEvents();
    const outboxRecord = pending.find(
      (e) => (e.payload as { taskId: string }).taskId === taskId,
    );
    expect(outboxRecord).toBeDefined();
    expect(outboxRecord?.status).toBe('PENDING');
    expect(outboxRecord?.eventName).toBe('track_action');
    expect(outboxRecord?.payload).toMatchObject({
      taskId,
      action: 'TaskCreatedEvent',
    });

    // До запуска процессора в очередь ничего не попало
    expect(queue.messages).toHaveLength(0);

    // 3. Симулируем фоновый процессор
    await runOutboxTick();

    // 4. Событие ушло в очередь
    expect(queue.messages).toHaveLength(1);
    const [sent] = queue.messages;
    expect(sent.pattern).toBe('track_action');
    expect(sent.record.data.eventName).toBe('track_action');
    expect(sent.record.data.properties).toMatchObject({
      taskId,
      action: 'TaskCreatedEvent',
    });
    const headers = sent.record.options?.headers as Record<string, string>;
    expect(headers['x-correlation-id']).toEqual(expect.any(String));

    // 5. Outbox-запись помечена PROCESSED и больше не PENDING
    const stored = readOutboxTable().find((e) => e.id === outboxRecord?.id);
    expect(stored?.status).toBe('PROCESSED');
    expect(await masterDb.getPendingOutboxEvents()).toHaveLength(0);
  });

  it('не отправляет событие повторно при следующем тике процессора (идемпотентность)', async () => {
    await request(httpServer())
      .post('/tasks')
      .send({ title: 'Idempotent', description: 'once' })
      .expect(201);

    await runOutboxTick();
    expect(queue.messages).toHaveLength(1);

    await runOutboxTick();
    expect(queue.messages).toHaveLength(1);
  });

  it('отправляет в очередь отдельное сообщение на каждую созданную задачу', async () => {
    await request(httpServer())
      .post('/tasks')
      .send({ title: 'A', description: 'a' })
      .expect(201);
    await request(httpServer())
      .post('/tasks')
      .send({ title: 'B', description: 'b' })
      .expect(201);

    await runOutboxTick();

    expect(queue.messages).toHaveLength(2);
    const taskIds = queue.messages.map((m) => m.record.data.properties.taskId);
    expect(new Set(taskIds).size).toBe(2);
  });
});
