import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Task } from '../domain/models/task.model';
import { CreateTaskCommand } from '../application/commands/create-task.command';
import { GetTaskQuery } from '../application/queries/get-task.query';
import { CompleteTaskCommand } from '../application/commands/complete-task.command';

@Controller('tasks')
export class TaskController {
  // Внедряем встроенные шины CQRS от NestJS
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // 1. Создание задачи (добавляет TaskCreatedEvent)
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

  // 2. Завершение задачи (добавляет TaskCompletedEvent)
  @Patch(':id/complete')
  async completeTask(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.commandBus.execute<CompleteTaskCommand, void>(
      new CompleteTaskCommand(id),
    );
    return { success: true };
  }

  // 3. Получение задачи по ID (собирает текущее состояние через replay)
  @Get(':id')
  async getTaskById(@Param('id') id: string): Promise<Task> {
    // Отправляем запрос в QueryBus. NestJS сам вызовет GetTasksHandler
    return await this.queryBus.execute<GetTaskQuery, Task>(
      new GetTaskQuery(id),
    );
  }
}
