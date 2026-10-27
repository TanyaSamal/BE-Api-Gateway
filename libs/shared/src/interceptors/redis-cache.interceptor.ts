import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheInterceptor implements NestInterceptor {
  constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request: Request = context.switchToHttp().getRequest<Request>();

    // Формируем уникальный ключ кэша на основе URL и query-параметров
    // Например: cache:/analytics/dashboard?userId=42
    const cacheKey = `cache:${request.url}`;

    // 1. Пытаемся получить данные из Redis (Cache Hit)
    const cachedData = await this.redisClient.get(cacheKey);

    if (cachedData) {
      console.log(`[🟢 CACHE HIT] Данные для ${cacheKey} взяты из Redis`);
      // Метод of() из rxjs позволяет вернуть данные мгновенно, минуя контроллер
      return of(JSON.parse(cachedData));
    }

    // 2. Если данных нет в Redis (Cache Miss)
    console.log(
      `[🔴 CACHE MISS] В Redis пусто. Идем выполнять тяжелый запрос...`,
    );

    return next.handle().pipe(
      tap((response) => {
        this.redisClient
          .setex(cacheKey, 60, JSON.stringify(response))
          .then(() => {
            console.log(`[💾 CACHE SAVED] Ответ для ${cacheKey} сохранен в Redis на 60 сек.`);
          })
          .catch((err) => {
            console.error(`[❌ REDIS ERROR] Не удалось сохранить кэш:`, err);
          });
      }),
    );
  }
}
