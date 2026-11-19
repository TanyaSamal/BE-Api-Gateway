import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export interface TaskCompletedWsPayload {
  taskId: string;
  completedAt: string;
  correlationId?: string;
}

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
})
export class TasksGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TasksGateway.name);

  afterInit() {
    this.logger.log(
      'WebSocket Gateway успешно инициализирован!',
      'TasksGateway',
    );
  }

  handleConnection(client: Socket) {
    this.logger.log(`WS Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS Client disconnected: ${client.id}`);
  }

  notifyTaskCompleted(payload: TaskCompletedWsPayload) {
    if (!this.server) {
      this.logger.warn('WebSocket server не инициализирован, пропуск отправки');
      return;
    }
    this.logger.log(`Broadcasting task.completed for task ${payload.taskId}`);
    this.server.emit('task.completed', payload);
  }
}
