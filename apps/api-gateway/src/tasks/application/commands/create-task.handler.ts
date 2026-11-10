import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateTaskCommand } from './create-task.command';
import { v4 as uuidv4 } from 'uuid';
import { Inject } from '@nestjs/common';
import { ITaskEventStore } from '../../domain/repositories/task-event-store.interface';
import { TaskCreatedEvent } from '../../domain/models/task-events';
import { MASTER_DB_CONNECTION } from '../../infrastructure/persistence/database.module';

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand> {
  constructor(
    @Inject(MASTER_DB_CONNECTION)
    private readonly masterEventStore: ITaskEventStore, // Инжектируем Мастер
  ) {}

  async execute(command: CreateTaskCommand): Promise<string> {
    const { title, description } = command;
    const taskId = uuidv4();

    const event = new TaskCreatedEvent(taskId, title, description);

    await this.masterEventStore.saveEvent(event); // Запись строго на Мастер!

    return taskId;
  }
}
