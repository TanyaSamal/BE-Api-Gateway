import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { AppLogger } from '@ai/shared';

// Zod-схема строгого контракта ответа от LLM
export const SubtaskBreakdownSchema = z.object({
  subtasks: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        estimatedMinutes: z.number().int().min(5).max(10080),
      }),
    )
    .min(2)
    .max(7),
});

export type SubtaskBreakdownItem = z.infer<
  typeof SubtaskBreakdownSchema
>['subtasks'][number];

@Injectable()
export class TaskBreakdownService {
  constructor(private readonly logger: AppLogger) {}

  async generateSubtasks(goal: string): Promise<SubtaskBreakdownItem[]> {
    const apiKey = process.env.AI_PROVIDER_API_KEY?.trim();
    if (!apiKey) {
      throw new InternalServerErrorException(
        'Переменная OPENROUTER_API_KEY не найдена в process.env',
      );
    }

    const openrouter = createOpenAI({
      baseURL: process.env.AI_PROVIDER_BASE_URL,
      apiKey,
      headers: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'NestJS Microservices Task Breakdown',
      },
    });

    const modelName = process.env.AI_PROVIDER_MODEL || 'openrouter/free';

    this.logger.log(
      `[AI Breakdown] Отправляем цель в OpenRouter (${modelName})...`,
      'TaskBreakdownService',
    );

    try {
      const { text } = await generateText({
        model: openrouter.chat(modelName),
        system: `Ты опытный технический тимлид. Разбей цель пользователя на 3–6 конкретных подзадач с оценкой времени в минутах.
        Ответь СТРОГО валидным JSON-объектом без markdown-разметки и пояснений в следующем формате:
        {
          "subtasks": [
            {
              "title": "Название задачи",
              "description": "Описание шагов",
              "estimatedMinutes": 30
            }
          ]
        }`,
        prompt: `Цель пользователя: ${goal}`,
      });

      // Извлекаем JSON из ответа (на случай, если reasoning-модель обернула его в ```json ... ```)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`Модель не вернула JSON: ${text.slice(0, 150)}`);
      }

      const rawParsed: unknown = JSON.parse(jsonMatch[0]);

      // Строгая валидация структуры и типов через Zod
      const validated = SubtaskBreakdownSchema.parse(rawParsed);
      return validated.subtasks;
    } catch (error) {
      const details =
        error?.responseBody || error?.message || 'Unknown AI error';
      this.logger.error(
        `[AI Breakdown] Ошибка генерации через OpenRouter: ${details}`,
        'TaskBreakdownService',
      );
      throw new InternalServerErrorException(
        `Не удалось выполнить AI-декомпозицию цели: ${details}`,
      );
    }
  }
}
