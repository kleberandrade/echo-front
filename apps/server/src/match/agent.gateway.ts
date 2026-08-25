import { OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets';
import type WebSocket from 'ws';
import { agentServer } from './agent-server.js';

/** Canal dos agentes: ws://host/agent — toda a lógica vive em AgentServer. */
@WebSocketGateway({ path: '/agent' })
export class AgentGateway implements OnGatewayConnection {
  handleConnection(client: WebSocket): void {
    agentServer.attachAgentSocket(client);
  }
}
