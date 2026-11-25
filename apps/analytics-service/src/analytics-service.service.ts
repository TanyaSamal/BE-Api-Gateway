import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { IAnalyticsDashboardResponse, TrackEventDto } from '@ai/shared';

@Injectable()
export class AnalyticsServiceService {
  private isBroken = false; // Флаг для симуляции падения сервиса

  toggleChaos(): boolean {
    this.isBroken = !this.isBroken;
    return this.isBroken;
  }

  getAnalyticsData(
    userId: number,
    period: string = '7_days',
  ): IAnalyticsDashboardResponse {
    if (this.isBroken) {
      throw new RpcException('Simulated Analytics Service Failure');
    }

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

  logEvent(event: TrackEventDto) {
    console.log(
      `[БЕКГРАУНД ОБРАБОТКА] Получено событие от пользователя #${event.userId}`,
    );
    console.log(`Тип события: ${event.eventName}`);
    console.log(`Доп. свойства:`, event.properties || 'нет');
    console.log(`--- Событие успешно обработано в фоне ---`);
  }
}
