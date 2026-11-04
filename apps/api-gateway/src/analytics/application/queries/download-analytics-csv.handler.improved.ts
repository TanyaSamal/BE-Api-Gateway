import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Readable } from 'stream';
import { Logger } from '@nestjs/common';

import { DownloadAnalyticsCsvQuery } from './download-analytics-csv.query.improved';
import { AnalyticsExportService } from '../services/analytics-export.service';
import { CorrelationContextService } from 'ai/shared';
import { AnalyticsDownloadException } from '../../domain/exceptions/analytics.exceptions';

@QueryHandler(DownloadAnalyticsCsvQuery)
export class DownloadAnalyticsCsvHandler implements IQueryHandler<
  DownloadAnalyticsCsvQuery,
  Readable
> {
  private readonly logger = new Logger(DownloadAnalyticsCsvHandler.name);

  constructor(
    private readonly exportService: AnalyticsExportService,
    private readonly contextService: CorrelationContextService,
  ) {}

  async execute(query: DownloadAnalyticsCsvQuery): Promise<Readable> {
    const correlationId =
      this.contextService.getCorrelationId() || `fallback-${Date.now()}`;

    this.logger.log(
      `Processing CSV export query [${correlationId}] with filters: ${JSON.stringify(
        query.metadata.filters,
      )}`,
    );

    try {
      const { stream, cleanupFn } =
        await this.exportService.createCsvExportStream(
          query.metadata,
          correlationId,
        );

      stream.on('end', () => {
        this.logger.debug(`Export stream ended [${correlationId}]`);
        cleanupFn();
      });

      stream.on('error', (error) => {
        this.logger.error(
          `Export stream error [${correlationId}]: ${error.message}`,
        );
        cleanupFn();
      });

      return stream;
    } catch (error) {
      this.logger.error(
        `Failed to process export query [${correlationId}]: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );

      if (error instanceof AnalyticsDownloadException) {
        throw error;
      }

      throw new AnalyticsDownloadException(
        error instanceof Error
          ? error.message
          : 'Failed to process export request',
      );
    }
  }
}
