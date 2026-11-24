export interface IEvent {
  eventName: string;
  taskId: string;
  payload: any;
  createdAt: Date;
}

export class TaskCreatedEvent implements IEvent {
  readonly eventName = 'TaskCreatedEvent';
  readonly createdAt = new Date();
  readonly payload: { title: string; description: string; authorId: string };

  constructor(
    public readonly taskId: string,
    title: string,
    description: string,
    authorId: string = 'user-1',
  ) {
    this.payload = { title, description, authorId };
  }
}

export class TaskCompletedEvent implements IEvent {
  readonly eventName = 'TaskCompletedEvent';
  readonly createdAt = new Date();
  readonly payload = {}; // Для завершения задачи дополнительные данные не требуются

  constructor(public readonly taskId: string) {}
}

export class TaskDeletedEvent implements IEvent {
  readonly eventName = 'TaskDeletedEvent';
  readonly createdAt = new Date();
  readonly payload: { deletedBy: string };

  constructor(
    public readonly taskId: string,
    deletedBy: string,
  ) {
    this.payload = { deletedBy };
  }
}
