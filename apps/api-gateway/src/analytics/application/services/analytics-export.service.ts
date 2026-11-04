/**
 * Application Service: Analytics Export Service
 *
 * Оркестрирует процесс экспорта логов аналитики.
 * Координирует взаимодействие Repository, Transform потоков и обработку ошибок.
 * Реализует бизнес-логику экспорта на уровне приложения.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { Readable, pipeline as streamPipeline } from 'stream';
import { promisify } from 'util';

import { ExportMetadata } from '../../domain/value-objects/export-metadata.vo';
import {
  IAnalyticsLogsRepository,
  ANALYTICS_LOGS_REPOSITORY,
} from '../../domain/repositories/analytics-logs.repository';
import { AnalyticsDownloadException } from '../../domain/exceptions/analytics.exceptions';

import { NdjsonParseTransform } from '../../infrastructure/streams/ndjson-parse.transform.improved';
import { AnalyticsCsvTransform } from '../../infrastructure/streams/analytics-csv.transform.improved';
import {
  CsvFormatConfig,
  DEFAULT_CSV_CONFIG,
} from '../../infrastructure/streams/csv-format-config';

export interface ExportResult {
  success: boolean;
  correlationId: string;
  rowsProcessed: number;
  bytesTransferred: number;
  durationMs: number;
  format: string;
}

@Injectable()
export class AnalyticsExportService {
  private readonly logger = new Logger(AnalyticsExportService.name);

  constructor(
    @Inject(ANALYTICS_LOGS_REPOSITORY)
    private readonly analyticsRepository: IAnalyticsLogsRepository,
  ) {}

  /**
   * Создать экспортный поток в CSV формате
   *
   * @param metadata Параметры экспорта (фильтры, формат, и т.д.)
   * @param correlationId ID для отслеживания запроса
   * @returns Readable поток CSV данных
   * @throws AnalyticsDownloadException, AnalyticsRepositoryException
   */
  async createCsvExportStream(
    metadata: ExportMetadata,
    correlationId: string,
  ): Promise<{
    stream: Readable;
    cleanupFn: () => void;
  }> {
    try {
      this.logger.log(
        `Creating CSV export stream [${correlationId}] with metadata: ${JSON.stringify(
          metadata.toJSON(),
        )}`,
      );

      // 1. Получаем поток логов из репозитория
      const microserviceStream = await this.analyticsRepository.streamLogs(
        metadata,
        correlationId,
      );

      // 2. Инициализируем трансформеры
      const ndjsonParser = new NdjsonParseTransform();
      const csvTransformer = new AnalyticsCsvTransform(
        this.getCsvConfig(metadata),
      );

      // 3. Создаем готовый поток
      const exportStream = this.createPipeline(
        microserviceStream,
        ndjsonParser,
        csvTransformer,
      );

      // Отслеживаем прогресс
      this.attachProgressTracking(
        microserviceStream,
        ndjsonParser,
        csvTransformer,
        correlationId,
      );

      const cleanupFn = () => {
        this.logger.debug(`Cleaning up export stream [${correlationId}]`);
        microserviceStream.destroy();
        ndjsonParser.destroy();
        csvTransformer.destroy();
      };

      return {
        stream: exportStream,
        cleanupFn,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create export stream [${correlationId}]: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );

      if (error instanceof Error && error.message.includes('Microservice')) {
        throw error;
      }

      throw new AnalyticsDownloadException(
        error instanceof Error
          ? error.message
          : 'Failed to initialize export stream',
      );
    }
  }

  /**
   * Получить конфигурацию CSV на основе метаданных
   */
  private getCsvConfig(metadata: ExportMetadata): CsvFormatConfig {
    // Можно кастомизировать конфигурацию на основе metadata
    return DEFAULT_CSV_CONFIG;
  }

  /**
   * Создать pipeline поток с обработкой ошибок
   */
  private createPipeline(...streams: Readable[]): Readable {
    // Возвращаем последний поток в цепочке (он же будет входом для клиента)
    return streams[streams.length - 1];
  }

  /**
   * Подключить отслеживание прогресса
   */
  private attachProgressTracking(
    microserviceStream: Readable,
    ndjsonParser: NdjsonParseTransform,
    csvTransformer: AnalyticsCsvTransform,
    correlationId: string,
  ): void {
    let lastLogTime = Date.now();
    let lastByteCount = 0;

    const logProgress = () => {
      const now = Date.now();
      if (now - lastLogTime > 5000) {
        // Логируем каждые 5 секунд
        const ndjsonMetrics = ndjsonParser.getMetrics();
        const csvMetrics = csvTransformer.getMetrics();
        const throughput = (
          (csvMetrics.bytesOutput - lastByteCount) /
          ((now - lastLogTime) / 1000)
        ).toFixed(2);

        this.logger.debug(
          `Export progress [${correlationId}]: ${ndjsonMetrics.linesParsed} lines parsed, ${csvMetrics.linesProcessed} CSV lines, ${throughput} bytes/sec`,
        );

        lastLogTime = now;
        lastByteCount = csvMetrics.bytesOutput;
      }
    };

    // Отслеживаем данные
    csvTransformer.on('data', () => {
      logProgress();
    });

    csvTransformer.on('end', () => {
      const ndjsonMetrics = ndjsonParser.getMetrics();
      const csvMetrics = csvTransformer.getMetrics();
      this.logger.log(
        `Export completed [${correlationId}]: ${csvMetrics.linesProcessed} lines exported, ${csvMetrics.bytesOutput} bytes, errors: ${csvMetrics.errorCount}`,
      );
    });

    csvTransformer.on('error', (error) => {
      this.logger.error(`Export error [${correlationId}]: ${error.message}`);
    });
  }
}
