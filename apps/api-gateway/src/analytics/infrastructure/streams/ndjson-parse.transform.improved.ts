/**
 * NDJSON Parse Transform Stream (Improved)
 *
 * Парсит NDJSON поток в объекты.
 * Правильно обрабатывает неполные строки и ошибки парсинга.
 * Отслеживает метрики парсинга.
 */

import { Transform, TransformCallback } from 'stream';
import { AnalyticsLogParsingException } from '../../domain/exceptions/analytics.exceptions';
import { Logger } from '@nestjs/common';

export interface NdjsonParseMetrics {
  linesProcessed: number;
  linesParsed: number;
  failedLines: number;
  bufferedBytes: number;
}

export class NdjsonParseTransform extends Transform {
  private buffer = '';
  private lineNumber = 0;
  private parsedCount = 0;
  private failedCount = 0;
  private readonly logger = new Logger(NdjsonParseTransform.name);
  private readonly MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly MAX_LINE_LENGTH = 1024 * 1024; // 1MB per line

  constructor() {
    super({
      objectMode: true,
      highWaterMark: 16 * 1024,
    });
  }

  /**
   * Получить метрики парсинга
   */
  getMetrics(): NdjsonParseMetrics {
    return {
      linesProcessed: this.lineNumber,
      linesParsed: this.parsedCount,
      failedLines: this.failedCount,
      bufferedBytes: Buffer.byteLength(this.buffer, 'utf-8'),
    };
  }

  /**
   * Основная трансформация чанка
   */
  _transform(
    chunk: any,
    encoding: string,
    callback: TransformCallback,
  ): void {
    try {
      // Накапливаем данные из сети в буфер
      this.buffer += chunk.toString('utf-8');

      // Проверяем, не превышен ли размер буфера
      if (Buffer.byteLength(this.buffer, 'utf-8') > this.MAX_BUFFER_SIZE) {
        const error = new AnalyticsLogParsingException(
          `Buffer size exceeded ${this.MAX_BUFFER_SIZE} bytes`,
          this.lineNumber,
        );
        return callback(error);
      }

      // Обрабатываем строки в буфере
      this.processLines(callback);
    } catch (error) {
      this.logger.error(
        `Parse transform error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      callback(error as Error);
    }
  }

  /**
   * Финализация потока (обработка остатка буфера)
   */
  _flush(callback: TransformCallback): void {
    try {
      // Обрабатываем оставшиеся данные в буфере
      const trimmed = this.buffer.trim();
      if (trimmed.length > 0) {
        try {
          const parsedObject = JSON.parse(trimmed);
          this.push(parsedObject);
          this.parsedCount++;
        } catch (parseError) {
          this.failedCount++;
          const error = new AnalyticsLogParsingException(
            `Invalid JSON: ${
              parseError instanceof Error ? parseError.message : 'Unknown'
            }`,
            this.lineNumber,
          );
          return callback(error);
        }
      }

      this.logger.debug(
        `NDJSON parsing completed: ${this.parsedCount} lines parsed, ${this.failedCount} failed`,
      );
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  /**
   * Обработка строк в буфере
   */
  private processLines(callback: TransformCallback): void {
    const lines = this.buffer.split('\n');

    // Последний элемент может быть неполной строкой - оставляем в буфере
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      this.lineNumber++;
      const trimmed = line.trim();

      // Пропускаем пустые строки
      if (trimmed.length === 0) continue;

      // Проверяем размер строки
      if (Buffer.byteLength(trimmed, 'utf-8') > this.MAX_LINE_LENGTH) {
        this.failedCount++;
        this.logger.warn(
          `Line ${this.lineNumber} exceeds max length (${this.MAX_LINE_LENGTH} bytes)`,
        );
        continue;
      }

      // Парсим JSON
      try {
        const parsedObject = JSON.parse(trimmed);
        this.push(parsedObject);
        this.parsedCount++;
      } catch (parseError) {
        this.failedCount++;
        this.logger.warn(
          `Failed to parse line ${this.lineNumber}: ${
            parseError instanceof Error ? parseError.message : 'Unknown error'
          }`,
        );

        // Логируем первые 100 символов строки для дебага
        const preview = trimmed.substring(0, 100);
        this.logger.debug(`Failed line preview: ${preview}...`);

        // Не прерываем поток, продолжаем обработку
        // Можно также пушить ошибку или пропустить строку
      }
    }
  }
}
