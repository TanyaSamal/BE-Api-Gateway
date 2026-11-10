import { Injectable } from '@nestjs/common';
import { ITaskEventStore } from '../../domain/repositories/task-event-store.interface';
import { IEvent } from '../../domain/models/task-events';
import { OutboxEvent } from '../../domain/models/outbox-event.model';
import { v4 as uuidv4 } from 'uuid';

interface TaskEventRow {
  id: string;
  taskId: string;
  eventName: string;
  payload: string;
  createdAt: Date;
}

@Injectable()
export class InMemoryEventStore implements ITaskEventStore {
  private readonly eventLog: TaskEventRow[] = [];
  // Симуляция таблицы outbox на уровне инстанса БД
  private readonly outboxTable: OutboxEvent[] = [];
  private slaveReplica?: InMemoryEventStore;

  constructor(private readonly nodeName: string) {}

  public registerSlaveReplica(slave: InMemoryEventStore): void {
    this.slaveReplica = slave;
  }

  public insertRawRow(row: TaskEventRow): void {
    this.eventLog.push(row);
  }

  async mapEventToRow(event: IEvent): Promise<TaskEventRow> {
    return {
      id: uuidv4(),
      taskId: event.taskId,
      eventName: event.eventName || event.constructor.name,
      payload: JSON.stringify(event.payload || event),
      createdAt: event.createdAt || new Date(),
    };
  }

  async saveEvent(event: IEvent): Promise<void> {
    const row = await this.mapEventToRow(event);

    this.eventLog.push(row);

    console.log(
      `[💾 ${this.nodeName}] Добавлено событие ${row.eventName} для задачи ${row.taskId}`,
    );

    if (this.slaveReplica) {
      this.slaveReplica.insertRawRow(row);
      console.log(
        `[🔄 Репликация] Событие ${row.eventName} успешно скопировано на SLAVE-NODE`,
      );
    }
  }

  async getEventsByTaskId(taskId: string): Promise<IEvent[]> {
    console.log(
      `[Log] [🔍 ${this.nodeName} Чтение] Поиск истории событий по ID: ${taskId}`,
    );

    const rows = this.eventLog.filter((row) => row.taskId === taskId);

    return rows.map((row) => ({
      eventName: row.eventName,
      taskId: row.taskId,
      payload: JSON.parse(row.payload),
      createdAt: row.createdAt,
    }));
  }

  // ==========================================
  // ДОБАВЛЕННЫЕ МЕТОДЫ ДЛЯ СИМУЛЯЦИИ OUTBOX В БД
  // ==========================================

  async insertOutboxEvent(outboxEvent: OutboxEvent): Promise<void> {
    // Симулируем задержку I/O, чтобы легитимизировать async/await
    await new Promise((resolve) => setImmediate(resolve));
    this.outboxTable.push(outboxEvent);
  }

  async getPendingOutboxEvents(): Promise<OutboxEvent[]> {
    await new Promise((resolve) => setImmediate(resolve));
    return this.outboxTable.filter((e) => e.status === 'PENDING');
  }

  async updateOutboxStatus(
    id: string,
    status: 'PENDING' | 'PROCESSED',
  ): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve));
    const event = this.outboxTable.find((e) => e.id === id);
    if (event) {
      event.status = status;
    }
  }

  async getAllTasks(): Promise<any[]> {
    await new Promise((resolve) => setImmediate(resolve));

    const tasksMap = new Map<string, any>();

    for (const row of this.eventLog) {
      const payload = JSON.parse(row.payload);
      if (row.eventName === 'TaskCreatedEvent') {
        tasksMap.set(row.taskId, {
          id: row.taskId,
          title: payload.title || 'Без названия',
          description: payload.description || '',
          status: 'PENDING',
          createdAt: row.createdAt,
        });
      } else if (row.eventName === 'TaskCompletedEvent') {
        const task = tasksMap.get(row.taskId);
        if (task) task.status = 'COMPLETED';
      }
    }
    return Array.from(tasksMap.values());
  }
}
