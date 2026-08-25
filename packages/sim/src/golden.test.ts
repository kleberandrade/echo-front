/**
 * Golden replays (docs/05-simulacao.md): replays canônicos re-simulados no CI.
 * Qualquer mudança de comportamento do sim quebra estes testes — se a mudança
 * for intencional, regenere as fixtures com o CLI e documente no doc da sprint:
 *   node dist/cli.js --seed golden-alpha --cycles 60 --bots random,random \
 *     --out fixtures/golden-alpha.replay.jsonl
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { replayFromJsonl, resimulate } from './match.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

const GOLDEN = [
  // Regeneradas em 2026-08-25 (Sprint 7): unidades ganharam lastAllies
  // (snapshot de aliados para interferência) — mudança intencional.
  { file: 'golden-alpha.replay.jsonl', hash: 'f813111521f84252', cycles: 60 },
  { file: 'golden-beta.replay.jsonl', hash: '796156d102104588', cycles: 90 },
  { file: 'golden-gamma.replay.jsonl', hash: 'a8af2c765bc50a1f', cycles: 180 },
];

describe('golden replays', () => {
  for (const g of GOLDEN) {
    it(`${g.file} re-simula com hash ${g.hash}`, () => {
      const replay = replayFromJsonl(readFileSync(join(fixturesDir, g.file), 'utf8'));
      expect(replay.finalHash).toBe(g.hash);
      const final = resimulate(replay); // lança se o hash divergir
      expect(final.cycle).toBe(g.cycles);
      expect(final.ended).toBe(true);
    });
  }
});
