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

@Controller('analytics')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly queryBus: QueryBus,
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

  // НАШ НОВЫЙ ЭНДПОИНТ (Кэширование тут НЕ используем!)
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
}
