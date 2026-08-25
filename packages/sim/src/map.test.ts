import { describe, expect, it } from 'vitest';
import { ARENA_ALPHA, isBlockedCell, validateMap, type MapDef } from './map.js';

describe('arena_alpha', () => {
  it('passa no validador (simetria + conectividade)', () => {
    const v = validateMap(ARENA_ALPHA);
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('bordas contam como bloqueadas', () => {
    expect(isBlockedCell(ARENA_ALPHA, -1, 0)).toBe(true);
    expect(isBlockedCell(ARENA_ALPHA, 64, 0)).toBe(true);
    expect(isBlockedCell(ARENA_ALPHA, 0, 36)).toBe(true);
  });

  it('células de obstáculo são bloqueadas e as espelhadas também', () => {
    expect(isBlockedCell(ARENA_ALPHA, 14, 6)).toBe(true);
    expect(isBlockedCell(ARENA_ALPHA, 64 - 1 - 14, 36 - 1 - 6)).toBe(true);
  });
});

describe('validateMap detecta defeitos', () => {
  it('mapa assimétrico falha', () => {
    const broken: MapDef = {
      ...ARENA_ALPHA,
      obstacles: [...ARENA_ALPHA.obstacles, { x: 2, y: 2, w: 1, h: 1 }],
    };
    expect(validateMap(broken).ok).toBe(false);
  });

  it('núcleo emparedado falha na conectividade', () => {
    // Fecha um anel simétrico em volta do núcleo cian (6,18) e do espelho.
    const wall = [
      { x: 4, y: 16, w: 5, h: 1 },
      { x: 4, y: 20, w: 5, h: 1 },
      { x: 4, y: 17, w: 1, h: 3 },
      { x: 8, y: 17, w: 1, h: 3 },
    ];
    const mirrored = wall.map((r) => ({ x: 64 - r.x - r.w, y: 36 - r.y - r.h, w: r.w, h: r.h }));
    const broken: MapDef = { ...ARENA_ALPHA, obstacles: [...ARENA_ALPHA.obstacles, ...wall, ...mirrored] };
    const v = validateMap(broken);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('inalcançável'))).toBe(true);
  });
});
