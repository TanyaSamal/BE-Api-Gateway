process.loadEnvFile?.();

import { NestFactory } from '@nestjs/core';

import { initTracing } from '@ai/shared';
initTracing('api-gateway');

import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AppLogger, RedisIoAdapter } from '@ai/shared';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Автоматически преобразует типы данных на основе @Type
      whitelist: true, // Удаляет из query/body поля, которых нет в DTO
    }),
  );

  app.enableCors({
    origin: 'http://localhost:3000',
    exposedHeaders: ['x-correlation-id'], // Важно, чтобы фронтенд мог прочитать ID трассировки из ответа
  });

  const redisIoAdapter = new RedisIoAdapter(app);
  redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  // Конфигурация Swagger
  const config = new DocumentBuilder()
    .setTitle('Task & Analytics Monorepo API')
    .setDescription(
      'CQRS, Event Sourcing, Outbox, Circuit Breaker & AI Decomposition API',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-user-id', in: 'header' }, 'x-user-id')
    .addApiKey(
      { type: 'apiKey', name: 'x-user-role', in: 'header' },
      'x-user-role',
    )
    .addApiKey(
      { type: 'apiKey', name: 'x-correlation-id', in: 'header' },
      'x-correlation-id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
