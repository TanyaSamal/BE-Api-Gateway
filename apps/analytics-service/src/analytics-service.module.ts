import { Module } from '@nestjs/common';
import { AnalyticsServiceController } from './analytics-service.controller';
import { AnalyticsServiceService } from './analytics-service.service';
import { AppLogger, CorrelationContextService } from 'ai/shared';
import { AnalyticsInternalController } from './analytics-internal.controller';

@Module({
  imports: [],
  controllers: [AnalyticsServiceController, AnalyticsInternalController],
  providers: [AnalyticsServiceService, AppLogger, CorrelationContextService],
})
export class AnalyticsServiceModule {}
