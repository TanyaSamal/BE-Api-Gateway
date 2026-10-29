import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CorrelationContextService } from 'ai/shared';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly contextService: CorrelationContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Берем ID из заголовков Angular или генерируем новый
    const correlationId =
      (req.headers['x-correlation-id'] as string) || uuidv4();

    // Добавляем в заголовки ответа для фронтенда
    res.setHeader('x-correlation-id', correlationId);

    // Запускаем контекст ALS, внутри которого будет крутиться весь запрос
    this.contextService.run(correlationId, () => {
      next();
    });
  }
}
