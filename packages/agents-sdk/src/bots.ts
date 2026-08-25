/**
 * Bots de referência da Sprint 2 (docs/sprints/sprint-02-sensores-e-agentes.md).
 * São funções puras sobre a percepção — utilizáveis tanto headless
 * (runPerceptionMatch do sim) quanto sobre WebSocket (classe Agent).
 */
import type { DecisionPayload, PerceptionPayload } from '@echo-front/protocol';

export type PerceptionBotFn = (
  unitId: string,
  perception: PerceptionPayload,
  cycle: number,
) => DecisionPayload;

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
 * `hunter`: persegue leituras (visual > radar > som); sem contato e com
 * energia sobrando, dispara `pulse_scan` para revelar a área — pagando o preço.
 */
export function hunterBot(): PerceptionBotFn {
  return (unitId, p, cycle) => {
    const salt = unitSalt(unitId);
    const visual = p.sensors.visual[0];
    if (visual) {
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
    const sound = strongestSound(p);
    if (sound && sound.intensity > 0.1) {
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
    const canPulse = (p.self.cooldowns['pulse_scan'] ?? 0) === 0 && p.self.energy > 60;
    return {
      movement: { direction: (salt * 3 + cycle * 17) % 360, speed: 0.6 },
      ...(canPulse ? { action: 'pulse_scan' as const } : {}),
      debug: { mode: canPulse ? 'sweep_pulse' : 'sweep' },
    };
  };
}
