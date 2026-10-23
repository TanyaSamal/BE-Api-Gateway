import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { GetAnalyticsDashboardDto } from 'ai/shared';

@Controller('analytics')
export class AppController {
  constructor(private readonly appService: AppService) {}

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
}
