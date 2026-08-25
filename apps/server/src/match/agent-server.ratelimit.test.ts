/**
 * Sprint 11: integração do rate limiting por IP dentro do AgentServer —
 * unit tests de IpRateLimiter já cobrem a lógica pura (rate-limiter.test.ts);
 * aqui verificamos que attachAgentSocket/attachSpectatorSocket de fato
 * recusam conexão, avisam com o código certo e liberam o slot no close.
 */
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { AgentServer } from './agent-server.js';

class FakeSocket extends EventEmitter {
  readyState = 1;
  OPEN = 1;
  sent: unknown[] = [];
  closed = false;
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {
    this.closed = true;
    this.emit('close');
  }
}

function server(): AgentServer {
  const s = new AgentServer();
  s.configure({
    dataDir: '',
    agentRateLimit: { maxConnectionsPerMinute: 100, maxConcurrentPerIp: 2 },
    spectatorRateLimit: { maxConnectionsPerMinute: 100, maxConcurrentPerIp: 1 },
  });
  return s;
}

describe('AgentServer — rate limiting por IP (sprint-11)', () => {
  it('recusa a 3ª conexão concorrente do mesmo IP no canal de agentes', () => {
    const s = server();
    const a = new FakeSocket();
    const b = new FakeSocket();
    const c = new FakeSocket();
    s.attachAgentSocket(a as never, '1.2.3.4');
    s.attachAgentSocket(b as never, '1.2.3.4');
    s.attachAgentSocket(c as never, '1.2.3.4');
    expect(a.closed).toBe(false);
    expect(b.closed).toBe(false);
    expect(c.closed).toBe(true);
    expect((c.sent[0] as { payload: { code: string } }).payload.code).toBe('rate_limited');
  });

  it('libera o slot quando um socket fecha, permitindo nova conexão', () => {
    const s = server();
    const a = new FakeSocket();
    const b = new FakeSocket();
    s.attachAgentSocket(a as never, '9.9.9.9');
    s.attachAgentSocket(b as never, '9.9.9.9');
    a.close(); // dispara o evento 'close' que o AgentServer escuta
    const c = new FakeSocket();
    s.attachAgentSocket(c as never, '9.9.9.9');
    expect(c.closed).toBe(false);
  });

  it('IP diferente não é afetado pelo limite de outro', () => {
    const s = server();
    const a = new FakeSocket();
    const b = new FakeSocket();
    const c = new FakeSocket();
    s.attachAgentSocket(a as never, '1.1.1.1');
    s.attachAgentSocket(b as never, '1.1.1.1');
    s.attachAgentSocket(c as never, '2.2.2.2'); // outro IP, limite próprio
    expect(c.closed).toBe(false);
  });

  it('sem IP (torneio headless) o rate limit é ignorado', () => {
    const s = server();
    for (let i = 0; i < 5; i++) {
      const ws = new FakeSocket();
      s.attachAgentSocket(ws as never);
      expect(ws.closed).toBe(false);
    }
  });

  it('canal de espectador também respeita o limite concorrente por IP', () => {
    const s = server();
    const a = new FakeSocket();
    const b = new FakeSocket();
    s.attachSpectatorSocket(a as never, '5.5.5.5');
    s.attachSpectatorSocket(b as never, '5.5.5.5');
    expect(b.closed).toBe(true);
  });
});
