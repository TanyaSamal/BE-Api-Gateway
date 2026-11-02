export interface IEvent {
  eventName: string;
  taskId: string;
  payload: any;
  createdAt: Date;
}

export class TaskCreatedEvent implements IEvent {
  readonly eventName = 'TaskCreatedEvent';
  readonly createdAt = new Date();
  readonly payload: { title: string; description: string; userId: number };

  constructor(
    public readonly taskId: string,
    title: string,
    description: string,
  ) {
    this.payload = { title, description, userId: 99 };
  }
}

export class TaskCompletedEvent implements IEvent {
  readonly eventName = 'TaskCompletedEvent';
  readonly createdAt = new Date();
  readonly payload = {}; // Для завершения задачи дополнительные данные не требуются

  constructor(public readonly taskId: string) {}
}
