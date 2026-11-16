import type { IncomingMessage } from 'node:http';
import { OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets';
import type WebSocket from 'ws';
import { agentServer } from './agent-server.js';
import { extractIp } from './rate-limiter.js';

/** Canal de espectador: ws://host/spectate — recebe o estado onisciente por ciclo. */
@WebSocketGateway({ path: '/spectate' })
export class SpectatorGateway implements OnGatewayConnection {
  handleConnection(client: WebSocket, request?: IncomingMessage): void {
    const agentName =
      new URL(request?.url ?? '/spectate', 'http://localhost').searchParams.get('agent') ||
      undefined;
    agentServer.attachSpectatorSocket(client, extractIp(request), agentName);
  }
}
