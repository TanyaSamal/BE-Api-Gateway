import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetTasksQuery } from './get-tasks.query';
import { Inject } from '@nestjs/common';
import { SLAVE_DB_CONNECTION } from '../../infrastructure/persistence/database.module';
import { AppLogger, CorrelationContextService } from 'ai/shared';
import { Task } from '../../domain/models/task.model';
import { InMemoryEventStore } from '../../infrastructure/persistence/in-memory-event-store';

@QueryHandler(GetTasksQuery)
export class GetTasksHandler implements IQueryHandler<GetTasksQuery> {
  constructor(
    @Inject(SLAVE_DB_CONNECTION)
    private readonly slaveEventStore: InMemoryEventStore,
    private readonly contextService: CorrelationContextService,
    private readonly logger: AppLogger,
  ) {}

  async execute(query: GetTasksQuery): Promise<Task[]> {
    const correlationId = this.contextService.getCorrelationId() || 'unknown';

    this.logger.log(
      `[CQRS Query] Обработка GetTasksQuery (Запрос списка всех задач) [ID: ${correlationId}]`,
      'GetTasksHandler',
    );

    // Вызываем созданный метод на Slave-реплике.
    const tasks = await this.slaveEventStore.getAllTasks();

    return tasks as Task[];
  }
}
