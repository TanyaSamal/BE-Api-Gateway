import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AnalyticsServiceModule } from './analytics-service.module';
import { ANALYTICS_QUEUE, AppLogger } from 'ai/shared';

async function bootstrap() {
  // 1. Создаем обычное NestJS приложение (оно будет слушать HTTP)
  const app = await NestFactory.create(AnalyticsServiceModule);

  // 2. Подключаем к нему микросервис RabbitMQ (как гибридную часть)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://localhost:5672'], // URL нашего Docker-контейнера RabbitMQ
      queue: ANALYTICS_QUEUE,
      queueOptions: { durable: true }, // Очередь не пропадет при перезапуске RabbitMQ
      socketOptions: {
        heartbeatIntervalInSeconds: 5,
        reconnectTimeInSeconds: 5,
      },
    },
  });

  // 3. Запускаем микросервисы
  await app.startAllMicroservices();

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  await app.listen(3002);
  console.log(
    'Analytics Service успешно запущен в гибридном режиме! HTTP на порту 3002, RMQ на 5672.',
  );
}
bootstrap();
