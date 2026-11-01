import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TaskController } from './interface/task.controller';
import { CreateTaskHandler } from './application/commands/create-task.handler';
import { CompleteTaskHandler } from './application/commands/complete-task.handler'; // Новый
import { InMemoryEventStore } from './infrastructure/persistence/in-memory-event-store'; // Новый
import { GetTaskHandler } from './application/queries/get-task.handler';

const CommandHandlers = [CreateTaskHandler, CompleteTaskHandler];
const QueryHandlers = [GetTaskHandler];

@Module({
  imports: [CqrsModule],
  controllers: [TaskController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    // Регистрируем Event Store через текстовый токен инверсии зависимостей
    {
      provide: 'EVENT_STORE',
      useClass: InMemoryEventStore,
    },
  ],
})
export class TasksModule {}
