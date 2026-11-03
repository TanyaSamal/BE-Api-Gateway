import { Module } from '@nestjs/common';
import { SharedService } from './shared.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ANALYTICS_QUEUE } from './consts/analytics';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ANALYTICS_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://localhost:5672'],
          queue: ANALYTICS_QUEUE,
          queueOptions: {
            durable: true,
          },
          socketOptions: {
            heartbeatIntervalInSeconds: 5,
            reconnectTimeInSeconds: 5,
          },
        },
      },
    ]),
  ],
  providers: [SharedService],
  exports: [ClientsModule, SharedService],
})
export class SharedModule {}
