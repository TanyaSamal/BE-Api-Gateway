export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export class Task {
  constructor(
    public readonly id: string,
    public title: string,
    public description: string,
    public status: TaskStatus,
    public readonly createdAt: Date,
  ) {}

  // Пример бизнес-метода внутри модели (DDD канон)
  public complete(): void {
    if (this.status === 'COMPLETED') {
      throw new Error('Задача уже завершена');
    }
    this.status = 'COMPLETED';
  }

  public updateDescription(newDescription: string): void {
    this.description = newDescription;
  }
}
