import { Injectable } from '@nestjs/common';
import { ITaskEventStore } from '../../domain/repositories/task-event-store.interface';
import { IEvent } from '../../domain/models/task-events';
import { v4 as uuidv4 } from 'uuid';

// Структура строки таблицы task_events
interface TaskEventRow {
  id: string;
  taskId: string;
  eventName: string;
  payload: string; // Храним в виде JSON-строки, как в реальных БД
  createdAt: Date;
}

@Injectable()
export class InMemoryEventStore implements ITaskEventStore {
  // Наш единственный append-only лог событий (эмуляция таблицы базы данных)
  private readonly eventLog: TaskEventRow[] = [];

  // Метод добавления события в конец лога
  async saveEvent(event: IEvent): Promise<void> {
    const row: TaskEventRow = {
      id: uuidv4(),
      taskId: event.taskId,
      eventName: event.eventName,
      payload: JSON.stringify(event.payload),
      createdAt: event.createdAt,
    };

    this.eventLog.push(row);
    console.log(
      `[💾 Event Store Saved] Добавлено событие ${row.eventName} для задачи ${row.taskId}`,
    );

    return Promise.resolve();
  }

  // Метод извлечения всей истории событий по конкретному taskId
  async getEventsByTaskId(taskId: string): Promise<IEvent[]> {
    // Фильтруем записи, принадлежащие конкретному агрегату задачи
    const rows = this.eventLog.filter((row) => row.taskId === taskId);

    // Маппим строки таблицы обратно в типизированные объекты доменных событий
    const events: IEvent[] = rows.map((row) => ({
      eventName: row.eventName,
      taskId: row.taskId,
      payload: JSON.parse(row.payload),
      createdAt: row.createdAt,
    }));

    return Promise.resolve(events);
  }
}
