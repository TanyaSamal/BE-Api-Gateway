import { Module, Global, Inject } from '@nestjs/common';
import { AppLogger, SharedModule } from 'ai/shared';
import { InMemoryEventStore } from './in-memory-event-store';

// Токены для внедрения зависимостей
export const MASTER_DB_CONNECTION = 'MASTER_DB_CONNECTION';
export const SLAVE_DB_CONNECTION = 'SLAVE_DB_CONNECTION';

@Global()
@Module({
  imports: [SharedModule],
  providers: [
    {
      provide: MASTER_DB_CONNECTION,
      useFactory: () => {
        // Симулируем подключение к Master (запись)
        return new InMemoryEventStore('MASTER-NODE (Read-Write)');
      },
    },
    {
      provide: SLAVE_DB_CONNECTION,
      useFactory: () => {
        // Симулируем подключение к Slave реплике (только чтение)
        return new InMemoryEventStore('SLAVE-NODE-01 (Read-Only)');
      },
    },
  ],
  exports: [MASTER_DB_CONNECTION, SLAVE_DB_CONNECTION],
})
export class DatabaseModule {
  // Связываем ноды между собой на этапе инициализации модуля
  constructor(
    @Inject(MASTER_DB_CONNECTION) master: InMemoryEventStore,
    @Inject(SLAVE_DB_CONNECTION) slave: InMemoryEventStore,
  ) {
    master.registerSlaveReplica(slave); // Включаем репликацию данных!
  }
}
