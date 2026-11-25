import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TaskCompletedEvent } from '../../domain/models/task-events';
import { ITaskEventStore } from '../../domain/repositories/task-event-store.interface';
import { CompleteTaskCommand } from './complete-task.command';
import { AppLogger, CorrelationContextService } from '@ai/shared';
import { Inject } from '@nestjs/common';

@CommandHandler(CompleteTaskCommand)
export class CompleteTaskHandler implements ICommandHandler<CompleteTaskCommand> {
  constructor(
    @Inject('EVENT_STORE')
    private readonly transactionalStore: ITaskEventStore,
    private readonly contextService: CorrelationContextService,
    private readonly logger: AppLogger,
  ) {}

  async execute(command: CompleteTaskCommand): Promise<void> {
    const correlationId = this.contextService.getCorrelationId() || 'unknown';

    this.logger.log(
      `[CQRS Command] Обработка CompleteTaskCommand для задачи #${command.taskId} [ID: ${correlationId}]`,
      'CompleteTaskHandler',
    );

    const event = new TaskCompletedEvent(command.taskId);

    await this.transactionalStore.saveEvent(event);
  }
}
