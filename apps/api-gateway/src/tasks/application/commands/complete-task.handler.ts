import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TaskCompletedEvent } from '../../domain/models/task-events';
import { Inject } from '@nestjs/common';
import { ITaskEventStore } from '../../domain/repositories/task-event-store.interface';
import { CompleteTaskCommand } from './complete-task.command';
import { AppLogger, CorrelationContextService } from 'ai/shared';
import { MASTER_DB_CONNECTION } from '../../infrastructure/persistence/database.module';

@CommandHandler(CompleteTaskCommand)
export class CompleteTaskHandler implements ICommandHandler<CompleteTaskCommand> {
  constructor(
    @Inject(MASTER_DB_CONNECTION)
    private readonly masterEventStore: ITaskEventStore,
    private readonly contextService: CorrelationContextService,
    private readonly logger: AppLogger,
  ) {}

  async execute(command: CompleteTaskCommand): Promise<void> {
    const correlationId = this.contextService.getCorrelationId() || 'unknown';

    this.logger.log(
      `[CQRS Command] Обработка CompleteTaskCommand для задачи #${command.taskId} [ID: ${correlationId}]`,
      'CompleteTaskHandler',
    );

    // 1. Создаем доменное событие завершения таски
    const event = new TaskCompletedEvent(command.taskId);

    // 2. Сохраняем его строго на Master-ноду
    await this.masterEventStore.saveEvent(event);
  }
}
