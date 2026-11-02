import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TaskController } from './interface/task.controller';
import { CreateTaskHandler } from './application/commands/create-task.handler';
import { CompleteTaskHandler } from './application/commands/complete-task.handler';
import { GetTaskHandler } from './application/queries/get-task.handler';
import { OutboxProcessor } from './infrastructure/cron/outbox.processor';
import { SharedModule } from 'ai/shared';
import { TransactionalStore } from './infrastructure/persistence/transactional-store';

const CommandHandlers = [CreateTaskHandler, CompleteTaskHandler];
const QueryHandlers = [GetTaskHandler];

@Module({
  imports: [CqrsModule, SharedModule],
  controllers: [TaskController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    OutboxProcessor,
    // Регистрируем Event Store через текстовый токен инверсии зависимостей
    {
      provide: 'EVENT_STORE',
      useClass: TransactionalStore,
    },
  ],
})
export class TasksModule {}
