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

@Module({
  imports: [RedisModule, TasksModule, SharedModule, ScheduleModule.forRoot()],
  controllers: [AppController],
  providers: [AppService, AppLogger, CorrelationContextService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Применяем middleware ко всем HTTP маршрутам
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
