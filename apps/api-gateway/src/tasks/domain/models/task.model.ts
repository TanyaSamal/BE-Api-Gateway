import { IEvent } from './task-events';

export type TaskStatus = 'PENDING' | 'COMPLETED';

export class Task {
  public id!: string;
  public title!: string;
  public description!: string;
  public status!: TaskStatus;
  public createdAt!: Date;
  public authorId!: string;
  public isCompleted = false;
  public isDeleted = false;

  constructor() {}

  /**
   * Метод Replay: принимает историю событий по конкретной задаче
   * и последовательно применяет их для вычисления текущего состояния.
   */
  public static replay(events: IEvent[]): Task {
    if (!events || events.length === 0) {
      throw new Error(
        'Невозможно восстановить состояние: история событий пуста',
      );
    }

    const task = new Task();

    for (const event of events) {
      switch (event.eventName) {
        case 'TaskCreatedEvent':
          task.id = event.taskId;
          task.title = event.payload.title;
          task.description = event.payload.description;
          task.status = 'PENDING';
          task.createdAt = event.createdAt;
          task.authorId = event.payload.authorId || 'user-1';
          break;

        case 'TaskCompletedEvent':
          task.status = 'COMPLETED';
          break;

        case 'TaskDeletedEvent':
          task.isDeleted = true;
          break;

        default:
          console.warn(
            `[DDD Replay] Неизвестный тип события: ${event.eventName}`,
          );
      }
    }

    return task;
  }
}
