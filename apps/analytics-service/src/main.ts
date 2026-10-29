import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AnalyticsServiceModule } from './analytics-service.module';
import { ANALYTICS_QUEUE, AppLogger } from 'ai/shared';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AnalyticsServiceModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://localhost:5672'], // URL нашего Docker-контейнера RabbitMQ
        queue: ANALYTICS_QUEUE,
        queueOptions: {
          durable: true // Очередь не пропадет при перезапуске RabbitMQ
        },
      },
    },
  );

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  await app.listen();
  console.log('Analytics Microservice запущен и слушает очередь RabbitMQ');
}
bootstrap();
