import { Inject, Injectable } from '@nestjs/common';
import { ITaskEventStore } from '../../domain/repositories/task-event-store.interface';
import { IEvent } from '../../domain/models/task-events';
import { OutboxEvent } from '../../domain/models/outbox-event.model';
import { v4 as uuidv4 } from 'uuid';
import { MASTER_DB_CONNECTION } from './database.module';
import { AppLogger } from 'ai/shared';
import { InMemoryEventStore } from './in-memory-event-store';

@Injectable()
export class TransactionalStore implements ITaskEventStore {
  constructor(
    @Inject(MASTER_DB_CONNECTION) private readonly masterDb: InMemoryEventStore,
    private readonly logger: AppLogger,
  ) {}

  // Метод, выполняющий атомарную "ACID-транзакцию" записи
  async saveEventAndOutbox(event: IEvent): Promise<void> {
    this.logger.log(
      `[Transactional Outbox] Старт атомарной транзакции записи события ${event.constructor.name}`,
      'TransactionalStore',
    );

    try {
      await this.masterDb.saveEvent(event);

      const outboxEvent = new OutboxEvent(
        uuidv4(),
        'track_action',
        {
          userId: 'system',
          action: event.eventName,
          event: event.payload
        },
        'PENDING',
        new Date(),
      );

      // 1. Записываем событие в Event Store (таблица логов изменений) через Master
      await this.masterDb.insertOutboxEvent(outboxEvent);

      this.logger.log(
        `[Transactional Outbox] Событие и Outbox-уведомление для задачи #${event.taskId} успешно зафиксированы на Master-узле!`,
        'TransactionalStore',
      );
    } catch (error) {
      console.error('[❌ Transaction Rollback] Ошибка транзакции!', error);
      throw new Error('Transaction failed');
    }
  }

  // Алиас для вызова со стороны Command хэндлеров
  async saveEvent(event: IEvent): Promise<void> {
    return this.saveEventAndOutbox(event);
  }

  // Для совместимости с интерфейсом
  async getEventsByTaskId(taskId: string): Promise<IEvent[]> {
    return this.masterDb.getEventsByTaskId(taskId);
  }

  // ==========================================
  // МЕТОДЫ ДЛЯ ФОНОВОГО ПРОЦЕССОРА (OUTBOX CRON)
  // ==========================================

  // Крон обращается к TransactionalStore, а тот идет на MASTER ноду
  async getPendingOutboxEvents(): Promise<OutboxEvent[]> {
    return this.masterDb.getPendingOutboxEvents();
  }

  async markAsProcessed(id: string): Promise<void> {
    await this.masterDb.updateOutboxStatus(id, 'PROCESSED');
    this.logger.log(
      `[📋 Outbox DB] Событие ${id} успешно помечено как PROCESSED на Master-ноде`,
      'TransactionalStore',
    );
  }
}
