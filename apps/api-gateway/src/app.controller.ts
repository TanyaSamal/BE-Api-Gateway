import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { pipeline } from 'stream/promises';
import { AppService } from './app.service';
import { GetAnalyticsDashboardDto, RedisCacheInterceptor } from 'ai/shared';
import { TrackEventDto } from 'ai/shared/dto/track-event.dto';
import { DownloadAnalyticsCsvQuery } from './analytics/application/queries/download-analytics-csv.query';
import { NdjsonParseTransform } from './analytics/infrastructure/streams/ndjson-parse.transform';
import { AnalyticsCsvTransform } from './analytics/infrastructure/streams/analytics-csv.transform';
import { QueryBus } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import { WorkerPoolService } from './worker-pool/worker-pool.service';
import { MetricsService } from 'ai/shared/services/metrics.service';

@Controller('analytics')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly queryBus: QueryBus,
    private readonly workerPool: WorkerPoolService,
    private readonly metricsService: MetricsService,
  ) {}

  @UseInterceptors(RedisCacheInterceptor)
  @Get('dashboard')
  async getAnalyticsDashboard(@Query() query: GetAnalyticsDashboardDto) {
    const result = await this.appService.getDashboardData(
      query.userId,
      query.period,
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post('track')
  trackUserAction(@Body() body: TrackEventDto) {
    this.appService.sendEventToQueue(body);

    return {
      success: true,
      message: 'Событие успешно принято и отправлено на обработку в бэкграунд',
    };
  }

  @Get('download/csv')
  async downloadCsv(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="analytics_${Date.now()}.csv"`,
    );
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
      const microserviceStream = await this.queryBus.execute<
        DownloadAnalyticsCsvQuery,
        Readable
      >(new DownloadAnalyticsCsvQuery());

      const ndjsonParser = new NdjsonParseTransform();
      const csvTransformer = new AnalyticsCsvTransform();

      await pipeline(microserviceStream, ndjsonParser, csvTransformer, res);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Ошибка сборки отчета',
          error: (error as Error).message,
        });
      }
    }
  }

  // Тяжелый эндпоинт (выполняется 3 секунды в фоне)
  @Get('heavy-report')
  async getHeavyReport(@Query('client') client: string) {
    const reportId = uuidv4();

    console.log(`[Main Thread] Старт тяжелой задачи для ${client}...`);

    const result = await this.workerPool.runHeavyTask({
      reportId,
      clientName: client || 'Анонимный клиент',
    });

    console.log(`[Main Thread] Тяжелая задача ${reportId} успешно завершена!`);

    return result;
  }

  // Легкий эндпоинт для проверки отзывчивости (мгновенный)
  @Get('ping')
  getPing() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('metrics')
  async getMetrics(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const metrics = await this.metricsService.getMetrics();
    res.send(metrics);
  }
}
