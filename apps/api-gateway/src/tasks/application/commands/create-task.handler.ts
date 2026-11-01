import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateTaskCommand } from './create-task.command';
import { v4 as uuidv4 } from 'uuid';
import { TaskCreatedEvent } from '../../domain/models/task-events';
import { Inject } from '@nestjs/common';
import { ITaskEventStore } from '../../domain/repositories/task-event-store.interface';

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand> {
  constructor(
    @Inject('EVENT_STORE') private readonly eventStore: ITaskEventStore,
  ) {}

  async execute(command: CreateTaskCommand): Promise<string> {
    const { title, description } = command;

    const taskId = uuidv4();

    // Генерируем доменное событие создания
    const event = new TaskCreatedEvent(taskId, title, description);

    // Асинхронно записываем событие в конец лога и возвращаем ID
    return this.eventStore.saveEvent(event).then(() => {
      return taskId;
    });
  }
}
