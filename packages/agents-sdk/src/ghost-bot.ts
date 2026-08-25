/**
 * `ghost` (Sprint 5): joga com a composição phantom+runner. O phantom vive
 * de camuflagem e sinais falsos; o runner entrega em silêncio. O térmico é
 * a fraqueza deles — e o sensor que este bot mais respeita nos outros.
 */
import type { DecisionPayload, Team } from '@echo-front/protocol';
import { ARENA_ALPHA, DEFAULT_CONFIG, type MatchConfig } from '@echo-front/sim';
import type { PerceptionBotFn } from './bots.js';

export const GHOST_COMPOSITION = (team: Team): MatchConfig['composition'][Team] =>
  team ? ['phantom', 'runner'] : ['phantom', 'runner'];

/** Config de partida com o time `team` usando phantom+runner. */
export function ghostConfig(team: Team, base: MatchConfig = DEFAULT_CONFIG): MatchConfig {
  return {
    ...base,
    composition: { ...base.composition, [team]: ['phantom', 'runner'] },
  };
}

function deg(from: [number, number], to: [number, number]): number {
  const d = Math.round((Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI);
  return ((d % 360) + 360) % 360;
}

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function ghostBot(team: Team): PerceptionBotFn {
  const core: [number, number] = [ARENA_ALPHA.cores[team].x, ARENA_ALPHA.cores[team].y];
  const enemyCore: [number, number] =
    team === 'cian'
      ? [ARENA_ALPHA.cores.magenta.x, ARENA_ALPHA.cores.magenta.y]
      : [ARENA_ALPHA.cores.cian.x, ARENA_ALPHA.cores.cian.y];
  const spawns = ARENA_ALPHA.fragmentSpawns.map((p): [number, number] => [p.x, p.y]);

  return (unitId, p, cycle) => {
    const pos = p.self.position;
    const isPhantom = p.self.class === 'phantom';

    if (p.self.carrying_fragment) {
      const pulseNear = p.sensors.radar.some(
        (r) => r.type === 'pulse_origin' && r.distance_band === 'near',
      );
      if (pulseNear && p.self.energy > 30) return { action: 'hide', debug: { mode: 'hide_carry' } };
      return {
        movement: { direction: deg(pos, core), speed: 0.8 },
        debug: { mode: 'deliver_silent' },
      };
    }

    if (isPhantom) {
      // Ameaça visual próxima → some (camuflagem) em vez de fugir.
      const close = p.sensors.visual.find(
        (v) => (v.type === 'unit' || v.type === 'movement') && v.distance <= 5,
      );
      if (close && p.self.energy > 25 && (p.self.cooldowns['hide'] ?? 0) === 0) {
        return { action: 'hide', debug: { mode: 'vanish', threat: close.direction } };
      }
      // Sinais falsos periódicos na direção do núcleo inimigo.
      if (
        cycle % 16 < 2 &&
        cycle >= 2 &&
        (p.self.cooldowns['deploy_decoy'] ?? 0) === 0 &&
        p.self.energy > 45
      ) {
        const toward = deg(pos, enemyCore);
        return {
          action: 'deploy_decoy',
          target: [
            pos[0] + 3.5 * Math.cos((toward * Math.PI) / 180),
            pos[1] + 3.5 * Math.sin((toward * Math.PI) / 180),
          ],
          message_to_team: 'ghost_decoy',
          debug: { mode: 'false_signal' },
        };
      }
    }

    const frag = [...p.objective.known_fragments].sort(
      (a, b) => dist(pos, a.position) - dist(pos, b.position),
    )[0];
    if (frag) {
      const dFrag = dist(pos, frag.position);
      if (dFrag > 1.2) {
        const d: DecisionPayload = {
          movement: { direction: deg(pos, frag.position), speed: isPhantom ? 0.6 : 0.9 },
          debug: { mode: 'approach_frag', confidence: frag.confidence },
        };
        if (p.self.class === 'runner' && p.self.energy > 50 && dFrag > 6) d.action = 'speed_boost';
        return d;
      }
      return { movement: { speed: 0 }, debug: { mode: 'capturing' } };
    }

    // Patrulha devagar (phantom quase inaudível a 0,5).
    const target =
      spawns[(Math.floor(cycle / 14) + (unitId.length % spawns.length)) % spawns.length]!;
    return {
      movement: { direction: deg(pos, target), speed: isPhantom ? 0.5 : 0.7 },
      debug: { mode: 'silent_patrol', target },
    };
  };
}
