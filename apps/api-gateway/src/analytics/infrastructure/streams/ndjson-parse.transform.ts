import { Transform, TransformCallback } from 'stream';

export class NdjsonParseTransform extends Transform {
  private buffer = '';

  constructor() {
    // objectMode: true нужен, так как на выходе мы отдаем объекты, а не строки
    super({ objectMode: true });
  }

  _transform(chunk: any, encoding: string, callback: TransformCallback): void {
    try {
      // Накапливаем данные из сети в текстовый буфер
      this.buffer += chunk.toString('utf8');

      const lines = this.buffer.split('\n');

      // Забираем последний (возможно, неполный) кусок строки обратно в буфер
      this.buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Парсим строку в объект и пушим дальше по конвейеру
        const parsedObject = JSON.parse(trimmed);
        this.push(parsedObject);
      }

      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  _flush(callback: TransformCallback): void {
    try {
      // Обрабатываем остаток в буфере, если поток завершился, а переноса строки в конце не было
      const trimmed = this.buffer.trim();
      if (trimmed) {
        const parsedObject = JSON.parse(trimmed);
        this.push(parsedObject);
      }
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }
}
