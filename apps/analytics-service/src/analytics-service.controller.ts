import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import {
  GetAnalyticsDashboardDto,
  IAnalyticsDashboardResponse,
  TrackEventDto,
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

  @EventPattern('track_action')
  handleTrackAction(@Payload() data: TrackEventDto) {
    this.analyticsServiceService.logEvent(data);
  }
}
