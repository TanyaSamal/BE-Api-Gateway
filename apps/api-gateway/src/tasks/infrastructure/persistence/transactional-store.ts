import { Injectable } from '@nestjs/common';
import { ITaskEventStore } from '../../domain/repositories/task-event-store.interface';
import { IEvent } from '../../domain/models/task-events';
import { OutboxEvent, OutboxLog } from '../../domain/models/outbox-event.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TransactionalStore implements ITaskEventStore {
  // Эмуляция двух таблиц в одной БД
  private readonly eventLog: OutboxLog[] = [];
  private readonly outboxTable: OutboxEvent[] = [];

  // Метод, выполняющий атомарную "ACID-транзакцию" записи
  async saveEventAndOutbox(event: IEvent): Promise<void> {
    try {
      // 1. Запись в таблицу лога событий (Event Store)
      const eventRow = {
        id: uuidv4(),
        taskId: event.taskId,
        eventName: event.eventName,
        payload: JSON.stringify(event.payload),
        createdAt: event.createdAt,
      };
      this.eventLog.push(eventRow);

      // 2. Запись в таблицу outbox_events (Исходящий ящик) в той же транзакции
      const outboxRow = new OutboxEvent(
        uuidv4(),
        event.eventName,
        event.payload,
        'PENDING',
        new Date(),
      );
      this.outboxTable.push(outboxRow);

      console.log(
        `[🔗 ACID Transaction] Данные и Outbox успешно сохранены для задачи ${event.taskId}`,
      );
      return Promise.resolve();
    } catch (error) {
      console.error('[❌ Transaction Rollback] Ошибка транзакции!', error);
      throw new Error('Transaction failed');
    }
  }

  // Старые методы интерфейса ITaskEventStore для обратной совместимости
  async saveEvent(event: IEvent): Promise<void> {
    return this.saveEventAndOutbox(event);
  }

  async getEventsByTaskId(taskId: string): Promise<IEvent[]> {
    const rows = this.eventLog.filter((row) => row.taskId === taskId);
    const events: IEvent[] = rows.map((row) => ({
      eventName: row.eventName,
      taskId: row.taskId,
      payload: JSON.parse(row.payload),
      createdAt: row.createdAt,
    }));
    return Promise.resolve(events);
  }

  // Методы для фонового процессора Outbox
  async getPendingOutboxEvents(): Promise<OutboxEvent[]> {
    const pending = this.outboxTable.filter((e) => e.status === 'PENDING');
    return Promise.resolve(pending);
  }

  async markAsProcessed(id: string): Promise<void> {
    const event = this.outboxTable.find((e) => e.id === id);
    if (event) {
      event.status = 'PROCESSED';
      console.log(`[📋 Outbox DB] Событие ${id} помечено как PROCESSED`);
    }
    return Promise.resolve();
  }
}
