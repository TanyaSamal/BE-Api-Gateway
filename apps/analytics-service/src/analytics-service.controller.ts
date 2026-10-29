import { Controller } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  MessagePattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import {
  AppLogger,
  CorrelationContextService,
  GetAnalyticsDashboardDto,
  IAnalyticsDashboardResponse,
  TrackEventDto,
} from 'ai/shared';
import { AnalyticsServiceService } from './analytics-service.service';
import { Message } from 'amqplib';

@Controller()
export class AnalyticsServiceController {
  constructor(
    private readonly analyticsServiceService: AnalyticsServiceService,
    private readonly contextService: CorrelationContextService,
    private readonly logger: AppLogger,
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
  handleTrackAction(
    @Payload() data: TrackEventDto,
    @Ctx() context: RmqContext,
  ) {
    // Вытаскиваем свойства сообщения из RabbitMQ контекста
    const rawMessage = context.getMessage() as Message;
    const headers = rawMessage.properties?.headers || {};
    // Ищем наш ID внутри переданных данных или свойств пакета
    const correlationId =
      (headers['x-correlation-id'] as string) || 'unknown-rmq-id';

    // Инициализируем контекст логирования внутри микросервиса аналитики
    this.contextService.run(correlationId, () => {
      this.logger.log(
        `[Микросервис] Успешно перехвачен пакет из очереди!`,
        'AnalyticsController',
      );

      // Имитируем тяжелую бизнес-логику
      this.logger.log(
        `Обрабатываем аналитику для пользователя #${data.userId}...`,
        'AnalyticsService',
      );
    });

    this.analyticsServiceService.logEvent(data);
  }
}
