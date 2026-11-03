import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DownloadAnalyticsCsvQuery } from './download-analytics-csv.query';
import { Readable } from 'stream';
import { CorrelationContextService } from 'ai/shared';

@QueryHandler(DownloadAnalyticsCsvQuery)
export class DownloadAnalyticsCsvHandler implements IQueryHandler<
  DownloadAnalyticsCsvQuery,
  Readable
> {
  constructor(private readonly contextService: CorrelationContextService) {}

  async execute(query: DownloadAnalyticsCsvQuery): Promise<Readable> {
    // Получаем текущий x-correlation-id, созданный в Gateway Middleware
    // Если по какой-то причине контекста нет (например, вызов вне HTTP-запроса), генерируем фолбэк
    const correlationId =
      this.contextService.getCorrelationId() || 'fallback-gateway-id';

    // Делаем нативный асинхронный HTTP-запрос к микросервису аналитики
    const response = await fetch(
      'http://localhost:3002/internal/analytics/stream',
      {
        method: 'GET',
        headers: {
          'Accept': 'application/x-ndjson',
          'x-correlation-id': correlationId,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Ошибка микросервиса аналитики: ${response.statusText}`);
    }

    // Безопасно приводим Web ReadableStream к классическому Node.js Readable Стриму
    const nodeStream = Readable.fromWeb(response.body as any);

    return nodeStream;
  }
}
