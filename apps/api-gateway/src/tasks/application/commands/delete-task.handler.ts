import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteTaskCommand } from './delete-task.command';
import { ITaskEventStore } from '../../domain/repositories/task-event-store.interface';
import { TaskDeletedEvent } from '../../domain/models/task-events';

@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<DeleteTaskCommand> {
  constructor(
    @Inject('EVENT_STORE')
    private readonly transactionalStore: ITaskEventStore,
  ) {}

  async execute(command: DeleteTaskCommand): Promise<void> {
    const { taskId, deletedBy } = command;

    const event = new TaskDeletedEvent(taskId, deletedBy);
    await this.transactionalStore.saveEvent(event);
  }
}
