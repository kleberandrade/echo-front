/**
 * Sprint 12: standings() acumula o histórico inteiro por padrão — é assim
 * que o Elo persiste entre execuções em vez de ser recalculado do zero a
 * cada rodada — e aceita um filtro opcional por temporada.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Replay } from '@echo-front/sim';
import { MatchStore, type MatchResult } from './store.js';

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

describe('MatchStore.standings — persistência entre execuções (sprint-12)', () => {
  let dir: string;
  let store: MatchStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'echo-front-store-'));
    store = new MatchStore(dir);
  });

  afterEach(() => {
    // dirs de teste ficam em /tmp — sem cleanup explícito, o SO cuida disso.
  });

  it('sem filtro, soma resultados de "execuções" diferentes (sem season e com season)', () => {
    store.recordResult(result({ matchId: 'm1' }), FAKE_REPLAY); // sem rótulo (histórico "legado")
    store.recordResult(result({ matchId: 'm2', season: 'temporada-3' }), FAKE_REPLAY);
    const standings = store.standings();
    const a = standings.find((s) => s.agent === 'a')!;
    expect(a.matches).toBe(2); // as duas contam — nada foi descartado entre execuções
    expect(a.elo).toBeGreaterThan(1000); // duas vitórias seguidas sobem o Elo
  });

  it('com filtro de season, conta só os resultados daquele rótulo', () => {
    store.recordResult(result({ matchId: 'm1' }), FAKE_REPLAY); // sem rótulo
    store.recordResult(result({ matchId: 'm2', season: 'temporada-3' }), FAKE_REPLAY);
    store.recordResult(result({ matchId: 'm3', season: 'temporada-3' }), FAKE_REPLAY);
    const s3 = store.standings('temporada-3');
    expect(s3.find((s) => s.agent === 'a')!.matches).toBe(2);

    const legado = store.standings('legado'); // rótulo que não existe em nenhum resultado
    expect(legado).toEqual([]);
  });

  it('resultados persistem entre instâncias diferentes de MatchStore apontando pro mesmo dir', () => {
    store.recordResult(result({ matchId: 'm1' }), FAKE_REPLAY);
    const reopened = new MatchStore(dir); // simula um novo processo/execução
    expect(reopened.standings().find((s) => s.agent === 'a')!.matches).toBe(1);
  });
});
