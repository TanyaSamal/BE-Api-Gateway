import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TaskController } from './interface/task.controller';
import { CreateTaskHandler } from './application/commands/create-task.handler';
import { CompleteTaskHandler } from './application/commands/complete-task.handler';
import { GetTaskHandler } from './application/queries/get-task.handler';
import { OutboxProcessor } from './infrastructure/cron/outbox.processor';
import { TransactionalStore } from './infrastructure/persistence/transactional-store';
import { DatabaseModule } from './infrastructure/persistence/database.module';
import { SharedModule } from 'ai/shared';
import { GetTasksHandler } from './application/queries/get-tasks.handler';
import { TasksGateway } from './interface/tasks.gateway';
import { DeleteTaskHandler } from './application/commands/delete-task.handler';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
import { DeleteTaskGuard } from './casl/delete-task.guard';

const CommandHandlers = [
  CreateTaskHandler,
  CompleteTaskHandler,
  DeleteTaskHandler,
];
const QueryHandlers = [GetTaskHandler, GetTasksHandler];

@Module({
  imports: [CqrsModule, SharedModule, DatabaseModule],
  controllers: [TaskController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    OutboxProcessor,
    TasksGateway,
    // Регистрируем Event Store через текстовый токен инверсии зависимостей
    {
      provide: 'EVENT_STORE',
      useClass: TransactionalStore,
    },
    CaslAbilityFactory,
    DeleteTaskGuard,
  ],
})
export class TasksModule {}
