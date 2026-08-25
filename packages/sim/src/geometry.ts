/**
 * Geometria compartilhada entre pipeline e sensores.
 */
import { isBlockedCell, type MapDef } from './map.js';
import type { Fixed } from './fixed.js';

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
