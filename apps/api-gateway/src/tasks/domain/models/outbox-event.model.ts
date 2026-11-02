export class OutboxEvent {
  constructor(
    public readonly id: string,
    public readonly eventName: string,
    public readonly payload: any,
    public status: 'PENDING' | 'PROCESSED' | 'FAILED',
    public readonly createdAt: Date,
  ) {}
}

export class OutboxLog {
  constructor(
    public readonly id: string,
    public readonly taskId: string,
    public readonly eventName: string,
    public readonly payload: any,
    public readonly createdAt: Date,
  ) {}
}
