import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  GetAnalyticsDashboardDto,
  IAnalyticsDashboardResponse,
} from 'ai/shared';
import { AnalyticsServiceService } from './analytics-service.service';

@Controller()
export class AnalyticsServiceController {
  constructor(
    private readonly analyticsServiceService: AnalyticsServiceService,
  ) {}

  @MessagePattern('get_analytics_dashboard')
  getDashboardData(
    @Payload() data: GetAnalyticsDashboardDto,
  ): IAnalyticsDashboardResponse {
    return this.analyticsServiceService.getAnalyticsData(
      data.userId,
      data.period,
    );
  }
}
