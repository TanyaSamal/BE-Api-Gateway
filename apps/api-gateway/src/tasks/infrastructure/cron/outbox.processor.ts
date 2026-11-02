import { Injectable, Inject } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ClientProxy, RmqRecordBuilder } from '@nestjs/microservices';
import { TransactionalStore } from '../persistence/transactional-store';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OutboxProcessor {
  private isProcessing = false;

  constructor(
    @Inject('EVENT_STORE') private readonly eventStore: TransactionalStore,
    @Inject('ANALYTICS_SERVICE') private readonly analyticsClient: ClientProxy,
  ) {}

  @Interval(500)
  handleOutboxPolling(): void {

    // Защита от наложения циклов, если прошлая пачка ещё отправляется по сети
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Запрашиваем из базы данных все неотправленные PENDING события
    this.eventStore
      .getPendingOutboxEvents()
      .then((pendingEvents) => {
        if (pendingEvents.length === 0) {
          this.isProcessing = false;
          return;
        }

        console.log(
          `[🤖 Outbox Processor] Найдено ${pendingEvents.length} событий для отправки...`,
        );

        // Перебираем события и отправляем их в брокер
        const promises = pendingEvents.map((event) => {
          const correlationId = uuidv4();
          const pattern = 'track_action';
          const payload = {
            userId: event.payload.userId || 1,
            eventName: event.eventName,
            properties: event.payload,
          };

          const record = new RmqRecordBuilder(payload)
            .setOptions({
              headers: {
                'x-correlation-id': correlationId,
              },
            })
            .build();

          // Посылаем "огненный выстрел" в RabbitMQ
          this.analyticsClient.emit(pattern, record);
          console.log(
            `[🚀 Outbox Sent] Событие ${event.id} выброшено в RabbitMQ`,
          );

          // Помечаем событие как успешно обработанное в БД
          return this.eventStore.markAsProcessed(event.id);
        });

        // Ждем завершения обновления всех статусов в текущей пачке
        return Promise.all(promises);
      })
      .then(() => {
        this.isProcessing = false;
      })
      .catch((error) => {
        console.error(
          '[❌ Outbox Processor Error] Ошибка обработки исходящих сообщений:',
          error,
        );
        this.isProcessing = false;
      });
  }
}
