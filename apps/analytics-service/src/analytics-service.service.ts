import { Injectable } from '@nestjs/common';
import { IAnalyticsDashboardResponse } from 'ai/shared';

@Injectable()
export class AnalyticsServiceService {
  getAnalyticsData(
    userId: number,
    period: string = '7_days',
  ): IAnalyticsDashboardResponse {
    return {
      period: period,
      generatedAt: new Date().toISOString(),
      summary: {
        totalViews: 14500,
        clicks: 3200,
        conversionRate: '22%',
      },
      chartData: [
        { day: 'Mon', value: 400 },
        { day: 'Tue', value: 700 },
        { day: 'Wed', value: 600 },
      ],
      mockedForUser: userId,
    };
  }
}
