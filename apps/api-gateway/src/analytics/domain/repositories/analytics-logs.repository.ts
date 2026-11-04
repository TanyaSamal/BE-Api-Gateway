/**
 * Domain Repository Interface
 *
 * Определяет контракт для работы с хранилищем аналитических логов.
 * Обеспечивает абстракцию от источника данных (БД, микросервис, файл).
 */

import { Readable } from 'stream';
import { ExportMetadata } from '../value-objects/export-metadata.vo';

export interface IAnalyticsLogsRepository {
  /**
   * Получить поток логов для экспорта
   *
   * @param metadata - Метаданные экспорта (формат, фильтры, параметры)
   * @param correlationId - ID для отслеживания запроса
   * @returns Readable поток сырых логов в NDJSON формате
   * @throws AnalyticsRepositoryException
   */
  streamLogs(
    metadata: ExportMetadata,
    correlationId: string,
  ): Promise<Readable>;

  /**
   * Получить метрики потока
   * Может использоваться для мониторинга
   */
  getStreamMetrics(correlationId: string): StreamMetrics | null;
}

export interface StreamMetrics {
  correlationId: string;
  startTime: Date;
  rowsProcessed: number;
  bytesTransferred: number;
  currentMemoryUsage: number;
  isPaused: boolean;
  isActive: boolean;
}

export const ANALYTICS_LOGS_REPOSITORY = Symbol('IAnalyticsLogsRepository');
