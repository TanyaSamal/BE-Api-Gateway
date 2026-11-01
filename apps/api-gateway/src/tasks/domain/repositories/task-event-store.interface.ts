import { IEvent } from '../models/task-events';

export interface ITaskEventStore {
  // Метод добавления события в лог (Append-Only)
  saveEvent(event: IEvent): Promise<void>;

  // Метод извлечения всех событий по конкретной задаче
  getEventsByTaskId(taskId: string): Promise<IEvent[]>;
}
