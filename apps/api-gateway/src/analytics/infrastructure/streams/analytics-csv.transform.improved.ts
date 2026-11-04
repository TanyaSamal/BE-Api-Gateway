/**
 * Analytics CSV Transform Stream (Improved)
 *
 * Трансформирует объекты логов в CSV-строки.
 * Поддерживает конфигурируемый маппинг полей и правильную обработку специальных символов.
 * Отслеживает метрики потока (количество строк, размер в памяти).
 */

import { Transform, TransformCallback } from 'stream';
import {
  CsvFormatConfig,
  DEFAULT_CSV_CONFIG,
} from './csv-format-config';
import { AnalyticsLogParsingException } from '../../domain/exceptions/analytics.exceptions';
import { Logger } from '@nestjs/common';

export interface CsvTransformMetrics {
  linesProcessed: number;
  bytesOutput: number;
  errorCount: number;
  lastError?: Error;
}

export class AnalyticsCsvTransform extends Transform {
  private isFirstChunk = true;
  private lineCount = 0;
  private byteCount = 0;
  private errorCount = 0;
  private readonly logger = new Logger(AnalyticsCsvTransform.name);
  private readonly config: CsvFormatConfig;

  constructor(config: CsvFormatConfig = DEFAULT_CSV_CONFIG) {
    super({
      objectMode: true,
      highWaterMark: 16 * 1024, // 16KB buffer
    });
    this.config = config;
  }

  /**
   * Получить метрики трансформации
   */
  getMetrics(): CsvTransformMetrics {
    return {
      linesProcessed: this.lineCount,
      bytesOutput: this.byteCount,
      errorCount: this.errorCount,
    };
  }

  /**
   * Экранирование значения для CSV
   * Обрабатывает кавычки, запятые, переносы строк, и другие спецсимволы
   */
  private escapeCsvValue(val: any): string {
    if (val === null || val === undefined) return '';

    const str =
      typeof val === 'object'
        ? JSON.stringify(val)
        : String(val).trim();

    // Проверяем, нужно ли экранировать
    const needsEscaping =
      str.includes('"') ||
      str.includes(',') ||
      str.includes('\n') ||
      str.includes('\r') ||
      str.includes('\t');

    if (!needsEscaping) return str;

    // Оборачиваем в кавычки и экранируем внутренние кавычки
    return `"${str.replace(/"/g, '""')}"`;
  }

  /**
   * Форматирование строки CSV
   */
  private formatCsvLine(data: Record<string, any>): string {
    try {
      const values = this.config.columns.map((col) => {
        const value = col.getter(data);
        return this.escapeCsvValue(value);
      });

      return values.join(this.config.delimiter);
    } catch (error) {
      this.errorCount++;
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown formatting error';
      throw new AnalyticsLogParsingException(
        `Failed to format CSV line: ${message}`,
        this.lineCount + 1,
      );
    }
  }

  /**
   * Трансформация чанка данных
   */
  _transform(
    chunk: any,
    encoding: string,
    callback: TransformCallback,
  ): void {
    try {
      const rows: string[] = [];

      // Добавляем заголовок в первый чанк
      if (this.isFirstChunk && this.config.includeHeader) {
        const headers = this.config.columns.map((col) => col.label);
        rows.push(headers.join(this.config.delimiter));
        this.isFirstChunk = false;
      }

      // Форматируем данные логов в CSV
      const csvLine = this.formatCsvLine(chunk);
      rows.push(csvLine);
      this.lineCount++;

      // Объединяем строки с переносом
      const output = rows.join(this.config.lineEnding) + this.config.lineEnding;

      // Отслеживаем размер вывода
      this.byteCount += Buffer.byteLength(output, 'utf-8');

      // Пушим данные в следующий стрим
      this.push(output);

      callback();
    } catch (error) {
      this.errorCount++;
      this.logger.error(
        `Transform error at line ${this.lineCount}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      callback(error as Error);
    }
  }

  /**
   * Финализация потока
   */
  _flush(callback: TransformCallback): void {
    try {
      this.logger.debug(
        `CSV Transform completed: ${this.lineCount} lines, ${this.byteCount} bytes, ${this.errorCount} errors`,
      );
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }
}
