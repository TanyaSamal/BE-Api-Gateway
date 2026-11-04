import {
  Controller,
  Get,
  Res,
  Query,
  Logger,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Response } from 'express';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import { DownloadAnalyticsCsvQuery } from '../queries/download-analytics-csv.query.improved';
import { ExportMetadata } from '../../domain/value-objects/export-metadata.vo';
import { AnalyticsDomainException } from '../../domain/exceptions/analytics.exceptions';

@Controller('analytics/export')
export class AnalyticsExportController {
  private readonly logger = new Logger(AnalyticsExportController.name);

  constructor(private readonly queryBus: QueryBus) {}

  @Get('csv')
  @HttpCode(200)
  async downloadCsv(
    @Res() res: Response,
    @Query('pageSize') pageSize?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ): Promise<void> {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.logger.log(
      `CSV download requested [${requestId}] with filters: userId=${userId}, action=${action}`,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="analytics_${Date.now()}.csv"`,
    );
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    try {
      const metadata = this.parseExportMetadata(
        pageSize,
        startDate,
        endDate,
        userId,
        action,
      );

      const csvStream = await this.queryBus.execute<
        DownloadAnalyticsCsvQuery,
        Readable
      >(new DownloadAnalyticsCsvQuery(metadata, userId));

      await pipeline(csvStream, res);

      this.logger.log(`CSV download completed successfully [${requestId}]`);
    } catch (error) {
      if (res.headersSent) {
        this.logger.error(
          `Stream error after headers sent [${requestId}]: ${this.getErrorMessage(
            error,
          )}`,
        );
        res.end();
        return;
      }

      const statusCode = this.getErrorStatusCode(error);
      const errorMessage = this.getErrorMessage(error);

      this.logger.error(
        `Export request failed [${requestId}]: ${statusCode} - ${errorMessage}`,
      );

      res.status(statusCode).json({
        success: false,
        requestId,
        error: {
          message: errorMessage,
          code: this.getErrorCode(error),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private parseExportMetadata(
    pageSizeStr?: string,
    startDateStr?: string,
    endDateStr?: string,
    userId?: string,
    action?: string,
  ): ExportMetadata {
    try {
      const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 1000;
      const filters: Record<string, any> = {};

      if (startDateStr) {
        const startDate = new Date(startDateStr);
        if (isNaN(startDate.getTime())) {
          throw new BadRequestException(`Invalid startDate format: ${startDateStr}`);
        }
        filters.startDate = startDate;
      }

      if (endDateStr) {
        const endDate = new Date(endDateStr);
        if (isNaN(endDate.getTime())) {
          throw new BadRequestException(`Invalid endDate format: ${endDateStr}`);
        }
        filters.endDate = endDate;
      }

      if (userId) filters.userId = userId;
      if (action) filters.action = action;

      return new ExportMetadata('csv', filters, pageSize, 16 * 1024, 'utf-8');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Invalid query parameters: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private getErrorStatusCode(error: any): number {
    if (error instanceof BadRequestException) return 400;
    if (error instanceof AnalyticsDomainException) return error.statusCode;
    return 500;
  }

  private getErrorCode(error: any): string {
    if (error instanceof AnalyticsDomainException) return error.code;
    if (error instanceof BadRequestException) return 'BAD_REQUEST';
    return 'INTERNAL_ERROR';
  }

  private getErrorMessage(error: any): string {
    if (error instanceof Error) return error.message;
    return 'Unknown error occurred';
  }
}
