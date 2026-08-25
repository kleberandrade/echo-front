/**
 * Aritmética fixed-point (×1000) para posições e velocidades.
 * Elimina divergência de float entre Node e browser (docs/05-simulacao.md).
 */

export const SCALE = 1000;

export type Fixed = number; // inteiro = unidades lógicas × 1000

export function toFixed(units: number): Fixed {
  return Math.round(units * SCALE);
}

export function fromFixed(f: Fixed): number {
  return f / SCALE;
}

/**
 * Tabelas de seno/cosseno quantizadas (×32768) para graus inteiros.
 * A quantização agressiva torna o resultado idêntico entre engines JS.
 */
const SIN_TABLE: number[] = [];
for (let d = 0; d < 360; d++) {
  SIN_TABLE.push(Math.round(Math.sin((d * Math.PI) / 180) * 32768));
}

export function sinDeg(deg: number): number {
  return SIN_TABLE[((Math.round(deg) % 360) + 360) % 360]!;
}

export function cosDeg(deg: number): number {
  return SIN_TABLE[((Math.round(deg) + 90) % 360 + 360) % 360]!;
}

/** Desloca uma posição fixed por (direção em graus, distância fixed). */
export function moveFixed(x: Fixed, y: Fixed, deg: number, dist: Fixed): [Fixed, Fixed] {
  // dist × cos / 32768, arredondado — tudo inteiro.
  const dx = Math.round((dist * cosDeg(deg)) / 32768);
  const dy = Math.round((dist * sinDeg(deg)) / 32768);
  return [x + dx, y + dy];
}

/** Distância euclidiana ao quadrado em fixed² (evita sqrt). */
export function dist2(ax: Fixed, ay: Fixed, bx: Fixed, by: Fixed): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
