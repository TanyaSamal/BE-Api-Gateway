import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { AppService } from './app.service';
import { GetAnalyticsDashboardDto, RedisCacheInterceptor } from 'ai/shared';
import { TrackEventDto } from 'ai/shared/dto/track-event.dto';

@Controller('analytics')
export class AppController {
  constructor(private readonly appService: AppService) {}

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
}
