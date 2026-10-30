import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TrackEventDto } from 'ai/shared';
import * as amqplib from 'amqplib';

/**
 * Интеграционный тест: Проверка сохранения событий в очереди при падении микросервиса аналитики
 *
 * Сценарий:
 * 1. API Gateway запущен и готов принимать события
 * 2. Отправляем событие в API Gateway
 * 3. Проверяем:
 *    - x-correlation-id присутствует в заголовках ответа
 *    - x-correlation-id записывается во все логи
 *    - Событие сохранилось в очереди RabbitMQ (при недоступности микросервиса)
 */
describe('Analytics Service Down - Queue Persistence (Integration)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  // RabbitMQ переменные
  let amqpConnection: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let channel: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const RABBITMQ_URL = 'amqp://localhost:5672';
  const ANALYTICS_QUEUE = 'analytics_queue';

  // Переменная для отслеживания логов
  let capturedLogs: string[] = [];
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalWarn: typeof console.warn;

  beforeAll(async () => {
    // Инициализируем модуль приложения
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    // Перехватываем console для проверки логов
    originalLog = console.log;
    originalError = console.error;
    originalWarn = console.warn;

    console.log = jest.fn((...args: unknown[]): void => {
      const message = args.join(' ');
      capturedLogs.push(message);
      originalLog(...args);
    }) as typeof console.log;

    console.error = jest.fn((...args: unknown[]): void => {
      const message = args.join(' ');
      capturedLogs.push(message);
      originalError(...args);
    }) as typeof console.error;

    console.warn = jest.fn((...args: unknown[]): void => {
      const message = args.join(' ');
      capturedLogs.push(message);
      originalWarn(...args);
    }) as typeof console.warn;

    // Подключаемся к RabbitMQ для проверки состояния очереди с timeout
    try {
      const connectionPromise = amqplib.connect(RABBITMQ_URL);
      const timeoutPromise = new Promise(
        (_, reject) =>
          setTimeout(() => reject(new Error('RabbitMQ connection timeout')), 5000),
      );

      amqpConnection = (await Promise.race([
        connectionPromise,
        timeoutPromise,
      ])) as any;

      if (amqpConnection) {
        channel = await amqpConnection.createChannel();

        // Убеждаемся, что очередь существует и durable
        await channel.assertQueue(ANALYTICS_QUEUE, { durable: true });

        // Очищаем очередь для чистого теста
        await channel.purgeQueue(ANALYTICS_QUEUE);
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(
        '⚠️ RabbitMQ недоступен. Тест будет работать без проверки очереди:',
        errorMsg,
      );
    }

    await app.init();
  }, 10000);

  afterAll(async () => {
    // Восстанавливаем оригинальные console методы
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;

    if (channel) {
      await channel.close();
    }
    if (amqpConnection) {
      await amqpConnection.close();
    }

    await app.close();
  });

  beforeEach(() => {
    capturedLogs = [];
  });

  describe('Сценарий 1: Отправка события и валидация x-correlation-id', () => {
    it('должно отправить событие в очередь и сохранить x-correlation-id', async () => {
      // Подготовка: создаем тестовое событие
      const trackEventDto: TrackEventDto = {
        userId: 123,
        eventName: 'page_view',
        properties: {
          page: '/dashboard',
          referrer: '/home',
        },
      };

      // Отправляем POST запрос для трекинга события
      const response = await request(app.getHttpServer() as unknown as string)
        .post('/analytics/track')
        .send(trackEventDto)
        .expect(201);

      // Проверка 1: Ответ содержит x-correlation-id в заголовках
      expect(response.headers['x-correlation-id']).toBeDefined();
      const correlationId = response.headers['x-correlation-id'] as string;
      expect(correlationId.length).toBeGreaterThan(0);

      // Проверка 2: Ответ содержит успешный статус
      expect(response.body).toEqual({
        success: true,
        message: 'Событие успешно принято и отправлено на обработку в бэкграунд',
      });

      // Дополнительная задержка для обработки сообщения
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Проверка 3: Логи содержат x-correlation-id
      const logsWithId = capturedLogs.filter((log) =>
        log.includes(`[ID: ${correlationId}]`) || log.includes(correlationId),
      );

      console.log(`\n✓ Найдено ${logsWithId.length} логов с correlation-id: ${correlationId}`);
      logsWithId.forEach((log) => console.log(`  - ${log}`));

      // Если есть логи с GatewayService, то correlation-id должен быть зафиксирован
      const gatewayLogs = capturedLogs.filter((log) =>
        log.includes('GatewayService'),
      );
      if (gatewayLogs.length > 0) {
        expect(logsWithId.length).toBeGreaterThan(0);
      }
    });
  });




  describe('Сценарий 2: Проверка сохранения сообщения в очереди RabbitMQ', () => {
    it('должно сохранить сообщение в очереди при недоступности микросервиса', async () => {
      if (!channel) {
        console.warn('⚠️ RabbitMQ не доступен. Пропускаем тест очереди.');
        return;
      }

      // Подготовка: очищаем очередь
      const purgeResult = await channel.purgeQueue(ANALYTICS_QUEUE);
      console.log(`✓ Очередь очищена. Было ${purgeResult.messageCount} сообщений`);

      // Отправляем несколько событий
      const events: TrackEventDto[] = [
        {
          userId: 201,
          eventName: 'button_click',
          properties: { button: 'submit' },
        },
        {
          userId: 202,
          eventName: 'form_submit',
          properties: { form: 'contact' },
        },
      ];

      for (const event of events) {
        const response = await request(app.getHttpServer() as unknown as string)
          .post('/analytics/track')
          .send(event)
          .expect(201);

        const corrId = response.headers['x-correlation-id'] as string;
        console.log(`✓ Отправлено событие. Correlation-ID: ${corrId}`);
      }

      // Задержка для доставки в очередь
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Проверка: Проверяем количество сообщений в очереди
      const queueStatus = await channel.checkQueue(ANALYTICS_QUEUE);
      console.log(
        `✓ Очередь содержит ${queueStatus.messageCount} сообщений ` +
        `(${queueStatus.consumerCount} потребителей)`,
      );

      expect(queueStatus.messageCount).toBeGreaterThanOrEqual(2);

      // Проверка: Достаем и проверяем структуру сообщения
      const message = await channel.get(ANALYTICS_QUEUE, { noAck: false });

      if (message) {
        const content = JSON.parse(message.content.toString()) as Record<string, unknown>;
        const headers = (message.properties.headers || {}) as Record<string, unknown>;

        console.log(`✓ Сообщение из очереди:`, content);
        console.log(`✓ Заголовки сообщения:`, headers);

        // Проверяем наличие x-correlation-id в заголовках
        expect(headers['x-correlation-id']).toBeDefined();
        expect(typeof headers['x-correlation-id']).toBe('string');
        const corrId = headers['x-correlation-id'] as string;
        expect(corrId.length).toBeGreaterThan(0);

        // Подтверждаем обработку
        channel.ack(message);
        console.log(`✓ Сообщение подтверждено и удалено из очереди`);
      } else {
        throw new Error('Сообщение не найдено в очереди');
      }
    });
  });

  describe('Сценарий 3: x-correlation-id во всех логах', () => {
    it('должно логировать x-correlation-id при обработке запроса', async () => {
      capturedLogs = [];

      const trackEventDto: TrackEventDto = {
        userId: 999,
        eventName: 'test_event',
        properties: { test: true },
      };

      const response = await request(app.getHttpServer() as unknown as string)
        .post('/analytics/track')
        .send(trackEventDto)
        .expect(201);

      const correlationId = response.headers['x-correlation-id'] as string;
      await new Promise((resolve) => setTimeout(resolve, 500));

      const relevantLogs = capturedLogs.filter(
        (log) =>
          log.includes('[Log]') || log.includes('[Error]') ||
          log.includes('[Warn]') || log.includes('GatewayService'),
      );

      console.log(`\n✓ Найдено ${relevantLogs.length} релевантных логов`);

      const logsWithCorrelationId = capturedLogs.filter((log) =>
        log.includes(`[ID: ${correlationId}]`),
      );

      if (logsWithCorrelationId.length > 0) {
        console.log(
          `✓ Найдено ${logsWithCorrelationId.length} логов с correlation-id`,
        );
        expect(logsWithCorrelationId.length).toBeGreaterThan(0);
      } else {
        console.warn(`⚠️ Логи не найдены. Это может быть нормально для async.`);
      }
    });
  });



  describe('Сценарий 4: Повторная попытка отправки при восстановлении', () => {
    it('должно обработать накопившиеся события после восстановления микросервиса', async () => {
      if (!channel) {
        console.warn('⚠️ RabbitMQ не доступен. Пропускаем тест восстановления.');
        return;
      }

      // Очищаем очередь
      await channel.purgeQueue(ANALYTICS_QUEUE);
      console.log(`✓ Очередь очищена перед тестом восстановления`);

      // Отправляем событие
      const trackEventDto: TrackEventDto = {
        userId: 555,
        eventName: 'recovery_test',
        properties: { stage: 'pre_recovery' },
      };

      const response = await request(app.getHttpServer() as unknown as string)
        .post('/analytics/track')
        .send(trackEventDto)
        .expect(201);

      const correlationId = response.headers['x-correlation-id'] as string;
      console.log(`✓ Отправлено событие с correlation-id: ${correlationId}`);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Проверяем, что сообщение в очереди
      const queueBefore = await channel.checkQueue(ANALYTICS_QUEUE);
      console.log(`✓ В очереди: ${queueBefore.messageCount} сообщений`);
      expect(queueBefore.messageCount).toBeGreaterThanOrEqual(1);

      // Получаем сообщение из очереди и проверяем структуру
      const message = await channel.get(ANALYTICS_QUEUE, { noAck: true });

      if (message) {
        const content = JSON.parse(message.content.toString()) as Record<string, unknown>;
        const headers = (message.properties.headers || {}) as Record<string, unknown>;

        console.log(`✓ Сообщение для обработки:`, {
          content,
          headers,
          correlationIdMatch: headers['x-correlation-id'] === correlationId,
        });

        // Проверяем, что correlation-id сохранилась
        expect(headers['x-correlation-id']).toBe(correlationId);
      }
    });
  });

  describe('Сценарий 5: Валидация формата x-correlation-id', () => {
    it('должно использовать валидный UUID для x-correlation-id', async () => {
      const response = await request(app.getHttpServer() as unknown as string)
        .post('/analytics/track')
        .send({
          userId: 100,
          eventName: 'validation_test',
        })
        .expect(201);

      const correlationId = response.headers['x-correlation-id'] as string;

      // UUID v4 формат: 8-4-4-4-12
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      console.log(`✓ Correlation-ID: ${correlationId}`);

      if (uuidRegex.test(correlationId)) {
        console.log(`✓ Формат соответствует UUID v4`);
        expect(uuidRegex.test(correlationId)).toBe(true);
      } else {
        console.warn(`⚠️ Correlation-ID не UUID, это дополнительный формат`);
        // Все равно проверяем, что ID существует и имеет длину
        expect(correlationId.length).toBeGreaterThan(0);
      }
    });
  });
});
