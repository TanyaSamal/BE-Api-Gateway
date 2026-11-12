import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AppLogger } from 'ai/shared';

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

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
