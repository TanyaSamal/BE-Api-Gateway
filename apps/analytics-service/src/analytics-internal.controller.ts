// apps/analytics-service/src/analytics-internal.controller.ts
import { Controller, Get, Res } from '@nestjs/common';
import { TRACK_ACTION } from 'ai/shared';
import { Response } from 'express';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';

@Controller('internal/analytics')
export class AnalyticsInternalController {
  // Наш in-memory генератор (имитация курсора)
  private async *generateInMemoryLogs(): AsyncGenerator<string, void, unknown> {
    const totalRecords = 100000;
    const batchSize = 1000;

    for (let i = 0; i < totalRecords; i += batchSize) {
      await new Promise((resolve) => setImmediate(resolve));

      for (let j = 0; j < batchSize; j++) {
        const recordIndex = i + j;
        const log = {
          correlationId: `corr-id-${recordIndex}-${uuidv4()}`,
          action: TRACK_ACTION,
          payload: `Mock user log info for index ${recordIndex}`,
          createdAt: new Date().toISOString(),
        };

        yield JSON.stringify(log) + '\n';
      }
    }
  }

  @Get('stream')
  async streamLogs(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');

    const logStream = Readable.from(this.generateInMemoryLogs());

    try {
      // pipeline сам закроет стримы и обработает ошибки/обрывы сети.
      await pipeline(logStream, res);
    } catch (error) {
      console.error(
        'Ошибка во время стриминга логов из микросервиса:',
        error.message,
      );
      // Если клиент отменил запрос, pipeline выбросит ошибку ERR_STREAM_PREMATURE_CLOSE
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
  }
}
