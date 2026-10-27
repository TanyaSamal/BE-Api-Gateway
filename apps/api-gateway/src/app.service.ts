import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { IAnalyticsDashboardResponse, TrackEventDto } from 'ai/shared';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class AppService {
  constructor(
    @Inject('ANALYTICS_SERVICE') private readonly analyticsClient: ClientProxy,
  ) {}

  async getDashboardData(
    userId: number,
    period?: string,
  ): Promise<IAnalyticsDashboardResponse> {
    console.log('Начало выполнения "тяжелого" запроса к микросервису...');

    await delay(3000);

    const pattern = 'get_analytics_dashboard';
    const payload = { userId, period };

    return await firstValueFrom(
      this.analyticsClient.send<IAnalyticsDashboardResponse>(pattern, payload),
    );
  }

  sendEventToQueue(eventDto: TrackEventDto) {
    const pattern = 'track_action'; // Должен совпадать с @EventPattern в микросервисе

    // Метод emit отправляет данные в RabbitMQ и НЕ ждет ответа от микросервиса.
    this.analyticsClient.emit(pattern, eventDto);
  }
}
