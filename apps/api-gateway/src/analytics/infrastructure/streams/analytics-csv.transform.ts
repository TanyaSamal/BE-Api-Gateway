import { Transform, TransformCallback } from 'stream';

export class AnalyticsCsvTransform extends Transform {
  private isFirstChunk = true;

  constructor() {
    // Вход: объекты (objectMode), Выход: строки/буферы CSV
    super({ objectMode: true });
  }

  // Защита CSV от ломаных строк, если в payload встретятся кавычки или запятые
  private escapeCsvValue(val: any): string {
    if (val === null || val === undefined) return '';

    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);

    if (
      str.includes('"') ||
      str.includes(',') ||
      str.includes('\n') ||
      str.includes('\r')
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  _transform(chunk: any, encoding: string, callback: TransformCallback): void {
    try {
      const rows: string[] = [];

      // Шапка файла при самом первом чанке
      if (this.isFirstChunk) {
        const headers = ['Correlation ID', 'Action', 'Payload', 'Timestamp'];
        rows.push(headers.join(','));
        this.isFirstChunk = false;
      }

      // Маппим пришедший in-memory лог на структуру колонок
      const values = [
        chunk.correlationId,
        chunk.action,
        chunk.payload,
        chunk.createdAt,
      ];

      const csvLine = values.map((val) => this.escapeCsvValue(val)).join(',');
      rows.push(csvLine);

      // Отправляем готовую CSV-строку дальше в Express Response
      this.push(rows.join('\r\n') + '\r\n');
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }
}
