/**
 * Bots de objetivo da Sprint 3 (docs/sprints/sprint-03-data-run.md).
 * O mapa é conhecimento público — os bots usam ARENA_ALPHA para navegar.
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

/**
 * `courier`: joga o objetivo. Busca fragmentos conhecidos, espera a captura,
 * entrega no núcleo; sob ameaça de pulso enquanto carrega, usa `hide`.
 */
export function courierBot(team: Team): PerceptionBotFn {
  const core: [number, number] = [ARENA_ALPHA.cores[team].x, ARENA_ALPHA.cores[team].y];
  const spawns = ARENA_ALPHA.fragmentSpawns.map((p): [number, number] => [p.x, p.y]);

  return (unitId, p, cycle) => {
    const pos = p.self.position;

    // Contato próximo sem carga → abre distância (evita o strike do caçador).
    const threat = p.sensors.visual.find(
      (v) => (v.type === 'unit' || v.type === 'movement') && v.distance <= 3.2,
    );
    if (threat && !p.self.carrying_fragment) {
      const d: DecisionPayload = {
        // Esquiva lateral: sai da linha do strike sem abrir mão do campo.
        movement: { direction: (threat.direction + 100) % 360, speed: 1 },
        message_to_team: `contact_${Math.round(threat.direction)}`,
        debug: { mode: 'evade', threat: threat.direction },
      };
      if (p.self.class === 'runner' && p.self.energy > 30) d.action = 'speed_boost';
      return d;
    }

    if (p.self.carrying_fragment) {
      // Ameaça direta enquanto carrega → some do radar por 3 ciclos.
      const pulseNear = p.sensors.radar.some(
        (r) => r.type === 'pulse_origin' && r.distance_band === 'near',
      );
      if (pulseNear && p.self.energy > 30) {
        return { action: 'hide', debug: { mode: 'hide_carry' } };
      }
      const d: DecisionPayload = {
        movement: { direction: deg(pos, core), speed: 0.9 },
        debug: { mode: 'deliver', core },
      };
      if (p.self.class === 'runner' && p.self.energy > 40) d.action = 'speed_boost';
      return d;
    }

    const frag = [...p.objective.known_fragments].sort(
      (a, b) => dist(pos, a.position) - dist(pos, b.position),
    )[0];
    if (frag) {
      const dFrag = dist(pos, frag.position);
      if (dFrag > 1.2) {
        const d: DecisionPayload = {
          movement: { direction: deg(pos, frag.position), speed: 1 },
          message_to_team: `frag_${Math.round(frag.position[0])}_${Math.round(frag.position[1])}`,
          debug: { mode: 'approach_frag', confidence: frag.confidence },
        };
        if (p.self.class === 'runner' && p.self.energy > 50 && dFrag > 6) d.action = 'speed_boost';
        return d;
      }
      return { movement: { speed: 0 }, debug: { mode: 'capturing' } }; // parado, capturando
    }

    // Observer sem pista: pulsa para achar fragmentos (paga a exposição).
    if (
      p.self.class === 'observer' &&
      (p.self.cooldowns['pulse_scan'] ?? 0) === 0 &&
      p.self.energy > 60
    ) {
      return { movement: { speed: 0.4 }, action: 'pulse_scan', debug: { mode: 'find_pulse' } };
    }

    // Patrulha entre pontos de spawn conhecidos do mapa.
    const target = spawns[(Math.floor(cycle / 12) + (unitId.length % spawns.length)) % spawns.length]!;
    return {
      movement: { direction: deg(pos, target), speed: 0.7 },
      debug: { mode: 'patrol_spawns', target },
    };
  };
}

/**
 * `trickster`: disputa o objetivo COM guerra de informação — planta decoys
 * para desviar a atenção do adversário, aplica strike oportunista em quem
 * chega perto e entrega fragmentos como um courier furtivo.
 */
export function tricksterBot(team: Team): PerceptionBotFn {
  const core: [number, number] = [ARENA_ALPHA.cores[team].x, ARENA_ALPHA.cores[team].y];
  const enemyCore: [number, number] =
    team === 'cian'
      ? [ARENA_ALPHA.cores.magenta.x, ARENA_ALPHA.cores.magenta.y]
      : [ARENA_ALPHA.cores.cian.x, ARENA_ALPHA.cores.cian.y];
  const spawns = ARENA_ALPHA.fragmentSpawns.map((p): [number, number] => [p.x, p.y]);

  return (unitId, p, cycle) => {
    const pos = p.self.position;
    const isRunner = p.self.class === 'runner';

    // Strike oportunista: inimigo colado e energia sobrando.
    const close = p.sensors.visual.find(
      (v) => (v.type === 'unit' || v.type === 'movement') && v.distance <= 2.5,
    );
    if (close && p.self.energy > 40 && !p.self.carrying_fragment) {
      return { action: 'strike', debug: { mode: 'strike', at: close.direction } };
    }

    if (p.self.carrying_fragment) {
      const pulseNear = p.sensors.radar.some(
        (r) => r.type === 'pulse_origin' && r.distance_band !== 'far',
      );
      if (pulseNear && p.self.energy > 30) {
        return { action: 'hide', debug: { mode: 'hide_carry' } };
      }
      return {
        movement: { direction: deg(pos, core), speed: 0.85 },
        debug: { mode: 'deliver_quiet' },
      };
    }

    // Decoy de desvio: runner planta um eco na direção do núcleo inimigo,
    // longe do fragmento que pretende pegar — "exército falso".
    if (
      isRunner &&
      cycle >= 2 &&
      cycle % 20 < 2 &&
      (p.self.cooldowns['deploy_decoy'] ?? 0) === 0 &&
      p.self.energy > 55
    ) {
      const toward = deg(pos, enemyCore);
      const target: [number, number] = [
        pos[0] + 3.5 * Math.cos((toward * Math.PI) / 180),
        pos[1] + 3.5 * Math.sin((toward * Math.PI) / 180),
      ];
      return {
        action: 'deploy_decoy',
        target,
        message_to_team: 'decoy_planted',
        debug: { mode: 'plant_decoy', target },
      };
    }

    // Fragmento conhecido → aproxima e captura.
    const frag = [...p.objective.known_fragments].sort(
      (a, b) => dist(pos, a.position) - dist(pos, b.position),
    )[0];
    if (frag) {
      const dFrag = dist(pos, frag.position);
      if (dFrag > 1.2) {
        return {
          movement: { direction: deg(pos, frag.position), speed: 0.8 },
          debug: { mode: 'approach_frag_quiet' },
        };
      }
      return { movement: { speed: 0 }, debug: { mode: 'capturing' } };
    }

    // Observer mapeia com pulso quando cheio de energia (pagando o preço).
    if (!isRunner && (p.self.cooldowns['pulse_scan'] ?? 0) === 0 && p.self.energy > 90) {
      return { movement: { speed: 0.3 }, action: 'pulse_scan', debug: { mode: 'sweep_pulse' } };
    }

    // Patrulha os spawns em ordem inversa à do courier (menos encontrões).
    const target =
      spawns[(spawns.length - 1 - ((Math.floor(cycle / 12) + unitId.length) % spawns.length))]!;
    return {
      movement: { direction: deg(pos, target), speed: 0.65 },
      debug: { mode: 'patrol_reverse', target },
    };
  };
}
