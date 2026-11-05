import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  AppLogger,
  CorrelationContextService,
  RedisModule,
  SharedModule,
} from 'ai/shared';
import { TasksModule } from './tasks/tasks.module';
import { CorrelationMiddleware } from './common/middleware/correlation.middleware';
import { ScheduleModule } from '@nestjs/schedule';
import { DownloadAnalyticsCsvHandler } from './analytics/application/queries/download-analytics-csv.handler';
import { CqrsModule } from '@nestjs/cqrs';
import { WorkerPoolModule } from './worker-pool/worker-pool.module';

@Module({
  imports: [
    RedisModule,
    TasksModule,
    SharedModule,
    CqrsModule,
    WorkerPoolModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppLogger,
    CorrelationContextService,
    DownloadAnalyticsCsvHandler,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Применяем middleware ко всем HTTP маршрутам
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
