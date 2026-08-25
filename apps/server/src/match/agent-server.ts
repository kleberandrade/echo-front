/**
 * Núcleo do servidor de partidas — framework-free (o gateway Nest delega aqui).
 * Lobby de 2 agentes → LiveMatch com loop de ciclos em tempo real,
 * timeout implícito de decisão (o que não chegou até o fechamento vira no-op),
 * canal de espectador e replay JSONL em disco.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
  replayToJsonl,
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

export interface AgentServerOptions {
  /** Duração real de um ciclo em ms (500 = tempo de jogo 1:1). */
  cycleMs: number;
  cfg: MatchConfig;
  /** Diretório onde replays são gravados; vazio desativa a gravação. */
  replayDir: string;
  seedFor: (matchId: string) => string;
}

const DEFAULT_OPTIONS: AgentServerOptions = {
  cycleMs: 500,
  cfg: DEFAULT_CONFIG,
  replayDir: 'replays',
  seedFor: (id) => `seed-${id}`,
};

interface Seat {
  team: Team;
  ws: WebSocket | null;
  name: string;
}

function send(ws: WebSocket | null, msg: unknown): void {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

export class LiveMatch {
  state: MatchState;
  private decisions: DecisionsByUnit = {};
  private cycles: ReplayCycleRecord[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private spectators = new Set<WebSocket>();
  onEnd: ((replay: Replay) => void) | undefined;

  constructor(
    readonly id: string,
    readonly seed: string,
    readonly seats: Record<Team, Seat>,
    private readonly opts: AgentServerOptions,
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
          seedPublic: stateHash(this.state), // hash do estado inicial ≈ compromisso com a semente
          map: ARENA_ALPHA.id,
        },
      });
      send(this.seats[team].ws, {
        v: PROTOCOL_VERSION,
        type: 'match_start',
        payload: { cycle: 0 as const, mode: 'data_run' as const },
      });
    }
    this.sendPerceptions();
    this.timer = setInterval(() => this.closeCycle(), this.opts.cycleMs);
  }

  /** Fecha o ciclo corrente: aplica o que chegou (resto vira no-op) e avança. */
  private closeCycle(): void {
    const decisions = this.decisions;
    this.decisions = {};
    this.cycles.push({ c: this.state.cycle, d: decisions });
    this.state = stepCycle(this.state, decisions, ARENA_ALPHA, this.opts.cfg).state;

    for (const ws of this.spectators) {
      send(ws, { type: 'spectate_state', matchId: this.id, state: this.state });
    }

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
    const { score } = this.state;
    const endMsg = {
      v: PROTOCOL_VERSION,
      type: 'match_end',
      payload: {
        score,
        winner: decideWinner(this.state),
        reason: this.state.endReason ?? ('time_up' as const),
        seed: this.seed,
        finalHash: replay.finalHash,
      },
    };
    send(this.seats.cian.ws, endMsg);
    send(this.seats.magenta.ws, endMsg);
    for (const ws of this.spectators) send(ws, { type: 'spectate_end', ...endMsg.payload });

    if (this.opts.replayDir) {
      try {
        mkdirSync(this.opts.replayDir, { recursive: true });
        writeFileSync(join(this.opts.replayDir, `${this.id}.replay.jsonl`), replayToJsonl(replay));
      } catch (err) {
        console.error(`[echo-front] falha ao gravar replay de ${this.id}:`, err);
      }
    }
    this.onEnd?.(replay);
  }
}

export class AgentServer {
  private opts: AgentServerOptions = { ...DEFAULT_OPTIONS };
  private waiting: { ws: WebSocket; name: string } | null = null;
  private bySocket = new Map<WebSocket, { match: LiveMatch; team: Team }>();
  private latest: LiveMatch | null = null;
  private counter = 0;
  onMatchEnd: ((match: LiveMatch, replay: Replay) => void) | undefined;

  configure(opts: Partial<AgentServerOptions>): void {
    this.opts = { ...this.opts, ...opts };
  }

  attachAgentSocket(ws: WebSocket): void {
    ws.on('message', (raw: Buffer) => this.onMessage(ws, raw));
    ws.on('close', () => this.onClose(ws));
  }

  attachSpectatorSocket(ws: WebSocket): void {
    if (this.latest) this.latest.addSpectator(ws);
    else send(ws, { type: 'spectate_idle', message: 'nenhuma partida em andamento' });
  }

  private onMessage(ws: WebSocket, raw: Buffer): void {
    let msg;
    try {
      msg = parseAgentMessage(raw.toString('utf8'));
    } catch {
      send(ws, {
        v: PROTOCOL_VERSION,
        type: 'error',
        payload: { code: 'invalid_payload', message: 'Mensagem não passa no schema do protocolo.' },
      });
      return;
    }
    if (!isCompatibleVersion(msg.v)) {
      send(ws, {
        v: PROTOCOL_VERSION,
        type: 'error',
        payload: { code: 'version_mismatch', message: `Servidor fala protocolo ${PROTOCOL_VERSION}.` },
      });
      return;
    }

    if (msg.type === 'hello') {
      this.onHello(ws, msg.payload.agentName);
      return;
    }

    // decision
    const seat = this.bySocket.get(ws);
    if (!seat || seat.match.finished) {
      send(ws, {
        v: PROTOCOL_VERSION,
        type: 'error',
        payload: { code: 'not_in_match', message: 'Nenhuma partida ativa para receber decisões.' },
      });
      return;
    }
    if (msg.unitId !== undefined) {
      seat.match.submitDecision(seat.team, msg.unitId, msg.payload);
    }
  }

  private onHello(ws: WebSocket, name: string): void {
    if (this.waiting && this.waiting.ws !== ws) {
      const matchId = `m${++this.counter}`;
      const seed = this.opts.seedFor(matchId);
      const match = new LiveMatch(
        matchId,
        seed,
        {
          cian: { team: 'cian', ws: this.waiting.ws, name: this.waiting.name },
          magenta: { team: 'magenta', ws, name },
        },
        this.opts,
      );
      this.bySocket.set(this.waiting.ws, { match, team: 'cian' });
      this.bySocket.set(ws, { match, team: 'magenta' });
      this.latest = match;
      match.onEnd = (replay) => this.onMatchEnd?.(match, replay);
      this.waiting = null;
      console.log(`[echo-front] partida ${matchId} iniciada (seed=${seed})`);
      match.start();
    } else {
      this.waiting = { ws, name };
      console.log(`[echo-front] "${name}" aguardando adversário`);
    }
  }

  private onClose(ws: WebSocket): void {
    if (this.waiting?.ws === ws) this.waiting = null;
    const seat = this.bySocket.get(ws);
    if (seat) {
      seat.match.detachSeat(ws); // unidades do time ficam em no-op; a partida segue
      this.bySocket.delete(ws);
    }
  }
}

/** Singleton usado pelos gateways Nest (evita depender de metadata de DI nos testes). */
export const agentServer = new AgentServer();
