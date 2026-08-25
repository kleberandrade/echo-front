/**
 * Persistência de agentes, resultados e replays — arquivos em disco.
 * Interface pensada para trocar por Postgres/objeto sem tocar no resto
 * (decisão registrada na sprint-06).
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
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

export class MatchStore {
  constructor(readonly dir: string) {
    mkdirSync(join(dir, 'replays'), { recursive: true });
  }

  private agentsPath(): string {
    return join(this.dir, 'agents.json');
  }

  private resultsPath(): string {
    return join(this.dir, 'results.jsonl');
  }

  listAgents(): RegisteredAgent[] {
    if (!existsSync(this.agentsPath())) return [];
    return JSON.parse(readFileSync(this.agentsPath(), 'utf8')) as RegisteredAgent[];
  }

  /** Registra (ou retorna) um agente pelo nome; token identifica o dono. */
  registerAgent(name: string): RegisteredAgent {
    const agents = this.listAgents();
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

  authenticate(token: string): RegisteredAgent | undefined {
    return this.listAgents().find((a) => a.token === token);
  }

  recordResult(result: MatchResult, replay: Replay): void {
    appendFileSync(this.resultsPath(), JSON.stringify(result) + '\n');
    writeFileSync(join(this.dir, 'replays', `${result.matchId}.replay.jsonl`), replayToJsonl(replay));
  }

  listResults(): MatchResult[] {
    if (!existsSync(this.resultsPath())) return [];
    return readFileSync(this.resultsPath(), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as MatchResult);
  }

  readReplay(matchId: string): string | undefined {
    const p = join(this.dir, 'replays', `${matchId}.replay.jsonl`);
    return existsSync(p) ? readFileSync(p, 'utf8') : undefined;
  }

  listReplayIds(): string[] {
    const dir = join(this.dir, 'replays');
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith('.replay.jsonl'))
      .map((f) => f.replace('.replay.jsonl', ''));
  }

  standings(): StandingRow[] {
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
    for (const r of this.listResults()) {
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
}
