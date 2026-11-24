import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateTaskCommand } from './create-task.command';
import { v4 as uuidv4 } from 'uuid';
import { Inject } from '@nestjs/common';
import { ITaskEventStore } from '../../domain/repositories/task-event-store.interface';
import { TaskCreatedEvent } from '../../domain/models/task-events';

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand> {
  constructor(
    @Inject('EVENT_STORE')
    private readonly transactionalStore: ITaskEventStore, // <-- Подключаем TransactionalStore (Outbox)
  ) {}

  async execute(command: CreateTaskCommand): Promise<string> {
    const { title, description, authorId } = command;
    const taskId = uuidv4();

    const event = new TaskCreatedEvent(taskId, title, description, authorId);

    await this.transactionalStore.saveEvent(event);

    return taskId;
  }
}
