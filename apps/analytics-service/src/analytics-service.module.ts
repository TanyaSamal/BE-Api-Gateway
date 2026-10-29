import { Module } from '@nestjs/common';
import { AnalyticsServiceController } from './analytics-service.controller';
import { AnalyticsServiceService } from './analytics-service.service';
import { AppLogger, CorrelationContextService } from 'ai/shared';

@Module({
  imports: [],
  controllers: [AnalyticsServiceController],
  providers: [AnalyticsServiceService, AppLogger, CorrelationContextService],
})
export class AnalyticsServiceModule {}
