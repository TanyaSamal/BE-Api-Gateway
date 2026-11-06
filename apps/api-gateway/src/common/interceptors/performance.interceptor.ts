import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { AppLogger, CorrelationContextService } from 'ai/shared';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: AppLogger,
    private readonly contextService: CorrelationContextService,
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
        const duration = parseFloat((endTime - startTime).toFixed(2));

        // КРИТИЧЕСКАЯ ПРОВЕРКА: Если заголовки еще НЕ ушли клиенту (обычный эндпоинт)
        if (!response.headersSent) {
          // Инжектируем точное время выполнения в кастомный заголовок HTTP-ответа
          response.setHeader('X-Response-Time-Ms', duration.toString());
          // Разрешаем фронтенду читать этот заголовок, если они на разных доменах (CORS)
          response.setHeader(
            'Access-Control-Expose-Headers',
            'X-Response-Time-Ms',
          );
        } else {
          // Если это был стрим, мы не можем добавить заголовок, 
          // но можем сделать пометку в логах для отладки
          this.logger.log(
            `[Stream] Стриминг завершен за ${duration}ms (Заголовки были отправлены в процессе) [ID: ${correlationId}]`,
          );
        }

        // Если выполнение (включая ожидание микросервисов по fetch/RMQ) > 200мс
        if (duration > 200) {
          this.logger.warn(
            `[WARN] Slow Request: ${request.method} ${request.url} - ${duration}ms [ID: ${correlationId}]`,
          );
        }
      }),
    );
  }
}
