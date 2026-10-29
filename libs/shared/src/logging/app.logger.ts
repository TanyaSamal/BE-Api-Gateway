import { Injectable, LoggerService } from '@nestjs/common';
import { CorrelationContextService } from './correlation-context.service';

@Injectable()
export class AppLogger implements LoggerService {
  constructor(private readonly contextService: CorrelationContextService) {}

  log(message: any, context?: string) {
    const id = this.contextService.getCorrelationId();
    const idPrefix = id ? `[ID: ${id}] ` : '';
    console.log(
      `\x1b[32m[Log]${context ? ` [${context}]` : ''} ${idPrefix}${message}\x1b[0m`,
    );
  }

  error(message: any, trace?: string) {
    const id = this.contextService.getCorrelationId();
    const idPrefix = id ? `[ID: ${id}] ` : '';
    console.error(`\x1b[31m[Error] ${idPrefix}${message}\x1b[0m`, trace || '');
  }

  warn(message: any) {
    const id = this.contextService.getCorrelationId();
    console.warn(`[Warn] [ID: ${id || 'N/A'}] ${message}`);
  }
}
