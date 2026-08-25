import { OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets';
import type WebSocket from 'ws';
import { agentServer } from './agent-server.js';

/** Canal de espectador: ws://host/spectate — recebe o estado onisciente por ciclo. */
@WebSocketGateway({ path: '/spectate' })
export class SpectatorGateway implements OnGatewayConnection {
  handleConnection(client: WebSocket): void {
    agentServer.attachSpectatorSocket(client);
  }
}
