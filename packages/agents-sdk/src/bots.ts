/**
 * Bots de referência da Sprint 2 (docs/sprints/sprint-02-sensores-e-agentes.md).
 * São funções puras sobre a percepção — utilizáveis tanto headless
 * (runPerceptionMatch do sim) quanto sobre WebSocket (classe Agent).
 */
import type { DecisionPayload, PerceptionPayload, Team } from '@echo-front/protocol';
import { ARENA_ALPHA } from '@echo-front/sim';
import { siegeRoutine } from './siege.js';

export type PerceptionBotFn = (
  unitId: string,
  perception: PerceptionPayload,
  cycle: number,
) => DecisionPayload;

function deg(from: [number, number], to: [number, number]): number {
  const d = Math.round((Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI);
  return ((d % 360) + 360) % 360;
}

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

const FRAG_SPAWNS = ARENA_ALPHA.fragmentSpawns.map((p): [number, number] => [p.x, p.y]);

/** Hash determinístico pequeno para variar padrões por unidade. */
function unitSalt(unitId: string): number {
  let h = 7;
  for (let i = 0; i < unitId.length; i++) h = (h * 31 + unitId.charCodeAt(i)) % 997;
  return h;
}

function strongestSound(p: PerceptionPayload): { intensity: number; direction: number } | undefined {
  return [...p.sensors.sound].sort((a, b) => b.intensity - a.intensity)[0];
}

/**
 * `wanderer`: patrulha em rota determinística; ao perceber algo forte
 * (visual, som alto ou origem de pulso), foge na direção oposta e avisa o time.
 */
export function wandererBot(): PerceptionBotFn {
  return (unitId, p, cycle) => {
    const salt = unitSalt(unitId);
    const threat =
      p.sensors.visual[0]?.direction ??
      p.sensors.radar.find((r) => r.type === 'pulse_origin')?.direction ??
      (strongestSound(p) && strongestSound(p)!.intensity > 0.3
        ? strongestSound(p)!.direction
        : undefined);

    if (threat !== undefined) {
      return {
        movement: { direction: (threat + 180) % 360, speed: 1 },
        message_to_team: `threat_at_${threat}`,
        debug: { mode: 'flee', threat_direction: threat },
      };
    }
    // Patrulha: gira o rumo lentamente, com fase própria por unidade.
    return {
      movement: { direction: (salt + cycle * 23) % 360, speed: 0.5 },
      debug: { mode: 'patrol' },
    };
  };
}

/**
 * `hunter`: persegue leituras (visual > radar > som) e ataca de perto; sem
 * contato, joga o objetivo (entrega o que carrega, busca fragmento conhecido)
 * antes de recorrer ao `pulse_scan` para revelar a área — pagando o preço.
 *
 * Sprint 10: quitação do débito "hunter não joga objetivo em data_run" —
 * mantém a identidade ofensiva (ataca no contato) mas para de vagar sem rumo
 * quando não há ameaça à vista.
 */
export function hunterBot(team: Team = 'cian'): PerceptionBotFn {
  const core: [number, number] = [ARENA_ALPHA.cores[team].x, ARENA_ALPHA.cores[team].y];
  const siege = siegeRoutine(team);
  // Detecta "emperramento" contra obstáculo: um som impreciso (jitter ±25°)
  // pode mirar repetidamente numa direção bloqueada e travar a unidade —
  // depois de 2 ciclos sem deslocamento, troca a perseguição por varredura.
  const stuckMemory = new Map<string, { pos: [number, number]; stuck: number }>();

  return (unitId, p, cycle) => {
    if (p.objective.mode === 'core_siege') return siege(unitId, p, cycle);
    const salt = unitSalt(unitId);
    const pos = p.self.position;
    const last = stuckMemory.get(unitId);
    const stuckCount =
      last && Math.abs(last.pos[0] - pos[0]) < 0.05 && Math.abs(last.pos[1] - pos[1]) < 0.05
        ? last.stuck + 1
        : 0;
    stuckMemory.set(unitId, { pos, stuck: stuckCount });

    // Só persegue leituras de INIMIGO (unit/movement) — fragmento/decoy/núcleo
    // à vista não deve sequestrar a rotina de caça (senão o hunter fica
    // "perseguindo" um fragmento parado para sempre, sem nunca pará-lo capturar).
    const visual = p.sensors.visual.find((v) => v.type === 'unit' || v.type === 'movement');
    if (visual) {
      // Contato colado e energia sobrando: ataca — é a identidade do hunter.
      if (
        visual.distance <= 2.5 &&
        p.self.energy > 35
      ) {
        const rad = (visual.direction * Math.PI) / 180;
        const target: [number, number] = [
          pos[0] + visual.distance * Math.cos(rad),
          pos[1] + visual.distance * Math.sin(rad),
        ];
        return {
          action: 'strike',
          target,
          debug: {
            mode: 'strike',
            at: visual.direction,
            hypotheses: [{ position: target, confidence: visual.confidence, label: 'strike_target' }],
          },
        };
      }
      const rad = (visual.direction * Math.PI) / 180;
      return {
        movement: { direction: visual.direction, speed: 1 },
        message_to_team: `chasing_${Math.round(visual.direction)}`,
        debug: {
          mode: 'chase_visual',
          confidence: visual.confidence,
          // Convenção sprint-07: onde a IA ACREDITA que o alvo está.
          hypotheses: [
            {
              position: [
                p.self.position[0] + visual.distance * Math.cos(rad),
                p.self.position[1] + visual.distance * Math.sin(rad),
              ],
              confidence: visual.confidence,
              label: 'enemy',
            },
          ],
        },
      };
    }
    const echo = p.sensors.radar.find((r) => r.type === 'unit');
    if (echo) {
      return {
        movement: { direction: echo.direction, speed: 1 },
        debug: { mode: 'chase_radar', band: echo.distance_band },
      };
    }
    // Sem contato firme (visual/radar): joga o objetivo em vez de perseguir
    // um som fraco para sempre — um inimigo parado emite ruído ambiente
    // constante e um som impreciso não deve sequestrar o turno indefinidamente.
    if (p.self.carrying_fragment) {
      return {
        movement: { direction: deg(pos, core), speed: 1 },
        debug: { mode: 'deliver_aggressive', core },
      };
    }
    const frag = [...p.objective.known_fragments].sort(
      (a, b) => dist(pos, a.position) - dist(pos, b.position),
    )[0];
    if (frag) {
      const dFrag = dist(pos, frag.position);
      if (dFrag > 1.2) {
        return {
          movement: { direction: deg(pos, frag.position), speed: 1 },
          message_to_team: `frag_${Math.round(frag.position[0])}_${Math.round(frag.position[1])}`,
          debug: { mode: 'approach_frag', confidence: frag.confidence },
        };
      }
      return { movement: { speed: 0 }, debug: { mode: 'capturing' } };
    }

    // Sem fragmento conhecido: pulsa quando possível para MAPEAR em vez de
    // deixar um som ambíguo (às vezes o próprio aliado se movendo) prender o
    // turno indefinidamente — é assim que o hunter garante progresso.
    const canPulse =
      (p.self.cooldowns['pulse_scan'] ?? 0) === 0 &&
      p.self.energy > 60 &&
      (p.objective.pulses_left === undefined || p.objective.pulses_left > 0);
    if (canPulse) {
      return { movement: { speed: 0.4 }, action: 'pulse_scan', debug: { mode: 'find_pulse' } };
    }

    const sound = strongestSound(p);
    if (sound && sound.intensity > 0.1 && stuckCount < 2) {
      // Estimativa grosseira de distância a partir da intensidade (o som não
      // dá distância — é uma CRENÇA, e o espectador vê o quão errada está).
      const guess = Math.max(4, 26 * (1 - sound.intensity));
      const rad = (sound.direction * Math.PI) / 180;
      return {
        movement: { direction: sound.direction, speed: 0.8 },
        debug: {
          mode: 'chase_sound',
          intensity: sound.intensity,
          hypotheses: [
            {
              position: [
                p.self.position[0] + guess * Math.cos(rad),
                p.self.position[1] + guess * Math.sin(rad),
              ],
              confidence: Math.min(0.7, sound.intensity + 0.2),
              label: 'sound_source',
            },
          ],
        },
      };
    }

    // Cooldown do pulso ativo e nenhum sinal: patrulha os spawns de fragmento
    // conhecidos do mapa (como courier/trickster) — cobre terreno útil em vez
    // de girar no lugar até o próximo pulso ficar disponível.
    const spawnTarget = FRAG_SPAWNS[(Math.floor(cycle / 10) + salt) % FRAG_SPAWNS.length]!;
    return {
      movement: { direction: deg(pos, spawnTarget), speed: 0.6 },
      debug: { mode: 'sweep', target: spawnTarget },
    };
  };
}
