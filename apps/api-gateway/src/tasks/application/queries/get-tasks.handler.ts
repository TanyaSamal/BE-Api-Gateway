import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetTasksQuery } from './get-tasks.query';
import { Inject } from '@nestjs/common';
import { ITaskRepository } from '../../domain/repositories/task.repository.interface';
import { Task } from '../../domain/models/task.model';

@QueryHandler(GetTasksQuery)
export class GetTasksHandler implements IQueryHandler<GetTasksQuery> {
  constructor(
    @Inject('TASK_REPOSITORY') private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(query: GetTasksQuery): Promise<Task[]> {
    // Просто запрашиваем данные из репозитория чтения
    return await this.taskRepository.findAll();
  }
}
