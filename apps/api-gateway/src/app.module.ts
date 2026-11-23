import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  AppLogger,
  CorrelationContextService,
  MetricsService,
  RedisModule,
  SharedModule,
} from 'ai/shared';
import { TasksModule } from './tasks/tasks.module';
import { CorrelationMiddleware } from './common/middleware/correlation.middleware';
import { ScheduleModule } from '@nestjs/schedule';
import { DownloadAnalyticsCsvHandler } from './analytics/application/queries/download-analytics-csv.handler';
import { CqrsModule } from '@nestjs/cqrs';
import { WorkerPoolModule } from './worker-pool/worker-pool.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PerformanceInterceptor } from './common/interceptors/performance.interceptor';
import { AuthModule } from './auth/auth.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

@Module({
  imports: [
    RedisModule,
    TasksModule,
    SharedModule,
    CqrsModule,
    WorkerPoolModule,
    ScheduleModule.forRoot(),
    AuthModule,
    ThrottlerModule.forRootAsync({
      inject: ['REDIS_CLIENT'],
      useFactory: (redis: Redis) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000, // Окно в 60 секунд (в миллисекундах в @nestjs/throttler v5/v6)
            limit: 10, // Максимум 10 запросов за 60 секунд с одного IP
          },
        ],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppLogger,
    CorrelationContextService,
    MetricsService,
    DownloadAnalyticsCsvHandler,
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
    // Регистрируем ThrottlerGuard глобально на все HTTP-роуты api-gateway
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Применяем middleware ко всем HTTP маршрутам
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
