import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
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
export class TasksGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TasksGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`WS Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS Client disconnected: ${client.id}`);
  }

  notifyTaskCompleted(payload: TaskCompletedWsPayload) {
    this.logger.log(`Broadcasting task.completed for task ${payload.taskId}`);
    this.server.emit('task.completed', payload);
  }
}
