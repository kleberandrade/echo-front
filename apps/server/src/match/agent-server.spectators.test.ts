import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import type { IncomingMessage } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOL_VERSION } from '@echo-front/protocol';
import { DEFAULT_CONFIG } from '@echo-front/sim';
import { AgentServer, agentServer } from './agent-server.js';
import { SpectatorGateway } from './spectator.gateway.js';

class Socket extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  sent: { type: string; matchId?: string; state?: { cycle: number } }[] = [];

  send(raw: string): void {
    this.sent.push(JSON.parse(raw));
  }

  hello(name: string): void {
    this.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          v: PROTOCOL_VERSION,
          type: 'hello',
          payload: { agentName: name },
        }),
      ),
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

function setup(seriesGames = 2): AgentServer {
  const server = new AgentServer();
  server.configure({
    dataDir: '',
    databaseUrl: '',
    cycleMs: 10,
    cfg: { ...DEFAULT_CONFIG, totalCycles: 2 },
    seriesGames,
    interGameMs: 10,
    agentRateLimit: null,
  });
  return server;
}

function startSeries(server: AgentServer, names = ['a', 'b']): void {
  for (const name of names) {
    const socket = new Socket();
    server.attachAgentSocket(socket.websocket);
    socket.hello(name);
  }
}

describe('live spectator continuity', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('waits for the requested agent and ignores unrelated concurrent matches', () => {
    const server = setup();
    const viewer = new Socket();
    server.attachSpectatorSocket(viewer.websocket, undefined, 'kleber-vanguard');
    startSeries(server);
    expect(viewer.sent).toHaveLength(1);
    expect(viewer.sent[0]?.type).toBe('spectate_idle');
    startSeries(server, ['kleber-vanguard', 'hunter']);
    expect(viewer.sent.at(-1)).toMatchObject({ type: 'spectate_state', matchId: 's2-g1' });
    startSeries(server, ['demo-a', 'demo-b']);
    vi.advanceTimersByTime(10);
    expect(
      viewer.sent.filter((frame) => frame.type === 'spectate_state').map((frame) => frame.matchId),
    ).toEqual(['s2-g1', 's2-g1']);
  });

  it('finds an already running requested agent while an unrelated match is latest', () => {
    const server = setup();
    startSeries(server, ['hunter', 'kleber-vanguard']);
    startSeries(server, ['demo-a', 'demo-b']);
    const viewer = new Socket();
    server.attachSpectatorSocket(viewer.websocket, undefined, 'kleber-vanguard');
    expect(viewer.sent.at(-1)).toMatchObject({ type: 'spectate_state', matchId: 's1-g1' });
  });

  it('follows the named agent through swapped sides and into a new series', () => {
    const server = setup();
    const viewer = new Socket();
    server.attachSpectatorSocket(viewer.websocket, undefined, 'kleber-vanguard');
    startSeries(server, ['kleber-vanguard', 'hunter']);
    vi.advanceTimersByTime(60);
    startSeries(server, ['wanderer', 'kleber-vanguard']);
    vi.advanceTimersByTime(10);
    expect([
      ...new Set(
        viewer.sent
          .filter((frame) => frame.type === 'spectate_state')
          .map((frame) => frame.matchId),
      ),
    ]).toEqual(['s1-g1', 's1-g2', 's2-g1']);
    expect(viewer.listenerCount('close')).toBe(1);
  });

  it('removes a disconnected targeted viewer from its match when another match is latest', () => {
    const server = setup();
    startSeries(server, ['kleber-vanguard', 'hunter']);
    const viewer = new Socket();
    server.attachSpectatorSocket(viewer.websocket, undefined, 'kleber-vanguard');
    startSeries(server, ['demo-a', 'demo-b']);
    viewer.close();
    Object.defineProperty(viewer, 'readyState', {
      get: () => {
        throw new Error('Disconnected transport retained');
      },
    });
    expect(() => vi.advanceTimersByTime(50)).not.toThrow();
  });

  it('passes the decoded optional agent query from the WebSocket request to the server', () => {
    const attach = vi
      .spyOn(agentServer, 'attachSpectatorSocket')
      .mockImplementation(() => undefined);
    const viewer = new Socket();
    const request = {
      url: '/spectate?agent=Kleber%20Vanguard',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
    } as IncomingMessage;
    new SpectatorGateway().handleConnection(viewer.websocket, request);
    expect(attach).toHaveBeenCalledWith(viewer.websocket, '127.0.0.1', 'Kleber Vanguard');
  });

  it.each(['/spectate', '/spectate?agent='])('preserves the default stream for %s', (url) => {
    const attach = vi
      .spyOn(agentServer, 'attachSpectatorSocket')
      .mockImplementation(() => undefined);
    const viewer = new Socket();
    new SpectatorGateway().handleConnection(viewer.websocket, {
      url,
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
    } as IncomingMessage);
    expect(attach).toHaveBeenCalledWith(viewer.websocket, '127.0.0.1', undefined);
  });

  it('starts streaming to an idle spectator when a match begins', () => {
    const server = setup();
    const viewer = new Socket();
    server.attachSpectatorSocket(viewer.websocket);
    expect(viewer.sent).toEqual([
      { type: 'spectate_idle', message: 'nenhuma partida em andamento' },
    ]);
    startSeries(server);
    expect(viewer.sent.at(-1)).toMatchObject({
      type: 'spectate_state',
      matchId: 's1-g1',
      state: { cycle: 0 },
    });
    vi.advanceTimersByTime(10);
    expect(viewer.sent.at(-1)).toMatchObject({
      type: 'spectate_state',
      matchId: 's1-g1',
      state: { cycle: 1 },
    });
  });

  it('continues into the next match without reconnecting or accumulating close listeners', () => {
    const server = setup(12);
    startSeries(server);
    const viewer = new Socket();
    server.attachSpectatorSocket(viewer.websocket);
    vi.advanceTimersByTime(340);
    const matchIds = [
      ...new Set(
        viewer.sent
          .filter((frame) => frame.type === 'spectate_state')
          .map((frame) => frame.matchId),
      ),
    ];
    expect(matchIds).toEqual(Array.from({ length: 12 }, (_, index) => `s1-g${index + 1}`));
    expect(viewer.listenerCount('close')).toBe(1);
    expect(viewer.sent.filter((frame) => frame.type === 'spectate_end')).toHaveLength(11);
  });

  it('streams a new series to a spectator who connected between series', () => {
    const server = setup(1);
    startSeries(server);
    vi.advanceTimersByTime(30);
    const viewer = new Socket();
    server.attachSpectatorSocket(viewer.websocket);
    expect(viewer.sent.at(-1)?.type).toBe('spectate_idle');
    startSeries(server);
    expect(viewer.sent.at(-1)).toMatchObject({ type: 'spectate_state', matchId: 's2-g1' });
  });

  it('stops accessing a disconnected spectator during this match and future matches', () => {
    const server = setup();
    startSeries(server);
    const viewer = new Socket();
    server.attachSpectatorSocket(viewer.websocket);
    viewer.close();
    Object.defineProperty(viewer, 'readyState', {
      get: () => {
        throw new Error('Disconnected transport retained');
      },
    });
    expect(() => vi.advanceTimersByTime(50)).not.toThrow();
    expect(viewer.sent).toHaveLength(1);
  });

  it('does not retain a spectator who disconnects while idle', () => {
    const server = setup();
    const viewer = new Socket();
    server.attachSpectatorSocket(viewer.websocket);
    viewer.close();
    Object.defineProperty(viewer, 'readyState', {
      get: () => {
        throw new Error('Disconnected transport retained');
      },
    });
    expect(() => startSeries(server)).not.toThrow();
    expect(viewer.sent).toHaveLength(1);
  });

  it('switches exclusively to the latest match when concurrent series start', () => {
    const server = setup();
    startSeries(server);
    const viewer = new Socket();
    server.attachSpectatorSocket(viewer.websocket);
    startSeries(server);
    const switchAt = viewer.sent.length;
    expect(viewer.sent.at(-1)).toMatchObject({ type: 'spectate_state', matchId: 's2-g1' });
    vi.advanceTimersByTime(20);
    expect(viewer.sent.slice(switchAt).map((frame) => frame.matchId)).toEqual([
      's2-g1',
      's2-g1',
      's2-g1',
    ]);
  });

  it('keeps spectator connection caps across matches and releases the slot on close', () => {
    const server = setup();
    server.configure({
      spectatorRateLimit: { maxConnectionsPerMinute: 10, maxConcurrentPerIp: 1 },
    });
    const viewer = new Socket();
    server.attachSpectatorSocket(viewer.websocket, '127.0.0.1');
    startSeries(server);
    vi.advanceTimersByTime(30);
    const rejected = new Socket();
    server.attachSpectatorSocket(rejected.websocket, '127.0.0.1');
    expect(rejected.readyState).toBe(3);
    viewer.close();
    const replacement = new Socket();
    server.attachSpectatorSocket(replacement.websocket, '127.0.0.1');
    expect(replacement.readyState).toBe(1);
    expect(replacement.sent.at(-1)).toMatchObject({ type: 'spectate_state', matchId: 's1-g2' });
    vi.advanceTimersByTime(10);
    expect(rejected.sent).toHaveLength(1);
  });
});
