/**
 * Sprint 12: standings() acumula o histórico inteiro por padrão — é assim
 * que o Elo persiste entre execuções em vez de ser recalculado do zero a
 * cada rodada — e aceita um filtro opcional por temporada.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Replay } from '@echo-front/sim';
import { FileMatchStore, type MatchResult } from './store.js';

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
    stats: { unitsAlive: { cian: 2, magenta: 2 }, energySpent: { cian: 0, magenta: 0 }, kills: 0 },
    finishedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

const FAKE_REPLAY = { finalHash: 'hash', cycles: [], meta: {} } as unknown as Replay;

describe('FileMatchStore.standings — persistência entre execuções (sprint-12)', () => {
  let dir: string;
  let store: FileMatchStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'echo-front-store-'));
    store = new FileMatchStore(dir);
  });

  it('sem filtro, soma resultados de "execuções" diferentes (sem season e com season)', async () => {
    await store.recordResult(result({ matchId: 'm1' }), FAKE_REPLAY); // sem rótulo (histórico "legado")
    await store.recordResult(result({ matchId: 'm2', season: 'temporada-3' }), FAKE_REPLAY);
    const standings = await store.standings();
    const a = standings.find((s) => s.agent === 'a')!;
    expect(a.matches).toBe(2); // as duas contam — nada foi descartado entre execuções
    expect(a.elo).toBeGreaterThan(1000); // duas vitórias seguidas sobem o Elo
  });

  it('com filtro de season, conta só os resultados daquele rótulo', async () => {
    await store.recordResult(result({ matchId: 'm1' }), FAKE_REPLAY); // sem rótulo
    await store.recordResult(result({ matchId: 'm2', season: 'temporada-3' }), FAKE_REPLAY);
    await store.recordResult(result({ matchId: 'm3', season: 'temporada-3' }), FAKE_REPLAY);
    const s3 = await store.standings('temporada-3');
    expect(s3.find((s) => s.agent === 'a')!.matches).toBe(2);

    const legado = await store.standings('legado'); // rótulo que não existe em nenhum resultado
    expect(legado).toEqual([]);
  });

  it('resultados persistem entre instâncias diferentes de FileMatchStore apontando pro mesmo dir', async () => {
    await store.recordResult(result({ matchId: 'm1' }), FAKE_REPLAY);
    const reopened = new FileMatchStore(dir); // simula um novo processo/execução
    expect((await reopened.standings()).find((s) => s.agent === 'a')!.matches).toBe(1);
  });
});
