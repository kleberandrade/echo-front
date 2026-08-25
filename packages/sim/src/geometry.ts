/**
 * Geometria compartilhada entre pipeline e sensores.
 */
import { isBlockedCell, type MapDef } from './map.js';
import type { Fixed } from './fixed.js';
import type { MatchConfig, MatchState, Unit } from './types.js';

/** Direção inteira [0,360) de a para b (0 = leste; y do grid cresce para o sul). */
export function directionDeg(ax: Fixed, ay: Fixed, bx: Fixed, by: Fixed): number {
  const d = Math.round((Math.atan2(by - ay, bx - ax) * 180) / Math.PI);
  return ((d % 360) + 360) % 360;
}

export function distanceUnits(ax: Fixed, ay: Fixed, bx: Fixed, by: Fixed): number {
  const dx = (ax - bx) / 1000;
  const dy = (ay - by) / 1000;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Menor diferença angular absoluta entre dois ângulos em graus. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/** Conta células de obstáculo cruzadas pelo segmento (amostragem a cada 0,5 u). */
export function obstaclesCrossed(map: MapDef, ax: Fixed, ay: Fixed, bx: Fixed, by: Fixed): number {
  const dist = distanceUnits(ax, ay, bx, by);
  const steps = Math.max(1, Math.ceil(dist * 2));
  const seen = new Set<string>();
  let count = 0;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.floor((ax + (bx - ax) * t) / 1000);
    const y = Math.floor((ay + (by - ay) * t) / 1000);
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (isBlockedCell(map, x, y)) count++;
  }
  return count;
}

/** Linha de visão livre (nenhuma célula de obstáculo entre os pontos). */
export function hasLineOfSight(map: MapDef, ax: Fixed, ay: Fixed, bx: Fixed, by: Fixed): boolean {
  return obstaclesCrossed(map, ax, ay, bx, by) === 0;
}

/** O ponto (tx,ty) está no cone de visão do observador? (sem checar oclusão) */
export function inVisionCone(
  viewer: { x: Fixed; y: Fixed; heading: number },
  tx: Fixed,
  ty: Fixed,
  fovDeg: number,
  rangeUnits: number,
): boolean {
  const dist = distanceUnits(viewer.x, viewer.y, tx, ty);
  if (dist > rangeUnits) return false;
  const dir = directionDeg(viewer.x, viewer.y, tx, ty);
  return angleDiff(dir, viewer.heading) <= fovDeg / 2;
}

/**
 * Alvos inimigos (unidades, decoys, núcleo) VISÍVEIS agora pela visão de
 * `unit` — identidade verdadeira, sem ruído (ao contrário do sensor visual
 * em sensors.ts, que devolve leituras com ruído/confiança e sem identidade).
 * Uso: `step.ts` usa pra atualizar a memória de fog com envelhecimento
 * (`Unit.knownEnemies`); `sensors.ts` usa pra excluir da memória exposta
 * (`sensors.memory`) quem já está visível agora via `sensors.visual`.
 * Compartilhada aqui (não em sensors.ts/step.ts) pra evitar import circular
 * entre os dois — ambos já dependem deste módulo.
 */
export function currentlyVisibleTargets(
  unit: Unit,
  state: MatchState,
  map: MapDef,
  cfg: MatchConfig,
): { id: string; x: Fixed; y: Fixed; classGuess: string }[] {
  const stats = cfg.classes[unit.class];
  const see = (tx: Fixed, ty: Fixed): boolean =>
    inVisionCone(unit, tx, ty, stats.visionFov, stats.visionRange) &&
    hasLineOfSight(map, unit.x, unit.y, tx, ty);

  const out: { id: string; x: Fixed; y: Fixed; classGuess: string }[] = [];
  for (const other of state.units) {
    if (other.id === unit.id || other.team === unit.team || !other.alive) continue;
    if (other.hiddenCycles > 0) continue;
    if (see(other.x, other.y))
      out.push({ id: other.id, x: other.x, y: other.y, classGuess: other.class });
  }
  for (const decoy of state.decoys) {
    if (decoy.team === unit.team) continue;
    if (see(decoy.x, decoy.y))
      out.push({ id: decoy.id, x: decoy.x, y: decoy.y, classGuess: 'decoy' });
  }
  if (state.mode === 'core_siege') {
    const enemyTeam = unit.team === 'cian' ? 'magenta' : 'cian';
    const core = state.corePositions[enemyTeam];
    if (
      state.coreIntegrity[enemyTeam] > 0 &&
      distanceUnits(unit.x, unit.y, core.x, core.y) <= cfg.coreSiege.coreVisionRange &&
      see(core.x, core.y)
    ) {
      out.push({ id: `core_${enemyTeam}`, x: core.x, y: core.y, classGuess: 'core' });
    }
  }
  return out;
}
