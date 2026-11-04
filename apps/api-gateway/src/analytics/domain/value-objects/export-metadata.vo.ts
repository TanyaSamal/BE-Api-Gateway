/**
 * Domain Value Object: Export Metadata
 *
 * Описывает метаданные экспорта (формат, фильтры, параметры).
 * Инкапсулирует специфику выгрузки аналитики.
 */

export type ExportFormat = 'csv' | 'json' | 'ndjson';

export interface ExportFilterParams {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: string;
}

export class ExportMetadata {
  readonly format: ExportFormat;
  readonly filters: ExportFilterParams;
  readonly pageSize: number;
  readonly highWaterMark: number; // Для Stream backpressure
  readonly charset: string;

  constructor(
    format: ExportFormat = 'csv',
    filters: ExportFilterParams = {},
    pageSize: number = 1000,
    highWaterMark: number = 16 * 1024, // 16KB по умолчанию
    charset: string = 'utf-8',
  ) {
    this.validatePageSize(pageSize);
    this.validateHighWaterMark(highWaterMark);

    this.format = format;
    this.filters = filters;
    this.pageSize = pageSize;
    this.highWaterMark = highWaterMark;
    this.charset = charset;
  }

  private validatePageSize(size: number): void {
    if (size < 1 || size > 10000) {
      throw new Error(
        'Export pageSize must be between 1 and 10000, got: ' + size,
      );
    }
  }

  private validateHighWaterMark(mark: number): void {
    if (mark < 1024 || mark > 10 * 1024 * 1024) {
      // 1KB - 10MB
      throw new Error(
        'Export highWaterMark must be between 1KB and 10MB, got: ' + mark,
      );
    }
  }

  hasFilters(): boolean {
    return Object.keys(this.filters).length > 0;
  }

  toJSON() {
    return {
      format: this.format,
      filters: this.filters,
      pageSize: this.pageSize,
      highWaterMark: this.highWaterMark,
      charset: this.charset,
    };
  }
}
