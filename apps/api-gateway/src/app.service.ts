// apps/api-gateway/src/app.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { IAnalyticsDashboardResponse } from 'ai/shared';

@Injectable()
export class AppService {
  constructor(
    @Inject('ANALYTICS_SERVICE') private readonly analyticsClient: ClientProxy,
  ) {}

  async getDashboardData(
    userId: number,
    period?: string,
  ): Promise<IAnalyticsDashboardResponse> {
    const pattern = 'get_analytics_dashboard';
    const payload = { userId, period };

    return await firstValueFrom(
      this.analyticsClient.send<IAnalyticsDashboardResponse>(pattern, payload),
    );
  }
}
