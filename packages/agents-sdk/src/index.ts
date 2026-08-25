/**
 * ECHO//FRONT — SDK de agentes (TypeScript).
 *
 * Sprint 0: esqueleto de conexão + handshake. Callbacks de percepção e os
 * bots de referência chegam na Sprint 2 (docs/sprints/sprint-02-sensores-e-agentes.md).
 */
import WebSocket from 'ws';
import {
  parseServerMessage,
  PROTOCOL_VERSION,
  type DecisionPayload,
  type PerceptionPayload,
  type ServerMessage,
  type WelcomePayload,
} from '@echo-front/protocol';

export interface AgentOptions {
  url: string;
  agentName: string;
  token?: string;
  onPerception?: (unitId: string, perception: PerceptionPayload) => DecisionPayload | undefined;
  onWelcome?: (welcome: WelcomePayload) => void;
  onMessage?: (message: ServerMessage) => void;
  onClose?: () => void;
}

export { hunterBot, wandererBot, type PerceptionBotFn } from './bots.js';
export { courierBot, tricksterBot } from './objective-bots.js';
export { ghostBot, ghostConfig } from './ghost-bot.js';

export class Agent {
  private ws: WebSocket | undefined;

  constructor(private readonly opts: AgentOptions) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.opts.url);
      this.ws = ws;

      ws.once('open', () => {
        ws.send(
          JSON.stringify({
            v: PROTOCOL_VERSION,
            type: 'hello',
            payload: { agentName: this.opts.agentName, token: this.opts.token },
          }),
        );
        resolve();
      });
      ws.once('error', reject);
      ws.on('close', () => this.opts.onClose?.());

      ws.on('message', (raw: Buffer) => {
        let msg: ServerMessage;
        try {
          msg = parseServerMessage(raw.toString('utf8'));
        } catch {
          return; // mensagem malformada do servidor: ignora
        }
        this.opts.onMessage?.(msg);
        if (msg.type === 'welcome') {
          this.opts.onWelcome?.(msg.payload);
        } else if (msg.type === 'perception' && msg.unitId !== undefined) {
          const decision = this.opts.onPerception?.(msg.unitId, msg.payload);
          if (decision) {
            this.sendDecision(msg.unitId, msg.cycle ?? 0, decision);
          }
        }
      });
    });
  }

  sendDecision(unitId: string, cycle: number, payload: DecisionPayload): void {
    this.ws?.send(JSON.stringify({ v: PROTOCOL_VERSION, type: 'decision', unitId, cycle, payload }));
  }

  close(): void {
    this.ws?.close();
  }
}
