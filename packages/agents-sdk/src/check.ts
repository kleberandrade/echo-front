/**
 * Verificador de conformidade self-service (sprint-06):
 *   pnpm --filter @echo-front/agents-sdk agent:check -- ./meu-agente.mjs
 *
 * O módulo deve exportar `decide(unitId, perception, cycle) → decision`.
 * Roda uma partida headless contra o wanderer validando cada decisão contra
 * o schema do protocolo, e reporta erros com contexto.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { DecisionPayloadSchema, type DecisionPayload, type PerceptionPayload } from '@echo-front/protocol';
import { DEFAULT_CONFIG, decideWinner, resimulate, runPerceptionMatch } from '@echo-front/sim';
import { wandererBot } from './bots.js';

const file = process.argv[2];
if (!file) {
  console.error('uso: agent:check <arquivo do agente .mjs|.js>');
  process.exit(2);
}

type DecideFn = (unitId: string, p: PerceptionPayload, cycle: number) => unknown;

const mod = (await import(pathToFileURL(resolve(file)).href)) as { decide?: DecideFn };
if (typeof mod.decide !== 'function') {
  console.error('✗ o módulo não exporta `decide(unitId, perception, cycle)`');
  process.exit(1);
}
const decide = mod.decide;

const problems: string[] = [];
let decisions = 0;

const r = runPerceptionMatch({
  seed: 'conformance-1',
  cfg: { ...DEFAULT_CONFIG, totalCycles: 60 },
  bots: {
    cian: (unitId, p, cycle) => {
      decisions += 1;
      let raw: unknown;
      try {
        raw = decide(unitId, p, cycle);
      } catch (err) {
        problems.push(`ciclo ${cycle} ${unitId}: decide() lançou: ${String(err)}`);
        return {};
      }
      const parsed = DecisionPayloadSchema.safeParse(raw ?? {});
      if (!parsed.success) {
        if (problems.length < 10) {
          problems.push(
            `ciclo ${cycle} ${unitId}: decisão inválida — ${parsed.error.issues[0]?.message} em ${parsed.error.issues[0]?.path.join('.')}`,
          );
        }
        return {};
      }
      return parsed.data as DecisionPayload;
    },
    magenta: wandererBot(),
  },
});

resimulate(r.replay); // sanidade: o que o agente jogou é reproduzível

console.log(`partida de conformidade: 60 ciclos, ${decisions} decisões avaliadas`);
console.log(`placar ${r.finalState.score.cian}×${r.finalState.score.magenta} · vencedor ${decideWinner(r.finalState)}`);
if (problems.length > 0) {
  console.error(`✗ ${problems.length} problema(s):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('✓ agente conforme: todas as decisões passam no schema do protocolo');
