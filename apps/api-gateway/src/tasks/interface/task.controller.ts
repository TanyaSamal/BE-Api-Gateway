import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Headers,
  Delete,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Task } from '../domain/models/task.model';
import { CreateTaskCommand } from '../application/commands/create-task.command';
import { GetTaskQuery } from '../application/queries/get-task.query';
import { CompleteTaskCommand } from '../application/commands/complete-task.command';
import { SkipThrottle } from '@nestjs/throttler';
import { DeleteTaskGuard } from '../casl/delete-task.guard';
import { DeleteTaskCommand } from '../application/commands/delete-task.command';
import { TaskBreakdownService } from '../ai/task-breakdown.service';
import { TaskCreatedWsPayload, TasksGateway } from './tasks.gateway';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';

@ApiTags('Tasks (CQRS & Event Sourcing)')
@ApiSecurity('x-user-id')
@ApiSecurity('x-user-role')
@SkipThrottle()
@Controller('tasks')
export class TaskController {
  // Внедряем встроенные шины CQRS от NestJS
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly taskBreakdownService: TaskBreakdownService,
    private readonly tasksGateway: TasksGateway,
  ) {}

  // 1. Создание задачи (добавляет TaskCreatedEvent)
  @Post()
  async createTask(
    @Body('title') title: string,
    @Body('description') description: string,
    @Headers('x-user-id') userId = 'user-1',
  ): Promise<{ id: string }> {
    // Отправляем команду в CommandBus. NestJS сам найдет нужный CreateTaskHandler
    const taskId = await this.commandBus.execute<CreateTaskCommand, string>(
      new CreateTaskCommand(title, description, userId),
    );
    return { id: taskId };
  }

  // 2. Завершение задачи (добавляет TaskCompletedEvent)
  @Patch(':id/complete')
  async completeTask(
    @Param('id') id: string,
    @Headers('x-2fa-token') twoFactorToken?: string,
    @Headers('x-user-id') userId = 'user-1', // Фолбэк на тестового пользователя
  ): Promise<{ success: boolean }> {
    await this.commandBus.execute<CompleteTaskCommand, void>(
      new CompleteTaskCommand(id, userId, twoFactorToken),
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

  // 4. Удаление задачи (защищено CASL Guard)
  @Delete(':id')
  @UseGuards(DeleteTaskGuard)
  async deleteTask(
    @Param('id') id: string,
    @Headers('x-user-id') userId = 'user-1',
  ): Promise<{ success: boolean; deletedTaskId: string }> {
    await this.commandBus.execute<DeleteTaskCommand, void>(
      new DeleteTaskCommand(id, userId),
    );
    return { success: true, deletedTaskId: id };
  }

  @Post('ai-breakdown')
  async aiBreakdown(
    @Body('goal') goal: string,
    @Headers('x-user-id') userId = 'user-1',
  ) {
    if (!goal || !goal.trim()) {
      throw new BadRequestException('Поле goal не может быть пустым');
    }

    // 1. Получаем структурированный массив подзадач от OpenRouter (валидированный через Zod)
    const subtasks = await this.taskBreakdownService.generateSubtasks(goal);

    const createdTasks: TaskCreatedWsPayload[] = [];

    // 2. Сохраняем каждую подзадачу через существующую CQRS-команду
    for (const item of subtasks) {
      const formattedDescription = `${item.description} (Оценка: ~${item.estimatedMinutes} мин.)`;

      const taskId = await this.commandBus.execute<CreateTaskCommand, string>(
        new CreateTaskCommand(item.title, formattedDescription, userId),
      );

      createdTasks.push({
        id: taskId,
        title: item.title,
        description: formattedDescription,
        estimatedMinutes: item.estimatedMinutes,
        authorId: userId,
        status: 'OPEN',
      });
    }

    // 3. Отправляем пачку созданных задач по WebSocket на фронтенд
    this.tasksGateway.notifyTasksCreated(createdTasks);

    return {
      success: true,
      goal,
      count: createdTasks.length,
      tasks: createdTasks,
    };
  }
}
