import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TaskController } from './interface/task.controller';
import { CreateTaskHandler } from './application/commands/create-task.handler';
import { GetTasksHandler } from './application/queries/get-tasks.handler';
import { InMemoryTaskRepository } from './infrastructure/persistence/in-memory-task.repository';

// Собираем хэндлеры в массивы для удобства регистрации
const CommandHandlers = [CreateTaskHandler];
const QueryHandlers = [GetTasksHandler];

@Module({
  imports: [
    CqrsModule, // Обязательно импортируем модуль CQRS фреймворка
  ],
  controllers: [TaskController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    // Регистрируем репозиторий через текстовый токен для инверсии зависимостей (DIP)
    {
      provide: 'TASK_REPOSITORY',
      useClass: InMemoryTaskRepository,
    },
  ],
})
export class TasksModule {}
