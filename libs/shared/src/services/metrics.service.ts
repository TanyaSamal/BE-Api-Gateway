import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  public readonly httpRequestsCounter: Counter<string>;
  public readonly httpRequestDurationHistogram: Histogram<string>;

  constructor() {
    this.registry = new Registry();

    // 1. Счетчик запросов с разделением по методу, урлу и статус-коду
    this.httpRequestsCounter = new Counter({
      name: 'http_requests_total',
      help: 'Общее количество HTTP запросов',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    // 2. Гистограмма распределения времени ответа (в секундах)
    this.httpRequestDurationHistogram = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Время ответа HTTP запросов в секундах',
      labelNames: ['method', 'route'],
      // Бакеты для SLA: 5мс, 10мс, 50мс, 100мс, 200мс (наш порог!), 500мс, 1с, 2с
      buckets: [0.005, 0.01, 0.05, 0.1, 0.2, 0.5, 1, 2],
      registers: [this.registry],
    });
  }

  // Метод для Prometheus, который будет забирать текстовый лог метрик
  public getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
