/**
 * Testes do PgMatchStore contra um Postgres de verdade (sprint-15). Pulados
 * automaticamente se `TEST_DATABASE_URL` não estiver no ambiente — dev
 * local sem Postgres instalado, e CI sem o serviço configurado, continuam
 * rodando o resto da suíte normalmente (só este arquivo é pulado). O
 * workflow de CI (.github/workflows/ci.yml) sobe um serviço `postgres` e
 * define essa env var, então esta suíte roda de verdade lá.
 *
 * Mesma bateria de casos de store.test.ts (FileMatchStore) — os dois stores
 * implementam a mesma interface (`Store`) e reusam `computeStandings`, mas
 * PgMatchStore tem lógica própria de SQL/serialização que merece cobertura
 * direta (season nulo vs string, tipos numeric do Postgres virando number
 * de volta, replay round-trip via BEGIN/COMMIT, etc).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { replayFromJsonl, type Replay } from '@echo-front/sim';
import { PgMatchStore } from './store-pg.js';
import type { MatchResult } from './store.js';

const DATABASE_URL = process.env.TEST_DATABASE_URL;

function result(overrides: Partial<MatchResult> & { matchId: string }): MatchResult {
  return {
    seriesId: overrides.matchId,
    game: 1,
    mode: 'data_run',
    seed: 'seed',
    finalHash: 'hash',
    agents: { cian: 'a', magenta: 'b' },
    score: { cian: 1, magenta: 0 },
    winner: 'cian',
    reason: 'time_up',
    points: { cian: 3, magenta: 0 },
    stats: {
      unitsAlive: { cian: 2, magenta: 2 },
      energySpent: { cian: 0.5, magenta: 1.5 },
      kills: 0,
    },
    finishedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

const FAKE_REPLAY: Replay = {
  header: { sim: '0.0.0-test', map: 'arena_alpha@1', seed: 'seed', config: {} as never },
  cycles: [{ c: 0, d: {} }],
  finalHash: 'hash',
};

describe.skipIf(!DATABASE_URL)('PgMatchStore (sprint-15)', () => {
  let store: PgMatchStore;
  // Prefixo único por execução: os testes rodam contra um schema
  // compartilhado (tabelas não são recriadas por teste), então os nomes de
  // agente/matchId precisam não colidir entre runs.
  const prefix = randomUUID().slice(0, 8);

  beforeEach(() => {
    store = new PgMatchStore(DATABASE_URL!);
  });

  afterAll(async () => {
    if (DATABASE_URL) await new PgMatchStore(DATABASE_URL).close();
  });

  it('registerAgent é idempotente por nome (mesmo token em chamadas repetidas)', async () => {
    const name = `${prefix}-agente`;
    const a = await store.registerAgent(name);
    const b = await store.registerAgent(name);
    expect(b.token).toBe(a.token);
  });

  it('authenticate encontra o agente pelo token; token desconhecido devolve undefined', async () => {
    const name = `${prefix}-auth`;
    const agent = await store.registerAgent(name);
    expect((await store.authenticate(agent.token))?.name).toBe(name);
    expect(await store.authenticate('token-que-nao-existe')).toBeUndefined();
  });

  it('recordResult grava resultado + replay; readReplay devolve o JSONL de volta', async () => {
    const matchId = `${prefix}-m1`;
    await store.recordResult(
      result({ matchId, agents: { cian: `${prefix}-a`, magenta: `${prefix}-b` } }),
      FAKE_REPLAY,
    );
    const replay = await store.readReplay(matchId);
    expect(replay).toBeDefined();
    expect(replayFromJsonl(replay!)).toEqual(FAKE_REPLAY);
  });

  it('recordResult é idempotente (on conflict do nothing) — não duplica em standings', async () => {
    const matchId = `${prefix}-dup`;
    const agents = { cian: `${prefix}-c`, magenta: `${prefix}-d` };
    await store.recordResult(result({ matchId, agents }), FAKE_REPLAY);
    await store.recordResult(result({ matchId, agents }), FAKE_REPLAY); // mesmo matchId de novo
    const standings = await store.standings();
    expect(standings.find((s) => s.agent === agents.cian)!.matches).toBe(1);
  });

  it('standings: sem filtro soma tudo; com season, só o rótulo pedido — e tipos numeric voltam como number', async () => {
    const agents = { cian: `${prefix}-e`, magenta: `${prefix}-f` };
    await store.recordResult(result({ matchId: `${prefix}-s1`, agents }), FAKE_REPLAY); // sem season
    await store.recordResult(
      result({ matchId: `${prefix}-s2`, agents, season: 'temporada-x' }),
      FAKE_REPLAY,
    );

    const all = await store.standings();
    const rowAll = all.find((s) => s.agent === agents.cian)!;
    expect(rowAll.matches).toBe(2);
    expect(typeof rowAll.elo).toBe('number');
    expect(rowAll.elo).toBeGreaterThan(1000); // duas vitórias

    const filtered = await store.standings('temporada-x');
    expect(filtered.find((s) => s.agent === agents.cian)!.matches).toBe(1);

    const nada = await store.standings('rotulo-inexistente');
    expect(nada.find((s) => s.agent === agents.cian)).toBeUndefined();
  });

  it('listResults preserva points/energySpent como number (não string do driver pg)', async () => {
    const matchId = `${prefix}-num`;
    await store.recordResult(
      result({ matchId, agents: { cian: `${prefix}-g`, magenta: `${prefix}-h` } }),
      FAKE_REPLAY,
    );
    const results = await store.listResults();
    const r = results.find((x) => x.matchId === matchId)!;
    expect(typeof r.points.cian).toBe('number');
    expect(typeof r.stats.energySpent.cian).toBe('number');
    expect(r.stats.energySpent.magenta).toBe(1.5);
  });

  it('listReplayIds inclui os matchIds gravados', async () => {
    const matchId = `${prefix}-ids`;
    await store.recordResult(
      result({ matchId, agents: { cian: `${prefix}-i`, magenta: `${prefix}-j` } }),
      FAKE_REPLAY,
    );
    expect(await store.listReplayIds()).toContain(matchId);
  });

  it('reabrir com uma nova instância (mesma connection string) enxerga os dados persistidos', async () => {
    const name = `${prefix}-persist`;
    await store.registerAgent(name);
    const reopened = new PgMatchStore(DATABASE_URL!);
    const agents = await reopened.listAgents();
    expect(agents.some((a) => a.name === name)).toBe(true);
    await reopened.close();
  });
});
