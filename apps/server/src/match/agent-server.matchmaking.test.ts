/**
 * Sprint 12: fila de matchmaking com mais de um agente esperando ao mesmo
 * tempo — pareamento pelo Elo mais próximo em vez de FIFO estrito puro.
 * (A lógica pura do Elo já é coberta indiretamente pelos testes de
 * store.standings(); aqui testamos só a decisão de pareamento.)
 */
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '@echo-front/protocol';
import { AgentServer } from './agent-server.js';
import type { MatchStore } from './store.js';

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

function hello(ws: FakeSocket, agentName: string): void {
  ws.emit(
    'message',
    Buffer.from(JSON.stringify({ v: PROTOCOL_VERSION, type: 'hello', payload: { agentName } })),
  );
}

/** Cria um AgentServer sem persistência real, com Elo controlado via um store fake. */
function serverWithElo(elos: Record<string, number>, matchmakingWindowMs = 0): AgentServer {
  const s = new AgentServer();
  s.configure({
    dataDir: '',
    agentRateLimit: null,
    spectatorRateLimit: null,
    cycleMs: 10 * 60_000,
    matchmakingWindowMs,
  });
  const fakeStore = {
    standings: () => Object.entries(elos).map(([agent, elo]) => ({ agent, elo })),
  };
  s.store = fakeStore as unknown as MatchStore;
  return s;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function matchIdOf(ws: FakeSocket): string | undefined {
  const welcome = ws.sent.find((m) => (m as { type?: string }).type === 'welcome') as
    { payload: { matchId: string } } | undefined;
  return welcome?.payload.matchId;
}

describe('AgentServer — fila de matchmaking por Elo (sprint-12)', () => {
  it('sem histórico de Elo, pareia em ordem de chegada (FIFO)', () => {
    const s = serverWithElo({});
    const a = new FakeSocket();
    const b = new FakeSocket();
    const c = new FakeSocket();
    s.attachAgentSocket(a as never);
    s.attachAgentSocket(b as never);
    s.attachAgentSocket(c as never);
    hello(a, 'a');
    expect(s.queueLength()).toBe(1);
    hello(b, 'b');
    expect(s.queueLength()).toBe(0); // a×b pareados
    expect(matchIdOf(a)).toBeDefined();
    expect(matchIdOf(a)).toBe(matchIdOf(b));
    hello(c, 'c');
    expect(s.queueLength()).toBe(1); // c aguarda sozinho
  });

  it('com matchmakingWindowMs > 0, acumula a fila e pareia pelo Elo mais próximo — não FIFO', async () => {
    // "forte" (1400), "fraco" (900) e "medio" (1000) chegam dentro da mesma
    // janela. Pareamento ótimo por Elo é medio×fraco (diff 100); forte
    // (diff 400 pra qualquer um dos dois) fica sem par e segue esperando —
    // mesmo sendo o primeiro a chegar (não é FIFO).
    const s = serverWithElo({ forte: 1400, fraco: 900, medio: 1000 }, 20);
    const forte = new FakeSocket();
    const fraco = new FakeSocket();
    const medio = new FakeSocket();
    s.attachAgentSocket(forte as never);
    s.attachAgentSocket(fraco as never);
    s.attachAgentSocket(medio as never);

    hello(forte, 'forte');
    hello(fraco, 'fraco');
    hello(medio, 'medio');
    expect(s.queueLength()).toBe(3); // janela ainda aberta — ninguém pareado ainda

    await sleep(40); // espera a janela fechar e o pareamento rodar

    expect(s.queueLength()).toBe(1);
    expect(matchIdOf(medio)).toBeDefined();
    expect(matchIdOf(medio)).toBe(matchIdOf(fraco)); // pareou com o de Elo mais próximo
    expect(matchIdOf(forte)).toBeUndefined(); // "forte" segue na fila, sem par bom disponível
  });

  it('ao desconectar, remove o agente da fila mesmo se ele não for o mais recente', () => {
    const s = serverWithElo({});
    const a = new FakeSocket();
    const b = new FakeSocket();
    s.attachAgentSocket(a as never);
    s.attachAgentSocket(b as never);
    hello(a, 'a');
    hello(b, 'b'); // a×b pareiam, fila some
    const c = new FakeSocket();
    const d = new FakeSocket();
    s.attachAgentSocket(c as never);
    s.attachAgentSocket(d as never);
    hello(c, 'c');
    hello(d, 'd'); // c×d pareiam também

    const e = new FakeSocket();
    s.attachAgentSocket(e as never);
    hello(e, 'e');
    expect(s.queueLength()).toBe(1);
    e.close();
    expect(s.queueLength()).toBe(0);
  });
});
