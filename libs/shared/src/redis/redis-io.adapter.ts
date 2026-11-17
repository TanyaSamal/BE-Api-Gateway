import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { AppLogger } from '../logging/app.logger';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private appLogger?: AppLogger;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  connectToRedis(): void {
    this.appLogger = this.app.get(AppLogger);
    const baseRedisClient = this.app.get<Redis>('REDIS_CLIENT');

    const pubClient = baseRedisClient.duplicate();
    const subClient = baseRedisClient.duplicate();

    pubClient.on('error', (err: Error) =>
      this.appLogger?.error(
        `Redis Pub Client Error: ${err.message}`,
        err.stack,
      ),
    );
    subClient.on('error', (err: Error) =>
      this.appLogger?.error(
        `Redis Sub Client Error: ${err.message}`,
        err.stack,
      ),
    );

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.appLogger.log(
      'RedisIoAdapter успешно подключен через ioredis (REDIS_CLIENT)',
      'RedisIoAdapter',
    );
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
