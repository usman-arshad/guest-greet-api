import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RecognitionResultDto } from './dto';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/recognition',
})
export class RecognitionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RecognitionGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitRecognitionResult(result: RecognitionResultDto) {
    const connectedClients = this.server.sockets?.sockets?.size ?? 0;
    this.logger.log(
      `Emitting recognition:match → ${connectedClients} client(s) | ` +
      `${result.customer?.displayName} (confidence: ${result.confidence})`,
    );
    this.server.emit('recognition:match', result);
  }
}
