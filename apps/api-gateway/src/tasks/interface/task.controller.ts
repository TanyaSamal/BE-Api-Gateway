import { Controller, Get, Post, Body } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Task } from '../domain/models/task.model';
import { CreateTaskCommand } from '../application/commands/create-task.command';
import { GetTasksQuery } from '../application/queries/get-tasks.query';

@Controller('tasks')
export class TaskController {
  // Внедряем встроенные шины CQRS от NestJS
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async createTask(
    @Body('title') title: string,
    @Body('description') description: string,
  ): Promise<{ id: string }> {
    // Отправляем команду в CommandBus. NestJS сам найдет нужный CreateTaskHandler
    const taskId = await this.commandBus.execute<CreateTaskCommand, string>(
      new CreateTaskCommand(title, description),
    );
    return { id: taskId };
  }

  @Get()
  async getTasks(): Promise<Task[]> {
    // Отправляем запрос в QueryBus. NestJS сам вызовет GetTasksHandler
    return await this.queryBus.execute<GetTasksQuery, Task[]>(
      new GetTasksQuery(),
    );
  }
}
