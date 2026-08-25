/**
 * Núcleo do servidor de partidas — framework-free (o gateway Nest delega aqui).
 * Sprint 6: pareamento FIFO → SÉRIE ranqueada de N partidas com lados
 * espelhados (semente k jogada 2×, trocando cian/magenta), resultados
 * pontuados pelo regulamento e persistidos no MatchStore.
 */
import type WebSocket from 'ws';
import {
  isCompatibleVersion,
  parseAgentMessage,
  PROTOCOL_VERSION,
  type DecisionPayload,
  type Team,
} from '@echo-front/protocol';
import {
  ARENA_ALPHA,
  buildPerceptions,
  createMatch,
  decideWinner,
  stateHash,
  stepCycle,
  SIM_VERSION,
  type DecisionsByUnit,
  type MatchConfig,
  type MatchState,
  type Replay,
  type ReplayCycleRecord,
  DEFAULT_CONFIG,
} from '@echo-front/sim';
import { MatchStore, scoreMatch } from './store.js';
import { IpRateLimiter, type RateLimiterOptions } from './rate-limiter.js';

export interface AgentServerOptions {
  /** Duração real de um ciclo em ms (500 = tempo de jogo 1:1). */
  cycleMs: number;
  cfg: MatchConfig;
  /** Partidas por série (lados espelhados a cada 2). */
  seriesGames: number;
  /** Pausa entre partidas da série, em ms. */
  interGameMs: number;
  /** Diretório de dados; vazio desativa persistência. */
  dataDir: string;
  /** Atraso da transmissão para espectadores, em ms (anti-coaching). */
  spectateDelayMs: number;
  /** Avisos por payload inválido antes do aviso formal / desconexão. */
  invalidWarnAt: number;
  invalidKickAt: number;
  seedFor: (seriesId: string, seedIndex: number) => string;
  /** Rate limiting por IP no canal de agentes (sprint-11). `null` desativa. */
  agentRateLimit: RateLimiterOptions | null;
  /** Rate limiting por IP no canal de espectador (mais permissivo: leitura pública). */
  spectatorRateLimit: RateLimiterOptions | null;
}

const DEFAULT_OPTIONS: AgentServerOptions = {
  cycleMs: 500,
  cfg: DEFAULT_CONFIG,
  seriesGames: 6,
  interGameMs: 400,
  dataDir: 'data',
  spectateDelayMs: 0,
  invalidWarnAt: 3,
  invalidKickAt: 10,
  seedFor: (seriesId, k) => `${seriesId}-seed-${k}`,
  // Um agente real abre 1 conexão por partida; generoso o bastante para rodar
  // vários bots locais ao mesmo tempo, apertado o bastante para barrar flood.
  agentRateLimit: { maxConnectionsPerMinute: 60, maxConcurrentPerIp: 20 },
  spectatorRateLimit: { maxConnectionsPerMinute: 120, maxConcurrentPerIp: 40 },
};

interface Seat {
  team: Team;
  ws: WebSocket | null;
  name: string;
}

function send(ws: WebSocket | null, msg: unknown): void {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

export interface SeriesInfo {
  seriesId: string;
  game: number;
  of: number;
}

export class LiveMatch {
  state: MatchState;
  private decisions: DecisionsByUnit = {};
  private cycles: ReplayCycleRecord[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private spectators = new Set<WebSocket>();
  onEnd: ((replay: Replay, finalState: MatchState) => void) | undefined;

  constructor(
    readonly id: string,
    readonly seed: string,
    readonly seats: Record<Team, Seat>,
    private readonly opts: AgentServerOptions,
    readonly series?: SeriesInfo,
  ) {
    this.state = createMatch(seed, ARENA_ALPHA, opts.cfg);
  }

  start(): void {
    for (const team of ['cian', 'magenta'] as const) {
      send(this.seats[team].ws, {
        v: PROTOCOL_VERSION,
        type: 'welcome',
        payload: {
          matchId: this.id,
          team,
          unitIds: this.state.units.filter((u) => u.team === team).map((u) => u.id),
          protocolVersion: PROTOCOL_VERSION,
          seedPublic: stateHash(this.state),
          map: ARENA_ALPHA.id,
          ...(this.series ? { series: this.series } : {}),
        },
      });
      send(this.seats[team].ws, {
        v: PROTOCOL_VERSION,
        type: 'match_start',
        payload: { cycle: 0 as const, mode: this.state.mode },
      });
    }
    this.sendPerceptions();
    this.timer = setInterval(() => this.closeCycle(), this.opts.cycleMs);
  }

  private closeCycle(): void {
    const decisions = this.decisions;
    this.decisions = {};
    this.cycles.push({ c: this.state.cycle, d: decisions });
    this.state = stepCycle(this.state, decisions, ARENA_ALPHA, this.opts.cfg).state;

    const frame = { type: 'spectate_state', matchId: this.id, state: this.state };
    const emit = () => {
      for (const ws of this.spectators) send(ws, frame);
    };
    if (this.opts.spectateDelayMs > 0) setTimeout(emit, this.opts.spectateDelayMs);
    else emit();

    if (this.state.ended) this.finish();
    else this.sendPerceptions();
  }

  private sendPerceptions(): void {
    const perceptions = buildPerceptions(this.state, ARENA_ALPHA, this.opts.cfg);
    for (const [unitId, payload] of Object.entries(perceptions)) {
      const team = unitId.startsWith('cian') ? 'cian' : 'magenta';
      send(this.seats[team].ws, {
        v: PROTOCOL_VERSION,
        type: 'perception',
        cycle: this.state.cycle,
        unitId,
        payload,
      });
    }
  }

  submitDecision(team: Team, unitId: string, payload: DecisionPayload): boolean {
    const unit = this.state.units.find((u) => u.id === unitId);
    if (!unit || unit.team !== team || !unit.alive) return false;
    this.decisions[unitId] = payload;
    return true;
  }

  addSpectator(ws: WebSocket): void {
    this.spectators.add(ws);
    ws.on('close', () => this.spectators.delete(ws));
    send(ws, { type: 'spectate_state', matchId: this.id, state: this.state });
  }

  detachSeat(ws: WebSocket): void {
    for (const team of ['cian', 'magenta'] as const) {
      if (this.seats[team].ws === ws) this.seats[team].ws = null;
    }
  }

  get finished(): boolean {
    return this.state.ended;
  }

  private finish(): void {
    if (this.timer) clearInterval(this.timer);
    const replay: Replay = {
      header: { sim: SIM_VERSION, map: ARENA_ALPHA.id, seed: this.seed, config: this.opts.cfg },
      cycles: this.cycles,
      finalHash: stateHash(this.state),
    };
    const endMsg = {
      v: PROTOCOL_VERSION,
      type: 'match_end',
      payload: {
        score: this.state.score,
        winner: decideWinner(this.state),
        reason: this.state.endReason ?? ('time_up' as const),
        seed: this.seed,
        finalHash: replay.finalHash,
      },
    };
    send(this.seats.cian.ws, endMsg);
    send(this.seats.magenta.ws, endMsg);
    const endFrame = { type: 'spectate_end', matchId: this.id, ...endMsg.payload };
    const emitEnd = () => {
      for (const ws of this.spectators) send(ws, endFrame);
    };
    if (this.opts.spectateDelayMs > 0) setTimeout(emitEnd, this.opts.spectateDelayMs);
    else emitEnd();
    this.onEnd?.(replay, this.state);
  }
}

/** Série ranqueada entre dois agentes conectados. */
class Series {
  private game = 0;
  current: LiveMatch | undefined;

  constructor(
    readonly id: string,
    /** a = primeiro da fila; b = segundo. */
    readonly a: { ws: WebSocket | null; name: string },
    readonly b: { ws: WebSocket | null; name: string },
    private readonly opts: AgentServerOptions,
    private readonly store: MatchStore | undefined,
    private readonly onMatchStarted: (m: LiveMatch) => void,
    private readonly onFinished: () => void,
  ) {}

  start(): void {
    this.next();
  }

  private next(): void {
    if (this.game >= this.opts.seriesGames) {
      console.log(`[echo-front] série ${this.id} concluída (${this.opts.seriesGames} partidas)`);
      this.onFinished();
      return;
    }
    this.game += 1;
    const seedIndex = Math.floor((this.game - 1) / 2);
    const swapped = (this.game - 1) % 2 === 1; // lados espelhados
    const cian = swapped ? this.b : this.a;
    const magenta = swapped ? this.a : this.b;
    const matchId = `${this.id}-g${this.game}`;
    const match = new LiveMatch(
      matchId,
      this.opts.seedFor(this.id, seedIndex),
      {
        cian: { team: 'cian', ws: cian.ws, name: cian.name },
        magenta: { team: 'magenta', ws: magenta.ws, name: magenta.name },
      },
      this.opts,
      { seriesId: this.id, game: this.game, of: this.opts.seriesGames },
    );
    match.onEnd = (replay, finalState) => {
      if (this.store) {
        const alive = (team: Team) =>
          finalState.units.filter((u) => u.team === team && u.alive).length;
        const spent = (team: Team) =>
          finalState.units
            .filter((u) => u.team === team)
            .reduce((acc, u) => acc + u.energySpent, 0);
        this.store.recordResult(
          {
            matchId,
            seriesId: this.id,
            game: this.game,
            mode: finalState.mode,
            seed: match.seed,
            finalHash: replay.finalHash,
            agents: { cian: cian.name, magenta: magenta.name },
            score: finalState.score,
            winner: decideWinner(finalState),
            reason: finalState.endReason ?? 'time_up',
            points: scoreMatch(finalState),
            stats: {
              unitsAlive: { cian: alive('cian'), magenta: alive('magenta') },
              energySpent: { cian: spent('cian'), magenta: spent('magenta') },
              kills: finalState.units.filter((u) => !u.alive).length,
            },
            finishedAt: new Date().toISOString(),
          },
          replay,
        );
      }
      setTimeout(() => this.next(), this.opts.interGameMs);
    };
    this.current = match;
    this.onMatchStarted(match);
    match.start();
  }

  detach(ws: WebSocket): void {
    if (this.a.ws === ws) this.a.ws = null;
    if (this.b.ws === ws) this.b.ws = null;
    this.current?.detachSeat(ws);
  }
}

export class AgentServer {
  private opts: AgentServerOptions = { ...DEFAULT_OPTIONS };
  store: MatchStore | undefined;
  private waiting: { ws: WebSocket; name: string } | null = null;
  private bySocket = new Map<WebSocket, Series>();
  private invalidCount = new Map<WebSocket, number>();
  private latest: LiveMatch | null = null;
  private counter = 0;
  private agentLimiter: IpRateLimiter | null = null;
  private spectatorLimiter: IpRateLimiter | null = null;
  private agentIpBySocket = new Map<WebSocket, string>();

  constructor() {
    this.initStore();
    this.initLimiters();
  }

  private initStore(): void {
    this.store = this.opts.dataDir ? new MatchStore(this.opts.dataDir) : undefined;
  }

  private initLimiters(): void {
    this.agentLimiter = this.opts.agentRateLimit
      ? new IpRateLimiter(this.opts.agentRateLimit)
      : null;
    this.spectatorLimiter = this.opts.spectatorRateLimit
      ? new IpRateLimiter(this.opts.spectatorRateLimit)
      : null;
  }

  configure(opts: Partial<AgentServerOptions>): void {
    this.opts = { ...this.opts, ...opts };
    this.initStore();
    if ('agentRateLimit' in opts || 'spectatorRateLimit' in opts) this.initLimiters();
  }

  /** `ip` é opcional (torneio local/headless não passa) — sem IP, o rate limit é ignorado. */
  attachAgentSocket(ws: WebSocket, ip?: string): void {
    if (ip && this.agentLimiter) {
      const r = this.agentLimiter.tryConnect(ip);
      if (!r.allowed) {
        send(ws, {
          v: PROTOCOL_VERSION,
          type: 'error',
          payload: { code: 'rate_limited', message: r.reason ?? 'limite de conexões excedido' },
        });
        ws.close();
        return;
      }
      this.agentIpBySocket.set(ws, ip);
    }
    ws.on('message', (raw: Buffer) => this.onMessage(ws, raw));
    ws.on('close', () => this.onClose(ws));
  }

  attachSpectatorSocket(ws: WebSocket, ip?: string): void {
    if (ip && this.spectatorLimiter) {
      const r = this.spectatorLimiter.tryConnect(ip);
      if (!r.allowed) {
        send(ws, { type: 'spectate_idle', message: r.reason ?? 'limite de conexões excedido' });
        ws.close();
        return;
      }
      ws.on('close', () => this.spectatorLimiter?.release(ip));
    }
    if (this.latest && !this.latest.finished) this.latest.addSpectator(ws);
    else send(ws, { type: 'spectate_idle', message: 'nenhuma partida em andamento' });
  }

  private onMessage(ws: WebSocket, raw: Buffer): void {
    let msg;
    try {
      msg = parseAgentMessage(raw.toString('utf8'));
      this.invalidCount.set(ws, 0); // payload válido zera a contagem
    } catch {
      const count = (this.invalidCount.get(ws) ?? 0) + 1;
      this.invalidCount.set(ws, count);
      if (count >= this.opts.invalidKickAt) {
        send(ws, {
          v: PROTOCOL_VERSION,
          type: 'error',
          payload: {
            code: 'rate_limited',
            message: `${count} payloads inválidos — desconectando (a partida segue em no-op).`,
          },
        });
        ws.close();
        return;
      }
      send(ws, {
        v: PROTOCOL_VERSION,
        type: 'error',
        payload: {
          code: 'invalid_payload',
          message:
            count >= this.opts.invalidWarnAt
              ? `Mensagem não passa no schema (aviso ${count}/${this.opts.invalidKickAt} — kick ao atingir o limite).`
              : 'Mensagem não passa no schema do protocolo.',
        },
      });
      return;
    }
    if (!isCompatibleVersion(msg.v)) {
      send(ws, {
        v: PROTOCOL_VERSION,
        type: 'error',
        payload: {
          code: 'version_mismatch',
          message: `Servidor fala protocolo ${PROTOCOL_VERSION}.`,
        },
      });
      return;
    }

    if (msg.type === 'hello') {
      // Token válido usa o nome registrado; sem token joga como convidado.
      let name = msg.payload.agentName;
      if (msg.payload.token && this.store) {
        const known = this.store.authenticate(msg.payload.token);
        if (known) name = known.name;
      }
      this.onHello(ws, name);
      return;
    }

    const series = this.bySocket.get(ws);
    const match = series?.current;
    if (!match || match.finished) {
      send(ws, {
        v: PROTOCOL_VERSION,
        type: 'error',
        payload: { code: 'not_in_match', message: 'Nenhuma partida ativa para receber decisões.' },
      });
      return;
    }
    if (msg.unitId !== undefined) {
      const team = match.seats.cian.ws === ws ? 'cian' : 'magenta';
      match.submitDecision(team, msg.unitId, msg.payload);
    }
  }

  private onHello(ws: WebSocket, name: string): void {
    if (this.waiting && this.waiting.ws !== ws) {
      const seriesId = `s${++this.counter}`;
      const series = new Series(
        seriesId,
        { ws: this.waiting.ws, name: this.waiting.name },
        { ws, name },
        this.opts,
        this.store,
        (m) => {
          this.latest = m;
        },
        () => {
          /* série concluída; sockets podem encerrar */
        },
      );
      this.bySocket.set(this.waiting.ws, series);
      this.bySocket.set(ws, series);
      this.waiting = null;
      console.log(`[echo-front] série ${seriesId}: ${series.a.name} × ${series.b.name}`);
      series.start();
    } else {
      this.waiting = { ws, name };
      console.log(`[echo-front] "${name}" aguardando adversário`);
    }
  }

  private onClose(ws: WebSocket): void {
    if (this.waiting?.ws === ws) this.waiting = null;
    this.bySocket.get(ws)?.detach(ws);
    this.bySocket.delete(ws);
    this.invalidCount.delete(ws);
    const ip = this.agentIpBySocket.get(ws);
    if (ip) {
      this.agentLimiter?.release(ip);
      this.agentIpBySocket.delete(ws);
    }
  }
}

/** Singleton usado pelos gateways Nest (evita depender de metadata de DI nos testes). */
export const agentServer = new AgentServer();
