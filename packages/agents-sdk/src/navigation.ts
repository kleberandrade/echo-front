import { ARENA_ALPHA, isBlockedCell } from '@echo-front/sim';

type Point = [number, number];
export const distance = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

function clear(a: Point, b: Point): boolean {
  const steps = Math.max(1, Math.ceil(distance(a, b) * 4));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (
      isBlockedCell(
        ARENA_ALPHA,
        Math.floor(a[0] + t * (b[0] - a[0])),
        Math.floor(a[1] + t * (b[1] - a[1])),
      )
    )
      return false;
  }
  return true;
}

// Visibility graph uses public map geometry only, never hidden match state.
const corners: Point[] = ARENA_ALPHA.obstacles.flatMap(
  ({ x, y, w, h }) =>
    [
      [x - 0.5, y - 0.5],
      [x + w + 0.5, y - 0.5],
      [x - 0.5, y + h + 0.5],
      [x + w + 0.5, y + h + 0.5],
    ] as Point[],
);
const edges = corners.map((a) => corners.map((b) => (clear(a, b) ? distance(a, b) : Infinity)));

function costsTo(goal: Point): number[] {
  const costs = corners.map((p) => (clear(p, goal) ? distance(p, goal) : Infinity));
  const pending = new Set(corners.map((_, i) => i));
  while (pending.size) {
    const next = [...pending].sort((a, b) => costs[a]! - costs[b]!)[0]!;
    pending.delete(next);
    for (const i of pending) costs[i] = Math.min(costs[i]!, edges[i]![next]! + costs[next]!);
  }
  return costs;
}

export function createNavigator(): (
  from: Point,
  to: Point,
) => { waypoint: Point; distance: number } {
  const cache = new Map<string, number[]>();
  return (from, to) => {
    if (clear(from, to)) return { waypoint: to, distance: distance(from, to) };
    const key = to.join(',');
    const costs = cache.get(key) ?? costsTo(to);
    cache.set(key, costs);
    let best = { waypoint: to, distance: Infinity };
    for (const [i, point] of corners.entries()) {
      const length = distance(from, point) + costs[i]!;
      if (length < best.distance && clear(from, point))
        best = { waypoint: point, distance: length };
    }
    return best;
  };
}
