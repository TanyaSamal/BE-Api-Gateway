import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetTaskQuery } from './get-task.query';
import { Inject } from '@nestjs/common';
import { ITaskEventStore } from '../../domain/repositories/task-event-store.interface';
import { Task } from '../../domain/models/task.model';

@QueryHandler(GetTaskQuery)
export class GetTaskHandler implements IQueryHandler<GetTaskQuery> {
  constructor(
    @Inject('EVENT_STORE') private readonly eventStore: ITaskEventStore,
  ) {}

  execute(query: GetTaskQuery): Promise<Task> {
    // 1. Извлекаем всю историю событий по конкретной задаче из лога
    return this.eventStore.getEventsByTaskId(query.taskId).then((events) => {
      // 2. Вызываем доменный метод replay() для сборки актуального состояния
      const computedTask = Task.replay(events);

      // Возвращаем собранный агрегат
      return computedTask;
    });
  }
}
