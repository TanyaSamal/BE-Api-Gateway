import {
  Injectable,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy, RmqRecordBuilder } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import * as CircuitBreaker from 'opossum';
import {
  AppLogger,
  CorrelationContextService,
  IAnalyticsDashboardResponse,
  TrackEventDto,
} from 'ai/shared';
import Redis from 'ioredis';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class AppService {
  private breaker: CircuitBreaker<
    [number, string?],
    IAnalyticsDashboardResponse
  >;

  constructor(
    @Inject('ANALYTICS_SERVICE') private readonly analyticsClient: ClientProxy,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly contextService: CorrelationContextService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.breaker = new CircuitBreaker(
      (userId: number, period?: string) =>
        this.fetchDashboardViaRmq(userId, period),
      {
        timeout: 5000, // Должно быть > 3000мс из-за искусственного delay(3000)
        errorThresholdPercentage: 50, // 50% ошибок
        rollingCountTimeout: 10000, // За окно в 10 секунд
        rollingCountBuckets: 10,
        volumeThreshold: 2, // Минимум 2 запроса за 10 сек для срабатывания
        resetTimeout: 15000, // Через 15 сек переходим в Half-Open
      },
    );

    // Fallback при ошибке или разомкнутой цепи (OPEN)
    this.breaker.fallback((userId: number, period?: string) =>
      this.getFallbackFromRedis(userId, period),
    );

    // Логирование состояний Circuit Breaker
    this.breaker.on('open', () =>
      this.logger.warn(
        '🔴 [CircuitBreaker] OPEN! Вызовы analytics-service через RMQ заблокированы.',
      ),
    );

    this.breaker.on('halfOpen', () =>
      this.logger.log(
        '🟡 [CircuitBreaker] HALF-OPEN. Пробный запрос к analytics-service...',
        'AppService',
      ),
    );

    this.breaker.on('close', () =>
      this.logger.log(
        '🟢 [CircuitBreaker] CLOSED. Работа analytics-service восстановлена.',
        'AppService',
      ),
    );
  }

  async getDashboardData(
    userId: number,
    period?: string,
  ): Promise<IAnalyticsDashboardResponse> {
    // Вся работа теперь идет через предохранитель
    return this.breaker.fire(userId, period);
  }

  sendEventToQueue(eventDto: TrackEventDto) {
    const correlationId = this.contextService.getCorrelationId() || 'no-id';

    this.logger.log(
      `Генерируем событие для отправки в RabbitMQ...`,
      'GatewayService',
    );

    // Правильно упаковываем DTO отдельно, а системный заголовок — отдельно
    const record = new RmqRecordBuilder(eventDto)
      .setOptions({
        headers: {
          'x-correlation-id': correlationId,
        },
      })
      .build();

    const pattern = 'track_action'; // Должен совпадать с @EventPattern в микросервисе

    // Метод emit отправляет данные в RabbitMQ и НЕ ждет ответа от микросервиса.
    this.analyticsClient.emit(pattern, record);
  }

  /**
   * Защищаемая функция: реальный RPC-запрос в RabbitMQ
   */
  private async fetchDashboardViaRmq(
    userId: number,
    period?: string,
  ): Promise<IAnalyticsDashboardResponse> {
    this.logger.log(
      'Начало выполнения "тяжелого" запроса к микросервису...',
      'AppService',
    );

    await delay(3000);

    const pattern = 'get_analytics_dashboard';
    const payload = { userId, period };

    // Важно добавить timeout, чтобы подписка RMQ не висела вечно при падении воркера
    const result = await firstValueFrom(
      this.analyticsClient
        .send<IAnalyticsDashboardResponse>(pattern, payload)
        .pipe(timeout(1800)),
    );

    // Сохраняем успешный результат в долгосрочный fallback-кэш Redis (24 часа)
    const fallbackKey = this.getFallbackKey(userId, period);
    await this.redis.set(fallbackKey, JSON.stringify(result), 'EX', 86400);

    return result;
  }

  /**
   * Резервный метод: мгновенное чтение из Redis при сбое
   */
  private async getFallbackFromRedis(
    userId: number,
    period?: string,
  ): Promise<IAnalyticsDashboardResponse> {
    const fallbackKey = this.getFallbackKey(userId, period);
    const cached = await this.redis.get(fallbackKey);

    if (cached) {
      this.logger.warn(
        `⚡ [CircuitBreaker Fallback] Возвращаем закэшированные данные из Redis (${fallbackKey})`,
      );
      return JSON.parse(cached) as IAnalyticsDashboardResponse;
    }

    throw new ServiceUnavailableException(
      'Микросервис аналитики недоступен, а резервные данные в Redis отсутствуют.',
    );
  }

  private getFallbackKey(userId: number, period?: string): string {
    return `cb:fallback:dashboard:${userId}:${period || '7_days'}`;
  }

  // Метод для мониторинга состояния цепи
  getCircuitStatus() {
    return {
      state: this.breaker.opened
        ? 'OPEN'
        : this.breaker.halfOpen
          ? 'HALF_OPEN'
          : 'CLOSED',
      stats: this.breaker.stats,
    };
  }
}
