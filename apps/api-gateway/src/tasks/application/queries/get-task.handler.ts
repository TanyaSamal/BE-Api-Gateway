import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetTaskQuery } from './get-task.query';
import { Inject } from '@nestjs/common';
import { SLAVE_DB_CONNECTION } from '../../infrastructure/persistence/database.module';
import { CorrelationContextService, AppLogger } from 'ai/shared';
import { InMemoryEventStore } from '../../infrastructure/persistence/in-memory-event-store';
import { Task } from '../../domain/models/task.model';

@QueryHandler(GetTaskQuery)
export class GetTaskHandler implements IQueryHandler<GetTaskQuery> {
  constructor(
    @Inject(SLAVE_DB_CONNECTION)
    private readonly slaveEventStore: InMemoryEventStore,
    private readonly contextService: CorrelationContextService,
    private readonly logger: AppLogger,
  ) {}

  async execute(query: GetTaskQuery): Promise<Task | null> {
    const correlationId = this.contextService.getCorrelationId() || 'unknown';

    this.logger.log(
      `[CQRS Query] Обработка GetTaskQuery для задачи #${query.taskId} [ID: ${correlationId}]`,
      'GetTaskHandler',
    );

    // 2. Вытаскиваем историю доменных событий со SLAVE-реплики (Read-Only)
    const events = await this.slaveEventStore.getEventsByTaskId(query.taskId);

    if (!events || events.length === 0) {
      this.logger.warn(
        `[CQRS Query] Для задачи #${query.taskId} не найдено событий на Slave-ноде`,
      );
      return null;
    }

    // 3. САМЫЙ ВАЖНЫЙ ШАГ DDD/Event Sourcing: Восстанавливаем состояние Агрегата из истории
    // Вызываем ваш статический метод динамического воссоздания стейта агрегата
    const taskAggregate = Task.replay(events);

    return taskAggregate;
  }
}
