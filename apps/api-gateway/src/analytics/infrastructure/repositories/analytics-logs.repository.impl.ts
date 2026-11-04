/**
 * Infrastructure Repository Implementation
 *
 * Реализует получение логов из микросервиса аналитики.
 * Инкапсулирует HTTP-коммуникацию и обработку ошибок.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import {
  IAnalyticsLogsRepository,
  StreamMetrics,
} from '../../domain/repositories/analytics-logs.repository';
import { ExportMetadata } from '../../domain/value-objects/export-metadata.vo';
import {
  AnalyticsMicroserviceException,
  AnalyticsRepositoryException,
} from '../../domain/exceptions/analytics.exceptions';

interface StreamMetricsMap {
  [correlationId: string]: StreamMetrics;
}

@Injectable()
export class AnalyticsLogsRepositoryImpl implements IAnalyticsLogsRepository {
  private readonly logger = new Logger(AnalyticsLogsRepositoryImpl.name);
  private readonly metrics: StreamMetricsMap = {};
  private readonly MICROSERVICE_URL =
    process.env['ANALYTICS_SERVICE_URL'] || 'http://localhost:3002';
  private readonly TIMEOUT_MS = 30000;

  async streamLogs(
    metadata: ExportMetadata,
    correlationId: string,
  ): Promise<Readable> {
    try {
      // Логируем начало запроса
      this.logger.debug(
        `Starting stream request to analytics microservice [${correlationId}]`,
        { metadata: metadata.toJSON() },
      );

      // Инициализируем метрики
      this.metrics[correlationId] = {
        correlationId,
        startTime: new Date(),
        rowsProcessed: 0,
        bytesTransferred: 0,
        currentMemoryUsage: process.memoryUsage().heapUsed,
        isPaused: false,
        isActive: true,
      };

      // Формируем URL с параметрами фильтрации (если нужны)
      const url = this.buildStreamUrl(metadata);

      // Делаем fetch с таймаутом
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/x-ndjson',
            'x-correlation-id': correlationId,
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutHandle);
      }

      if (!response.ok) {
        throw new AnalyticsMicroserviceException(
          `Microservice returned ${response.status}: ${response.statusText}`,
        );
      }

      if (!response.body) {
        throw new AnalyticsRepositoryException(
          'Microservice response body is empty',
        );
      }

      // Преобразуем Web ReadableStream в Node.js Readable
      const nodeStream = Readable.fromWeb(response.body as any);

      // Отслеживаем поток данных для метрик
      this.attachMetricsTracking(nodeStream, correlationId);

      return nodeStream;
    } catch (error) {
      this.logger.error(
        `Stream request failed [${correlationId}]: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );

      // Очищаем метрики при ошибке
      if (this.metrics[correlationId]) {
        this.metrics[correlationId].isActive = false;
      }

      if (error instanceof AnalyticsMicroserviceException) {
        throw error;
      }

      throw new AnalyticsMicroserviceException(
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error : undefined,
      );
    }
  }

  getStreamMetrics(correlationId: string): StreamMetrics | null {
    return this.metrics[correlationId] || null;
  }

  private buildStreamUrl(metadata: ExportMetadata): string {
    const url = new URL(`${this.MICROSERVICE_URL}/internal/analytics/stream`);

    // Добавляем параметры фильтрации в query string
    if (metadata.filters.startDate) {
      url.searchParams.append(
        'startDate',
        metadata.filters.startDate.toISOString(),
      );
    }
    if (metadata.filters.endDate) {
      url.searchParams.append(
        'endDate',
        metadata.filters.endDate.toISOString(),
      );
    }
    if (metadata.filters.userId) {
      url.searchParams.append('userId', metadata.filters.userId);
    }
    if (metadata.filters.action) {
      url.searchParams.append('action', metadata.filters.action);
    }

    return url.toString();
  }

  private attachMetricsTracking(
    stream: Readable,
    correlationId: string,
  ): void {
    const metrics = this.metrics[correlationId];
    if (!metrics) return;

    stream.on('data', (chunk: Buffer) => {
      metrics.bytesTransferred += chunk.length;
    });

    stream.on('pause', () => {
      metrics.isPaused = true;
    });

    stream.on('resume', () => {
      metrics.isPaused = false;
    });

    stream.on('end', () => {
      metrics.isActive = false;
      this.logger.debug(
        `Stream completed [${correlationId}]: ${metrics.bytesTransferred} bytes transferred`,
      );
    });

    stream.on('error', (error) => {
      metrics.isActive = false;
      this.logger.error(
        `Stream error [${correlationId}]: ${error.message}`,
      );
    });
  }
}
