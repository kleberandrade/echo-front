/**
 * Rotina de cerco compartilhada (sprint-09): usada por courier/trickster/ghost
 * quando `objective.mode === 'core_siege'`.
 *
 * O mapa é público, então os PARES candidatos de núcleo (map.coreSites) são
 * conhecidos — mas não qual foi sorteado. A rotina varre os sítios candidatos
 * do inimigo, confirma pela visão (leitura `core`, só a curta distância) e
 * converge para destruir.
 */
import type { DecisionPayload, Team } from '@echo-front/protocol';
import { ARENA_ALPHA } from '@echo-front/sim';
import type { PerceptionBotFn } from './bots.js';

function deg(from: [number, number], to: [number, number]): number {
  const d = Math.round((Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI);
  return ((d % 360) + 360) % 360;
}

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function siegeRoutine(team: Team): PerceptionBotFn {
  const enemy = team === 'cian' ? 'magenta' : 'cian';
  const sites = ARENA_ALPHA.coreSites.map((s): [number, number] => [s[enemy].x, s[enemy].y]);
  /** Memória por unidade: núcleo confirmado (via visão ou mensagem do time). */
  const confirmed = new Map<string, [number, number]>();
  const ruledOut = new Map<string, Set<number>>();

  return (unitId, p, cycle) => {
    const pos = p.self.position;

    // Mensagem de aliado confirmando o núcleo?
    for (const m of p.team_messages) {
      const match = /^core_(-?\d+)_(-?\d+)$/.exec(m.data);
      if (match) confirmed.set(unitId, [Number(match[1]), Number(match[2])]);
    }

    // Visão do núcleo: confirma e avisa o time.
    const coreSeen = p.sensors.visual.find((v) => v.type === 'core');
    if (coreSeen) {
      const rad = (coreSeen.direction * Math.PI) / 180;
      const est: [number, number] = [
        Math.round(pos[0] + coreSeen.distance * Math.cos(rad)),
        Math.round(pos[1] + coreSeen.distance * Math.sin(rad)),
      ];
      // Cola no sítio candidato mais próximo da estimativa (posição exata).
      const site = [...sites].sort((a, b) => dist(est, a) - dist(est, b))[0]!;
      confirmed.set(unitId, site);

      if (coreSeen.distance <= 2.5) {
        return {
          action: 'strike',
          target: site,
          message_to_team: `core_${site[0]}_${site[1]}`,
          debug: { mode: 'siege_strike', hypotheses: [{ position: site, confidence: 0.95, label: 'core' }] },
        };
      }
      return {
        movement: { direction: deg(pos, site), speed: 0.9 },
        message_to_team: `core_${site[0]}_${site[1]}`,
        debug: { mode: 'siege_approach', confidence: coreSeen.confidence },
      };
    }

    // Núcleo confirmado (por mim ou pelo time): converge e bate.
    const known = confirmed.get(unitId);
    if (known) {
      if (dist(pos, known) <= 2.5) {
        return { action: 'strike', target: known, debug: { mode: 'siege_strike' } };
      }
      const d: DecisionPayload = {
        movement: { direction: deg(pos, known), speed: 0.9 },
        debug: { mode: 'siege_converge', target: known },
      };
      if (p.self.class === 'runner' && p.self.energy > 45) d.action = 'speed_boost';
      return d;
    }

    // Reconhecimento: visita os sítios candidatos (nearest-first, sem repetir).
    const seen = ruledOut.get(unitId) ?? new Set<number>();
    ruledOut.set(unitId, seen);
    const pending = sites
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => !seen.has(i))
      .sort((a, b) => dist(pos, a.s) - dist(pos, b.s));
    const target = pending[0] ?? { s: sites[cycle % sites.length]!, i: -1 };
    if (dist(pos, target.s) < 6) {
      // Perto o bastante para a visão de núcleo (≤10) já ter acusado: descarta.
      if (target.i >= 0) seen.add(target.i);
    }
    return {
      movement: { direction: deg(pos, target.s), speed: 0.8 },
      debug: { mode: 'siege_scout', site: target.s },
    };
  };
}
