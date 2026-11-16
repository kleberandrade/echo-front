import { ARENA_ALPHA, isBlockedCell } from '@echo-front/sim';
import { describe, expect, it } from 'vitest';
import { createNavigator, distance } from './navigation.js';

describe('public-map navigation', () => {
  it('takes the direct route when visible', () => {
    expect(createNavigator()([5, 16], [6, 18])).toEqual({
      waypoint: [6, 18],
      distance: Math.sqrt(5),
    });
  });

  it('routes around walls and reaches every fragment from either core', () => {
    const navigate = createNavigator();
    for (const core of Object.values(ARENA_ALPHA.cores)) {
      for (const goal of ARENA_ALPHA.fragmentSpawns) {
        let position: [number, number] = [core.x, core.y];
        const target: [number, number] = [goal.x, goal.y];
        for (let step = 0; step < 200 && distance(position, target) > 0.1; step++) {
          const route = navigate(position, target);
          expect(Number.isFinite(route.distance)).toBe(true);
          const length = distance(position, route.waypoint);
          const fraction = Math.min(1, 0.5 / length);
          position = [
            position[0] + (route.waypoint[0] - position[0]) * fraction,
            position[1] + (route.waypoint[1] - position[1]) * fraction,
          ];
          expect(isBlockedCell(ARENA_ALPHA, Math.floor(position[0]), Math.floor(position[1]))).toBe(
            false,
          );
        }
        expect(distance(position, target)).toBeLessThan(0.1);
      }
    }
  });
});
