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
import { CqrsModule } from '@nestjs/cqrs';

// Analytics Module
import { AnalyticsExportController } from './analytics/application/controllers/analytics-export.controller';
import { DownloadAnalyticsCsvHandler } from './analytics/application/queries/download-analytics-csv.handler.improved';
import { AnalyticsExportService } from './analytics/application/services/analytics-export.service';
import { AnalyticsLogsRepositoryImpl } from './analytics/infrastructure/repositories/analytics-logs.repository.impl';
import { ANALYTICS_LOGS_REPOSITORY } from './analytics/domain/repositories/analytics-logs.repository';

@Module({
  imports: [
    RedisModule,
    TasksModule,
    SharedModule,
    CqrsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController, AnalyticsExportController],
  providers: [
    AppService,
    AppLogger,
    CorrelationContextService,
    // Analytics providers
    DownloadAnalyticsCsvHandler,
    AnalyticsExportService,
    {
      provide: ANALYTICS_LOGS_REPOSITORY,
      useClass: AnalyticsLogsRepositoryImpl,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Применяем middleware ко всем HTTP маршрутам
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
