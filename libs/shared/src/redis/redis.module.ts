import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';

@Global() // Делаем модуль глобальным, чтобы не импортировать его в каждый модуль вручную
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis({
          host: '127.0.0.1',
          port: 6379,
        });
      },
    },
  ],
  exports: ['REDIS_CLIENT'], // Экспортируем токен для инъекций
})
export class RedisModule {}
