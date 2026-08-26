/**
 * Persistência de agentes, resultados e replays.
 *
 * `Store` é a interface (async — pensada desde a sprint-06 pra trocar a
 * implementação sem tocar no resto). `FileMatchStore` é o padrão (arquivos
 * em disco, zero dependência externa); `PgMatchStore` (sprint-15) é a opção
 * apoiada em Postgres, ligada automaticamente quando `DATABASE_URL` está no
 * ambiente (ver `AgentServer.initStore` em `agent-server.ts`). As duas
 * implementam exatamente a mesma interface e reusam `computeStandings` —
 * o cálculo de Elo/pontuação nunca diverge entre elas.
 */
import { randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import type { Team } from '@echo-front/protocol';
import { decideWinner, replayToJsonl, type MatchState, type Replay } from '@echo-front/sim';

export interface RegisteredAgent {
  name: string;
  token: string;
  createdAt: string;
}

export interface MatchResult {
  matchId: string;
  seriesId: string;
  game: number;
  /** Modo de disputa da partida. */
  mode: string;
  seed: string;
  finalHash: string;
  agents: { cian: string; magenta: string }; // nomes
  score: { cian: number; magenta: number };
  winner: Team | 'draw';
  reason: string;
  /** Pontos do regulamento (docs/07-campeonato.md) por agente. */
  points: { cian: number; magenta: number };
  stats: {
    unitsAlive: { cian: number; magenta: number };
    energySpent: { cian: number; magenta: number };
    kills: number;
  };
  finishedAt: string;
  /**
   * Rótulo de temporada (sprint-12), opcional — ex. "temporada-3". Serve só
   * para filtrar `standings(season)`; o histórico completo nunca é
   * descartado — sem filtro, `standings()` soma tudo (é assim que o Elo
   * persiste entre rodadas em vez de ser recalculado do zero a cada uma).
   */
  season?: string;
}

export interface StandingRow {
  agent: string;
  points: number;
  /** Rating Elo (K=32, inicial 1000), atualizado partida a partida. */
  elo: number;
  wins: number;
  draws: number;
  losses: number;
  matches: number;
  fragmentsDelivered: number;
  noKillWins: number;
}

/**
 * Interface de persistência — implementada por `FileMatchStore` (padrão) e
 * `PgMatchStore` (Postgres). Async de propósito: mesmo a implementação em
 * arquivo, que não precisa, expõe o mesmo contrato pra que o resto do
 * código (agent-server.ts, api.controller.ts, tournament.ts) não saiba nem
 * precise saber qual das duas está por trás.
 */
export interface Store {
  listAgents(): Promise<RegisteredAgent[]>;
  /** Registra (ou retorna) um agente pelo nome; token identifica o dono. */
  registerAgent(name: string): Promise<RegisteredAgent>;
  authenticate(token: string): Promise<RegisteredAgent | undefined>;
  recordResult(result: MatchResult, replay: Replay): Promise<void>;
  listResults(): Promise<MatchResult[]>;
  readReplay(matchId: string): Promise<string | undefined>;
  listReplayIds(): Promise<string[]>;
  /**
   * Classificação a partir do histórico completo (persiste entre execuções
   * — não é recalculada do zero a cada rodada). Passe `season` para
   * restringir a uma temporada específica (sprint-12); sem argumento, soma
   * tudo o que já foi jogado, com ou sem rótulo de temporada.
   */
  standings(season?: string): Promise<StandingRow[]>;
}

const ELO_K = 32;
const ELO_START = 1000;

function eloExpected(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** Pontuação por partida (docs/07-campeonato.md). */
export function scoreMatch(state: MatchState): { cian: number; magenta: number } {
  const winner = decideWinner(state);
  const points = { cian: 0, magenta: 0 };
  for (const team of ['cian', 'magenta'] as const) {
    if (winner === team) points[team] += 3;
    else if (winner === 'draw') points[team] += 1;
    points[team] += Math.min(1.5, state.score[team] * 0.5); // fragmentos entregues
    const alive = state.units.filter((u) => u.team === team && u.alive).length;
    points[team] += alive * 0.1;
  }
  const spent = (team: Team) =>
    state.units.filter((u) => u.team === team).reduce((a, u) => a + u.energySpent, 0);
  if (spent('cian') !== spent('magenta')) {
    points[spent('cian') < spent('magenta') ? 'cian' : 'magenta'] += 0.2;
  }
  points.cian = Math.round(points.cian * 10) / 10;
  points.magenta = Math.round(points.magenta * 10) / 10;
  return points;
}

/**
 * Elo + agregados a partir de uma lista de resultados já filtrada por
 * season (se for o caso) — compartilhada por `FileMatchStore` e
 * `PgMatchStore` pra que o cálculo nunca divirja entre as duas.
 */
export function computeStandings(results: MatchResult[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  const get = (agent: string): StandingRow => {
    if (!rows.has(agent)) {
      rows.set(agent, {
        agent,
        points: 0,
        elo: ELO_START,
        wins: 0,
        draws: 0,
        losses: 0,
        matches: 0,
        fragmentsDelivered: 0,
        noKillWins: 0,
      });
    }
    return rows.get(agent)!;
  };
  for (const r of results) {
    // Elo: atualizado na ordem cronológica dos resultados.
    const rowC = get(r.agents.cian);
    const rowM = get(r.agents.magenta);
    const scoreC = r.winner === 'cian' ? 1 : r.winner === 'draw' ? 0.5 : 0;
    const expC = eloExpected(rowC.elo, rowM.elo);
    const deltaC = ELO_K * (scoreC - expC);
    rowC.elo = Math.round((rowC.elo + deltaC) * 10) / 10;
    rowM.elo = Math.round((rowM.elo - deltaC) * 10) / 10;

    for (const team of ['cian', 'magenta'] as const) {
      const row = get(r.agents[team]);
      row.matches += 1;
      row.points = Math.round((row.points + r.points[team]) * 10) / 10;
      row.fragmentsDelivered += r.score[team];
      if (r.winner === team) {
        row.wins += 1;
        if (r.stats.kills === 0) row.noKillWins += 1;
      } else if (r.winner === 'draw') row.draws += 1;
      else row.losses += 1;
    }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.elo - a.elo || b.wins - a.wins);
}

/** Implementação padrão — arquivos em disco, sem dependência externa. */
export class FileMatchStore implements Store {
  constructor(readonly dir: string) {
    mkdirSync(join(dir, 'replays'), { recursive: true });
  }

  private agentsPath(): string {
    return join(this.dir, 'agents.json');
  }

  private resultsPath(): string {
    return join(this.dir, 'results.jsonl');
  }

  async listAgents(): Promise<RegisteredAgent[]> {
    if (!existsSync(this.agentsPath())) return [];
    return JSON.parse(readFileSync(this.agentsPath(), 'utf8')) as RegisteredAgent[];
  }

  async registerAgent(name: string): Promise<RegisteredAgent> {
    const agents = await this.listAgents();
    const found = agents.find((a) => a.name === name);
    if (found) return found;
    const agent: RegisteredAgent = {
      name,
      token: randomBytes(16).toString('hex'),
      createdAt: new Date().toISOString(),
    };
    agents.push(agent);
    writeFileSync(this.agentsPath(), JSON.stringify(agents, null, 2));
    return agent;
  }

  async authenticate(token: string): Promise<RegisteredAgent | undefined> {
    return (await this.listAgents()).find((a) => a.token === token);
  }

  async recordResult(result: MatchResult, replay: Replay): Promise<void> {
    appendFileSync(this.resultsPath(), JSON.stringify(result) + '\n');
    writeFileSync(
      join(this.dir, 'replays', `${result.matchId}.replay.jsonl`),
      replayToJsonl(replay),
    );
  }

  async listResults(): Promise<MatchResult[]> {
    if (!existsSync(this.resultsPath())) return [];
    return readFileSync(this.resultsPath(), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as MatchResult);
  }

  async readReplay(matchId: string): Promise<string | undefined> {
    const p = join(this.dir, 'replays', `${matchId}.replay.jsonl`);
    return existsSync(p) ? readFileSync(p, 'utf8') : undefined;
  }

  async listReplayIds(): Promise<string[]> {
    const dir = join(this.dir, 'replays');
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith('.replay.jsonl'))
      .map((f) => f.replace('.replay.jsonl', ''));
  }

  async standings(season?: string): Promise<StandingRow[]> {
    const results = await this.listResults();
    return computeStandings(season ? results.filter((r) => r.season === season) : results);
  }
}
