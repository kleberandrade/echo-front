/**
 * Sensores e montagem do pacote de percepção (docs/05-simulacao.md).
 *
 * `buildPerceptions` é uma função DERIVADA: lê o estado, não o modifica.
 * O ruído vem de streams do PRNG derivados de (seed, ciclo, ouvinte, fonte),
 * então é reproduzível sem consumir o rngState do estado.
 *
 * Regras de engano (Sprint 3):
 * - decoys inimigos aparecem em som e radar como se fossem unidades;
 * - a visão é o contra-decoy: revela `type: 'decoy'`;
 * - unidades com `hide` ativo somem de visão, som e radar.
 */
import type {
  MemoryReadingSchema,
  PerceptionPayload,
  RadarReadingSchema,
  SoundReadingSchema,
  VisualReadingSchema,
} from '@echo-front/protocol';
import type { z } from 'zod';
import { fromFixed, toFixed, type Fixed } from './fixed.js';
import type { MapDef } from './map.js';
import { deriveStream, nextInt } from './rng.js';
import { inInterference } from './step.js';
import {
  angleDiff,
  currentlyVisibleTargets,
  directionDeg,
  distanceUnits,
  hasLineOfSight,
  obstaclesCrossed,
} from './geometry.js';
import type { MatchConfig, MatchState, Unit } from './types.js';

export { directionDeg, distanceUnits, hasLineOfSight, obstaclesCrossed } from './geometry.js';

type VisualReading = z.infer<typeof VisualReadingSchema>;
type SoundReading = z.infer<typeof SoundReadingSchema>;
type RadarReading = z.infer<typeof RadarReadingSchema>;
type MemoryReading = z.infer<typeof MemoryReadingSchema>;

// ---------------------------------------------------------------------------
// Visão
// ---------------------------------------------------------------------------

function visualFor(unit: Unit, state: MatchState, map: MapDef, cfg: MatchConfig): VisualReading[] {
  const stats = cfg.classes[unit.class];
  const out: VisualReading[] = [];

  const see = (tx: Fixed, ty: Fixed): { dir: number; dist: number } | null => {
    const dist = distanceUnits(unit.x, unit.y, tx, ty);
    if (dist > stats.visionRange) return null;
    const dir = directionDeg(unit.x, unit.y, tx, ty);
    if (angleDiff(dir, unit.heading) > stats.visionFov / 2) return null;
    if (!hasLineOfSight(map, unit.x, unit.y, tx, ty)) return null;
    return { dir, dist };
  };

  for (const other of state.units) {
    if (other.id === unit.id || other.team === unit.team || !other.alive) continue;
    if (other.hiddenCycles > 0) continue;
    const hit = see(other.x, other.y);
    if (!hit) continue;
    const raw = 1 - hit.dist / stats.visionRange;
    const confidence = Math.max(0.2, Math.min(0.95, Math.round(raw * 20) / 20));
    if (confidence >= 0.5) {
      out.push({
        type: 'unit',
        class_guess: other.class,
        direction: hit.dir,
        distance: Math.round(hit.dist * 10) / 10,
        confidence,
      });
    } else {
      out.push({
        type: 'movement',
        direction: hit.dir,
        distance: Math.round(hit.dist * 10) / 10,
        confidence,
      });
    }
  }

  // Decoys inimigos: a visão os desmascara (type: 'decoy').
  for (const decoy of state.decoys) {
    if (decoy.team === unit.team) continue;
    const hit = see(decoy.x, decoy.y);
    if (!hit) continue;
    out.push({
      type: 'decoy',
      direction: hit.dir,
      distance: Math.round(hit.dist * 10) / 10,
      confidence: 0.9,
    });
  }

  // core_siege: o núcleo inimigo só aparece a curta distância (o "localizar").
  if (state.mode === 'core_siege') {
    const enemyTeam = unit.team === 'cian' ? 'magenta' : 'cian';
    const core = state.corePositions[enemyTeam];
    if (state.coreIntegrity[enemyTeam] > 0) {
      const hit = see(core.x, core.y);
      if (hit && hit.dist <= cfg.coreSiege.coreVisionRange) {
        out.push({
          type: 'core',
          direction: hit.dir,
          distance: Math.round(hit.dist * 10) / 10,
          confidence: 0.95,
        });
      }
    }
  }

  // Fragmentos no chão são visíveis.
  for (const frag of state.fragments) {
    if (frag.state !== 'spawned' && frag.state !== 'dropped') continue;
    const hit = see(frag.x, frag.y);
    if (!hit) continue;
    out.push({
      type: 'fragment',
      direction: hit.dir,
      distance: Math.round(hit.dist * 10) / 10,
      confidence: 0.95,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Som
// ---------------------------------------------------------------------------

function soundFor(unit: Unit, state: MatchState, map: MapDef, cfg: MatchConfig): SoundReading[] {
  const sc = cfg.sensors;
  const out: SoundReading[] = [];

  const hear = (sx: Fixed, sy: Fixed, base: number, sourceKey: string): void => {
    if (base <= 0) return;
    const dist = distanceUnits(unit.x, unit.y, sx, sy);
    if (dist > sc.soundRange) return;
    const crossed = obstaclesCrossed(map, unit.x, unit.y, sx, sy);
    const attenuated =
      base * (1 - dist / sc.soundRange) * Math.pow(sc.soundObstacleFactor, crossed);
    const intensity = Math.round(attenuated * 100) / 100;
    if (intensity < sc.soundMinIntensity) return;
    const stream = deriveStream(state.seed, 'sound', state.cycle, unit.id, sourceKey);
    const jitter = nextInt(stream, 2 * sc.soundJitterDeg + 1).value - sc.soundJitterDeg;
    const trueDir = directionDeg(unit.x, unit.y, sx, sy);
    out.push({ intensity, direction: (((trueDir + jitter) % 360) + 360) % 360 });
  };

  for (const other of state.units) {
    if (other.id === unit.id || !other.alive) continue;
    if (other.speed === 0 || other.hiddenCycles > 0) continue;
    let base = (cfg.classes[other.class].soundBase * other.speed) / 1000;
    if (other.carryingFragment) base = (base * cfg.fragments.carrySoundFactor) / 1000;
    if (other.boosting) base = Math.max(base, cfg.actions.boostNoise);
    hear(other.x, other.y, base, other.id);
  }

  // Decoys soam como unidades (indistinguíveis no sensor).
  for (const decoy of state.decoys) {
    if (decoy.team === unit.team) continue; // o próprio time sabe onde estão
    hear(decoy.x, decoy.y, cfg.actions.decoySound, decoy.id);
  }

  // Ruídos transientes (strike, boost).
  state.noises.forEach((n, i) => hear(n.x, n.y, n.intensity, `noise_${i}`));

  return out;
}

// ---------------------------------------------------------------------------
// Térmico (Sprint 5): detecta ocultos, mas confunde com torres e rastros.
// ---------------------------------------------------------------------------

type ThermalReading = { intensity: number; direction: number };

function thermalFor(
  unit: Unit,
  state: MatchState,
  map: MapDef,
  cfg: MatchConfig,
): ThermalReading[] {
  const sc = cfg.sensors;
  const out: ThermalReading[] = [];

  const sense = (sx: Fixed, sy: Fixed, base: number): void => {
    if (base <= 0) return;
    const dist = distanceUnits(unit.x, unit.y, sx, sy);
    if (dist > sc.thermalRange || dist < 0.5) return;
    const crossed = obstaclesCrossed(map, unit.x, unit.y, sx, sy);
    const attenuated =
      base * (1 - dist / sc.thermalRange) * Math.pow(sc.thermalObstacleFactor, crossed);
    const intensity = Math.round(attenuated * 100) / 100;
    if (intensity < sc.thermalMinIntensity) return;
    out.push({ intensity, direction: directionDeg(unit.x, unit.y, sx, sy) });
  };

  // Unidades: atividade gera calor — INCLUSIVE ocultas (contramedida do hide).
  for (const other of state.units) {
    if (other.id === unit.id || !other.alive) continue;
    const activity = 0.3 + (0.5 * other.speed) / 1000 + (other.boosting ? 0.2 : 0);
    sense(other.x, other.y, other.hiddenCycles > 0 ? 0.35 : activity);
  }
  // Rastros residuais de quem passou (3 ciclos).
  for (const t of state.heatTrails) {
    sense(t.x, t.y, 0.15 * (t.cyclesLeft / cfg.sensors.heatTrailCycles));
  }
  // Torres de energia: fontes fixas — falso positivo intencional.
  for (const tower of map.energyTowers) {
    sense(toFixed(tower.x), toFixed(tower.y), 0.5);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Memória (fog com envelhecimento — sprint-14)
// ---------------------------------------------------------------------------

/**
 * Última posição conhecida de inimigos fora de visão AGORA (quem está
 * visível já sai como `sensors.visual` — não duplica aqui). Direção/
 * distância são recalculadas da posição ATUAL de `unit` até a posição
 * LEMBRADA (defasada) — a unidade não sabe que o inimigo se moveu desde
 * então. Confiança decai com `cycles_since_seen`; expiração de vez fica a
 * cargo de `cfg.sensors.enemyMemoryCycles` em step.ts (aqui só filtra o que
 * ainda está na memória, já expirada ou não).
 */
function memoryFor(unit: Unit, state: MatchState, map: MapDef, cfg: MatchConfig): MemoryReading[] {
  const visibleNow = new Set(currentlyVisibleTargets(unit, state, map, cfg).map((v) => v.id));
  const out: MemoryReading[] = [];
  for (const m of unit.knownEnemies) {
    if (visibleNow.has(m.enemyId)) continue;
    const age = state.cycle - m.lastSeenCycle;
    if (age > cfg.sensors.enemyMemoryCycles) continue; // já devia ter sido podada em step.ts; defensivo
    const confidence = Math.max(0.1, Math.round((0.85 - age * 0.06) * 20) / 20);
    const type = m.classGuess === 'decoy' || m.classGuess === 'core' ? m.classGuess : 'unit';
    out.push({
      type,
      ...(type === 'unit' ? { class_guess: m.classGuess as Unit['class'] } : {}),
      direction: directionDeg(unit.x, unit.y, m.x, m.y),
      distance: Math.round(distanceUnits(unit.x, unit.y, m.x, m.y) * 10) / 10,
      cycles_since_seen: age,
      confidence,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Radar
// ---------------------------------------------------------------------------

function quantize2(f: Fixed): number {
  return Math.floor(fromFixed(f) / 2) * 2 + 1;
}

function distanceBand(dist: number): 'near' | 'mid' | 'far' {
  if (dist < 6) return 'near';
  if (dist < 12) return 'mid';
  return 'far';
}

function radarFor(unit: Unit, state: MatchState, cfg: MatchConfig): RadarReading[] {
  const sc = cfg.sensors;
  const out: RadarReading[] = [];
  for (const pulse of state.pulses) {
    if (pulse.team === unit.team) {
      const echo = (tx: Fixed, ty: Fixed, type: 'unit' | 'fragment' | 'core'): void => {
        if (distanceUnits(pulse.x, pulse.y, tx, ty) > sc.radarRadius) return;
        out.push({
          type,
          direction: directionDeg(unit.x, unit.y, tx, ty),
          position: [quantize2(tx), quantize2(ty)],
          distance_band: distanceBand(distanceUnits(unit.x, unit.y, tx, ty)),
        });
      };
      for (const other of state.units) {
        if (!other.alive || other.team === unit.team || other.hiddenCycles > 0) continue;
        echo(other.x, other.y, 'unit');
      }
      // Decoys inimigos ecoam como unidades — o radar não distingue.
      for (const decoy of state.decoys) {
        if (decoy.team === unit.team) continue;
        echo(decoy.x, decoy.y, 'unit');
      }
      for (const frag of state.fragments) {
        if (frag.state !== 'spawned' && frag.state !== 'dropped') continue;
        echo(frag.x, frag.y, 'fragment');
      }
      if (state.mode === 'core_siege') {
        const enemyTeam = unit.team === 'cian' ? 'magenta' : 'cian';
        if (state.coreIntegrity[enemyTeam] > 0) {
          echo(state.corePositions[enemyTeam].x, state.corePositions[enemyTeam].y, 'core');
        }
      }
    } else {
      const dist = distanceUnits(unit.x, unit.y, pulse.x, pulse.y);
      out.push({
        type: 'pulse_origin',
        direction: directionDeg(unit.x, unit.y, pulse.x, pulse.y),
        distance_band: distanceBand(dist),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Percepção completa
// ---------------------------------------------------------------------------

function signatureOf(unit: Unit, cfg: MatchConfig): 'none' | 'low' | 'medium' | 'high' {
  if (unit.hiddenCycles > 0) return 'none';
  if (unit.speed === 0) return 'low';
  let sound = (cfg.classes[unit.class].soundBase * unit.speed) / 1000;
  if (unit.carryingFragment) sound = (sound * cfg.fragments.carrySoundFactor) / 1000;
  if (sound < 0.2) return 'low';
  if (sound < 0.4) return 'medium';
  return 'high';
}

export function buildPerception(
  unit: Unit,
  state: MatchState,
  map: MapDef,
  cfg: MatchConfig,
): PerceptionPayload {
  const inZone = inInterference(map, unit.x, unit.y);
  const events = [...state.cycleEvents];
  if (inZone) events.push('communication_interference');

  // Sob interferência, a unidade fica com o ÚLTIMO quadro que conheceu
  // (posições defasadas, stale: true) em vez de dados atuais.
  const allies = inZone
    ? unit.lastAllies.map((a) => ({
        unitId: a.unitId,
        position: [fromFixed(a.x), fromFixed(a.y)] as [number, number],
        energy: a.energy,
        integrity: a.integrity,
        carrying_fragment: a.carryingFragment,
        stale: true,
      }))
    : state.units
        .filter((u) => u.team === unit.team && u.id !== unit.id && u.alive)
        .map((u) => ({
          unitId: u.id,
          position: [fromFixed(u.x), fromFixed(u.y)] as [number, number],
          energy: u.energy,
          integrity: u.integrity,
          carrying_fragment: u.carryingFragment,
        }));

  const team_messages = inZone
    ? []
    : state.messages
        .filter((m) => m.team === unit.team && m.from !== unit.id && m.cycle === state.cycle - 1)
        .map((m) => ({ from: m.from, cycle: m.cycle, data: m.data }));

  // Fragmentos conhecidos: os visíveis agora (visão) e os revelados por pulso do time.
  const known: PerceptionPayload['objective']['known_fragments'] = [];
  const stats = cfg.classes[unit.class];
  for (const frag of state.fragments) {
    if (frag.state !== 'spawned' && frag.state !== 'dropped') continue;
    const dist = distanceUnits(unit.x, unit.y, frag.x, frag.y);
    const dir = directionDeg(unit.x, unit.y, frag.x, frag.y);
    const seen =
      dist <= stats.visionRange &&
      angleDiff(dir, unit.heading) <= stats.visionFov / 2 &&
      hasLineOfSight(map, unit.x, unit.y, frag.x, frag.y);
    const pulsed = state.pulses.some(
      (p) =>
        p.team === unit.team && distanceUnits(p.x, p.y, frag.x, frag.y) <= cfg.sensors.radarRadius,
    );
    if (seen || pulsed) {
      known.push({
        position: [fromFixed(frag.x), fromFixed(frag.y)],
        state: frag.state,
        confidence: seen ? 1.0 : 0.7,
      });
    }
  }

  return {
    self: {
      position: [fromFixed(unit.x), fromFixed(unit.y)],
      heading: unit.heading,
      energy: unit.energy,
      integrity: unit.integrity,
      carrying_fragment: unit.carryingFragment,
      signature: signatureOf(unit, cfg),
      class: unit.class,
      cooldowns: { ...unit.cooldowns },
    },
    sensors: {
      visual: visualFor(unit, state, map, cfg),
      thermal: thermalFor(unit, state, map, cfg),
      sound: soundFor(unit, state, map, cfg),
      radar: radarFor(unit, state, cfg),
      memory: memoryFor(unit, state, map, cfg),
    },
    allies,
    team_messages,
    events,
    objective: {
      mode: state.mode,
      score: { ...state.score },
      time_remaining_cycles: Math.max(0, cfg.totalCycles - state.cycle),
      known_fragments: known,
      ...(cfg.sensors.maxPulsesPerMatch > 0
        ? { pulses_left: Math.max(0, cfg.sensors.maxPulsesPerMatch - unit.pulsesUsed) }
        : {}),
    },
  };
}

/** Percepções de todas as unidades vivas, por unitId. */
export function buildPerceptions(
  state: MatchState,
  map: MapDef,
  cfg: MatchConfig,
): Record<string, PerceptionPayload> {
  const out: Record<string, PerceptionPayload> = {};
  for (const unit of state.units) {
    if (unit.alive) out[unit.id] = buildPerception(unit, state, map, cfg);
  }
  return out;
}
