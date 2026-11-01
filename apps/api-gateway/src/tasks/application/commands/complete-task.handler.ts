import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TaskCompletedEvent } from '../../domain/models/task-events';
import { Inject } from '@nestjs/common';
import { ITaskEventStore } from '../../domain/repositories/task-event-store.interface';
import { CompleteTaskCommand } from './complete-task.command';

@CommandHandler(CompleteTaskCommand)
export class CompleteTaskHandler implements ICommandHandler<CompleteTaskCommand> {
  constructor(
    @Inject('EVENT_STORE') private readonly eventStore: ITaskEventStore,
  ) {}

  async execute(command: CompleteTaskCommand): Promise<void> {
    // Генерируем доменное событие завершения
    const event = new TaskCompletedEvent(command.taskId);

    // Сохраняем событие в Event Store лог
    return this.eventStore.saveEvent(event);
  }
}
