import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateTaskCommand } from './create-task.command';
import { Inject } from '@nestjs/common';
import { ITaskRepository } from '../../domain/repositories/task.repository.interface';
import { Task } from '../../domain/models/task.model';

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand> {
  constructor(
    // Внедряем интерфейс репозитория (токен строки для DI)
    @Inject('TASK_REPOSITORY') private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(command: CreateTaskCommand): Promise<string> {
    const { title, description } = command;

    // Генерируем уникальный ID для доменной модели
    const taskId = Math.random().toString(36).substring(2, 11);

    // Создаем чистую доменную сущность (DDD Aggregate)
    const task = new Task(taskId, title, description, 'PENDING', new Date());

    // Сохраняем в репозиторий
    await this.taskRepository.save(task);

    return taskId;
  }
}
