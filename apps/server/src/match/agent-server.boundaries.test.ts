import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOL_VERSION } from '@echo-front/protocol';
import { ARENA_ALPHA, DEFAULT_CONFIG, stepCycle, type MatchState } from '@echo-front/sim';
import { AgentServer } from './agent-server.js';
import type { Store } from './store.js';

class Socket extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  sent: { type: string; state?: MatchState }[] = [];

  send(raw: string): void {
    this.sent.push(JSON.parse(raw));
  }

  receive(type: string, payload: unknown, envelope = {}): void {
    this.emit(
      'message',
      Buffer.from(JSON.stringify({ v: PROTOCOL_VERSION, type, payload, ...envelope })),
    );
  }

  close(): void {
    this.readyState = 3;
    this.emit('close');
  }

  get websocket(): WebSocket {
    return this as unknown as WebSocket;
  }
}

function setup(): { server: AgentServer; a: Socket; b: Socket } {
  const server = new AgentServer();
  server.configure({
    dataDir: '',
    databaseUrl: '',
    cycleMs: 10,
    cfg: { ...DEFAULT_CONFIG, totalCycles: 3 },
    seriesGames: 1,
    interGameMs: 0,
    agentRateLimit: null,
  });
  const a = new Socket();
  const b = new Socket();
  server.attachAgentSocket(a.websocket);
  server.attachAgentSocket(b.websocket);
  return { server, a, b };
}

describe('agent connection and decision boundaries', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does not requeue an active socket after a duplicate hello', () => {
    const { server, a, b } = setup();
    a.receive('hello', { agentName: 'a' });
    b.receive('hello', { agentName: 'b' });
    a.receive('hello', { agentName: 'a-again' });
    expect(server.queueLength()).toBe(0);
    const c = new Socket();
    server.attachAgentSocket(c.websocket);
    c.receive('hello', { agentName: 'c' });
    expect(server.queueLength()).toBe(1);
    expect(c.sent.some((message) => message.type === 'welcome')).toBe(false);
    expect(a.sent.filter((message) => message.type === 'welcome')).toHaveLength(1);
  });

  it('does not queue a socket closed while authentication was pending', async () => {
    const { server, a } = setup();
    let authenticate!: (agent: null) => void;
    server.store = {
      authenticate: () =>
        new Promise((resolve) => {
          authenticate = resolve;
        }),
    } as unknown as Store;
    a.receive('hello', { agentName: 'a', token: 'pending-token' });
    a.close();
    authenticate(null);
    await Promise.resolve();
    expect(server.queueLength()).toBe(0);
  });

  it('allows a connected agent to join another series after its series completes', () => {
    const { server, a, b } = setup();
    a.receive('hello', { agentName: 'a' });
    b.receive('hello', { agentName: 'b' });
    vi.advanceTimersByTime(31);
    a.receive('hello', { agentName: 'a' });
    expect(server.queueLength()).toBe(1);
    b.receive('hello', { agentName: 'b' });
    expect(a.sent.filter((message) => message.type === 'welcome')).toHaveLength(2);
  });

  it('preserves decisions without an envelope cycle for existing clients', () => {
    const { server, a, b } = setup();
    a.receive('hello', { agentName: 'a' });
    b.receive('hello', { agentName: 'b' });
    const spectator = new Socket();
    server.attachSpectatorSocket(spectator.websocket);
    const initial = spectator.sent[0]!.state!;
    const unit = initial.units.find((candidate) => candidate.team === 'cian')!;
    a.receive('decision', { movement: { direction: 0, speed: 1 } }, { unitId: unit.id });
    vi.advanceTimersByTime(10);
    const moved = spectator.sent
      .at(-1)!
      .state!.units.find((candidate) => candidate.id === unit.id)!;
    expect(moved.x).toBeGreaterThan(unit.x);
  });

  it('ignores future and stale decisions but applies the current cycle decision', () => {
    const { server, a, b } = setup();
    a.receive('hello', { agentName: 'a' });
    b.receive('hello', { agentName: 'b' });
    const spectator = new Socket();
    server.attachSpectatorSocket(spectator.websocket);
    const cfg = { ...DEFAULT_CONFIG, totalCycles: 3 };
    let expected = spectator.sent[0]!.state!;
    const unitId = expected.units.find((unit) => unit.team === 'cian')!.id;
    const decision = { movement: { direction: 0, speed: 1 } };
    for (const cycle of [1, 0]) {
      a.receive('decision', decision, { unitId, cycle });
      vi.advanceTimersByTime(10);
      expected = stepCycle(expected, {}, ARENA_ALPHA, cfg).state;
      expect(spectator.sent.at(-1)!.state).toEqual(expected);
    }
    a.receive('decision', decision, { unitId, cycle: 2 });
    vi.advanceTimersByTime(10);
    expected = stepCycle(expected, { [unitId]: decision }, ARENA_ALPHA, cfg).state;
    expect(
      spectator.sent.filter((message) => message.type === 'spectate_state').at(-1)!.state,
    ).toEqual(expected);
  });
});
