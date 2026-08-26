/**
 * Store apoiado em Postgres (sprint-15 — débito registrado desde a
 * sprint-06: "interface pensada para trocar por Postgres sem tocar no
 * resto"). Ligado automaticamente quando `DATABASE_URL` está no ambiente
 * (ver `AgentServer.initStore`, agent-server.ts) — pensado pro Neon (adição
 * do usuário via integração Vercel), mas funciona com qualquer Postgres:
 * usa só `pg` puro, nenhuma API específica do Neon.
 *
 * Schema criado sob demanda (`CREATE TABLE IF NOT EXISTS`) na primeira
 * query — sem ferramenta de migração externa; o schema é pequeno o
 * suficiente pra não justificar uma (se crescer, é o primeiro lugar pra
 * trocar por uma migração de verdade).
 */
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import type { Team } from '@echo-front/protocol';
import { replayToJsonl, type Replay } from '@echo-front/sim';
import {
  computeStandings,
  type MatchResult,
  type RegisteredAgent,
  type StandingRow,
  type Store,
} from './store.js';

const SCHEMA_SQL = `
create table if not exists agents (
  name text primary key,
  token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists results (
  match_id text primary key,
  series_id text not null,
  game integer not null,
  mode text not null,
  seed text not null,
  final_hash text not null,
  agent_cian text not null,
  agent_magenta text not null,
  score_cian integer not null,
  score_magenta integer not null,
  winner text not null,
  reason text not null,
  points_cian numeric not null,
  points_magenta numeric not null,
  units_alive_cian integer not null,
  units_alive_magenta integer not null,
  energy_spent_cian numeric not null,
  energy_spent_magenta numeric not null,
  kills integer not null,
  finished_at timestamptz not null,
  season text
);
create index if not exists results_season_idx on results (season);
create index if not exists results_finished_at_idx on results (finished_at);

create table if not exists replays (
  match_id text primary key references results (match_id) on delete cascade,
  content text not null
);
`;

export class PgMatchStore implements Store {
  private readonly pool: Pool;
  private readonly ready: Promise<void>;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.ready = this.pool.query(SCHEMA_SQL).then(() => undefined);
  }

  /** Fecha o pool de conexões — usado nos testes; opcional em produção (o processo some junto). */
  async close(): Promise<void> {
    await this.ready.catch(() => undefined);
    await this.pool.end();
  }

  async listAgents(): Promise<RegisteredAgent[]> {
    await this.ready;
    const { rows } = await this.pool.query<{ name: string; token: string; created_at: Date }>(
      'select name, token, created_at from agents order by created_at asc',
    );
    return rows.map((r) => ({
      name: r.name,
      token: r.token,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async registerAgent(name: string): Promise<RegisteredAgent> {
    await this.ready;
    const existing = await this.pool.query<{ name: string; token: string; created_at: Date }>(
      'select name, token, created_at from agents where name = $1',
      [name],
    );
    if (existing.rows.length > 0) {
      const r = existing.rows[0]!;
      return { name: r.name, token: r.token, createdAt: r.created_at.toISOString() };
    }
    const token = randomBytes(16).toString('hex');
    const { rows } = await this.pool.query<{ name: string; token: string; created_at: Date }>(
      'insert into agents (name, token) values ($1, $2) returning name, token, created_at',
      [name, token],
    );
    const r = rows[0]!;
    return { name: r.name, token: r.token, createdAt: r.created_at.toISOString() };
  }

  async authenticate(token: string): Promise<RegisteredAgent | undefined> {
    await this.ready;
    const { rows } = await this.pool.query<{ name: string; token: string; created_at: Date }>(
      'select name, token, created_at from agents where token = $1',
      [token],
    );
    const r = rows[0];
    return r ? { name: r.name, token: r.token, createdAt: r.created_at.toISOString() } : undefined;
  }

  async recordResult(result: MatchResult, replay: Replay): Promise<void> {
    await this.ready;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into results (
           match_id, series_id, game, mode, seed, final_hash,
           agent_cian, agent_magenta, score_cian, score_magenta,
           winner, reason, points_cian, points_magenta,
           units_alive_cian, units_alive_magenta,
           energy_spent_cian, energy_spent_magenta, kills,
           finished_at, season
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         on conflict (match_id) do nothing`,
        [
          result.matchId,
          result.seriesId,
          result.game,
          result.mode,
          result.seed,
          result.finalHash,
          result.agents.cian,
          result.agents.magenta,
          result.score.cian,
          result.score.magenta,
          result.winner,
          result.reason,
          result.points.cian,
          result.points.magenta,
          result.stats.unitsAlive.cian,
          result.stats.unitsAlive.magenta,
          result.stats.energySpent.cian,
          result.stats.energySpent.magenta,
          result.stats.kills,
          result.finishedAt,
          result.season ?? null,
        ],
      );
      await client.query(
        'insert into replays (match_id, content) values ($1, $2) on conflict (match_id) do nothing',
        [result.matchId, replayToJsonl(replay)],
      );
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async listResults(): Promise<MatchResult[]> {
    await this.ready;
    const { rows } = await this.pool.query('select * from results order by finished_at asc');
    return rows.map(rowToResult);
  }

  async readReplay(matchId: string): Promise<string | undefined> {
    await this.ready;
    const { rows } = await this.pool.query<{ content: string }>(
      'select content from replays where match_id = $1',
      [matchId],
    );
    return rows[0]?.content;
  }

  async listReplayIds(): Promise<string[]> {
    await this.ready;
    const { rows } = await this.pool.query<{ match_id: string }>('select match_id from replays');
    return rows.map((r) => r.match_id);
  }

  async standings(season?: string): Promise<StandingRow[]> {
    const results = season
      ? (await this.listResults()).filter((r) => r.season === season)
      : await this.listResults();
    return computeStandings(results);
  }
}

interface ResultRow {
  match_id: string;
  series_id: string;
  game: number;
  mode: string;
  seed: string;
  final_hash: string;
  agent_cian: string;
  agent_magenta: string;
  score_cian: number;
  score_magenta: number;
  winner: string;
  reason: string;
  points_cian: string;
  points_magenta: string;
  units_alive_cian: number;
  units_alive_magenta: number;
  energy_spent_cian: string;
  energy_spent_magenta: string;
  kills: number;
  finished_at: Date;
  season: string | null;
}

function rowToResult(r: ResultRow): MatchResult {
  return {
    matchId: r.match_id,
    seriesId: r.series_id,
    game: r.game,
    mode: r.mode,
    seed: r.seed,
    finalHash: r.final_hash,
    agents: { cian: r.agent_cian, magenta: r.agent_magenta },
    score: { cian: r.score_cian, magenta: r.score_magenta },
    winner: r.winner as Team | 'draw',
    reason: r.reason,
    points: { cian: Number(r.points_cian), magenta: Number(r.points_magenta) },
    stats: {
      unitsAlive: { cian: r.units_alive_cian, magenta: r.units_alive_magenta },
      energySpent: { cian: Number(r.energy_spent_cian), magenta: Number(r.energy_spent_magenta) },
      kills: r.kills,
    },
    finishedAt: r.finished_at.toISOString(),
    ...(r.season ? { season: r.season } : {}),
  };
}
