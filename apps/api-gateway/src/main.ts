import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Автоматически преобразует типы данных на основе @Type
      whitelist: true, // Удаляет из query/body поля, которых нет в DTO
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
