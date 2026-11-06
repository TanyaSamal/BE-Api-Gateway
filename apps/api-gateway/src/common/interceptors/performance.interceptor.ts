import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import {
  AppLogger,
  CorrelationContextService,
  MetricsService,
} from 'ai/shared';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: AppLogger,
    private readonly contextService: CorrelationContextService,
    private readonly metricsService: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Работаем только с HTTP-запросами (игнорируем RMQ-события на шлюзе, если они есть)
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse<Response>();

    const startTime = performance.now();
    const correlationId = this.contextService.getCorrelationId() || 'unknown';

    return next.handle().pipe(
      tap(() => {
        const endTime = performance.now();
        const durationMs = parseFloat((endTime - startTime).toFixed(2));
        const durationSec = durationMs / 1000; // Prometheus принимает секунды

        const labels = {
          method: request.method,
          route: request.route?.path || request.url,
        };

        // 1. Фиксируем время выполнения в гистограмме Prometheus
        this.metricsService.httpRequestDurationHistogram.observe(labels, durationSec);

        // 2. Увеличиваем счетчик запросов, записывая итоговый статус-код
        this.metricsService.httpRequestsCounter.inc({
          ...labels,
          status: response.statusCode.toString(),
        });

        // КРИТИЧЕСКАЯ ПРОВЕРКА: Если заголовки еще НЕ ушли клиенту (обычный эндпоинт)
        if (!response.headersSent) {
          // Инжектируем точное время выполнения в кастомный заголовок HTTP-ответа
          response.setHeader('X-Response-Time-Ms', durationMs.toString());
          // Разрешаем фронтенду читать этот заголовок, если они на разных доменах (CORS)
          response.setHeader(
            'Access-Control-Expose-Headers',
            'X-Response-Time-Ms',
          );
        } else {
          // Если это был стрим, мы не можем добавить заголовок,
          // но можем сделать пометку в логах для отладки
          this.logger.log(
            `[Stream] Стриминг завершен за ${durationMs}ms (Заголовки были отправлены в процессе) [ID: ${correlationId}]`,
          );
        }

        // Если выполнение (включая ожидание микросервисов по fetch/RMQ) > 200мс
        if (durationMs > 200) {
          this.logger.warn(
            `[WARN] Slow Request: ${request.method} ${request.url} - ${durationMs}ms [ID: ${correlationId}]`,
          );
        }
      }),
    );
  }
}
