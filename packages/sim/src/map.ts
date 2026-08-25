/**
 * Formato de mapa + arena_alpha@1 (docs/02-game-design.md, sprint-01).
 * Mapas são simétricos por rotação de 180°: célula (x,y) ↔ (W-1-x, H-1-y).
 */
import { toFixed, type Fixed } from './fixed.js';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapDef {
  id: string;
  width: number; // células
  height: number;
  /** Retângulos de obstáculo (bloqueiam movimento e visão). */
  obstacles: Rect[];
  /** Torres de energia: recarga extra em raio curto. */
  energyTowers: { x: number; y: number; radius: number }[];
  /** Zonas de interferência (comunicação/radar degradados — usadas a partir da Sprint 2). */
  interferenceZones: { x: number; y: number; radius: number }[];
  /** Pontos possíveis de spawn de fragmento (Sprint 3). */
  fragmentSpawns: { x: number; y: number }[];
  cores: { cian: { x: number; y: number }; magenta: { x: number; y: number } };
  /** Pares espelhados candidatos a posição de núcleo (core_siege sorteia um). */
  coreSites: { cian: { x: number; y: number }; magenta: { x: number; y: number } }[];
  /** Spawns de unidade por time, em ordem de unitId. */
  unitSpawns: { cian: { x: number; y: number }[]; magenta: { x: number; y: number }[] };
}

/** Espelha um retângulo por rotação de 180°. */
function mirrorRect(r: Rect, w: number, h: number): Rect {
  return { x: w - r.x - r.w, y: h - r.y - r.h, w: r.w, h: r.h };
}

function mirrorPoint(p: { x: number; y: number }, w: number, h: number): { x: number; y: number } {
  return { x: w - 1 - p.x, y: h - 1 - p.y };
}

const W = 64;
const H = 36;

/** Metade "cian" dos obstáculos; a outra metade é gerada por espelhamento. */
const HALF_OBSTACLES: Rect[] = [
  { x: 14, y: 6, w: 2, h: 8 },
  { x: 20, y: 12, w: 2, h: 2 },
  { x: 24, y: 20, w: 3, h: 3 },
  { x: 30, y: 4, w: 4, h: 2 },
  { x: 10, y: 24, w: 4, h: 2 },
];

export const ARENA_ALPHA: MapDef = {
  id: 'arena_alpha@1',
  width: W,
  height: H,
  obstacles: [...HALF_OBSTACLES, ...HALF_OBSTACLES.map((r) => mirrorRect(r, W, H))],
  energyTowers: [
    { x: 16, y: 8, radius: 3 },
    { x: 47, y: 27, radius: 3 },
  ],
  interferenceZones: [{ x: 31.5, y: 17.5, radius: 6 }],
  fragmentSpawns: [
    { x: 31, y: 17 }, // ~centro (espelho de si mesmo com o par abaixo)
    { x: 32, y: 18 },
    { x: 12, y: 30 },
    { x: 51, y: 5 },
  ],
  cores: { cian: { x: 6, y: 18 }, magenta: { x: 57, y: 17 } },
  coreSites: [
    { cian: { x: 6, y: 18 }, magenta: { x: 57, y: 17 } },
    { cian: { x: 10, y: 6 }, magenta: { x: 53, y: 29 } },
    { cian: { x: 8, y: 30 }, magenta: { x: 55, y: 5 } },
  ],
  unitSpawns: {
    cian: [
      { x: 5, y: 16 },
      { x: 5, y: 20 },
      { x: 3, y: 14 },
      { x: 3, y: 22 },
    ],
    magenta: [
      { x: 58, y: 19 },
      { x: 58, y: 15 },
      { x: 60, y: 21 },
      { x: 60, y: 13 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export function isBlockedCell(map: MapDef, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) return true;
  for (const r of map.obstacles) {
    if (cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h) return true;
  }
  return false;
}

/** Posição fixed bloqueada? (célula da posição) */
export function isBlockedFixed(map: MapDef, fx: Fixed, fy: Fixed): boolean {
  return isBlockedCell(map, Math.floor(fx / 1000), Math.floor(fy / 1000));
}

export function towerAt(map: MapDef, fx: Fixed, fy: Fixed): boolean {
  for (const t of map.energyTowers) {
    const dx = fx - toFixed(t.x);
    const dy = fy - toFixed(t.y);
    const r = toFixed(t.radius);
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Validador (sprint-01): simetria 180° + conectividade por flood fill
// ---------------------------------------------------------------------------

export interface MapValidation {
  ok: boolean;
  errors: string[];
}

export function validateMap(map: MapDef): MapValidation {
  const errors: string[] = [];

  // Simetria de obstáculos por célula.
  const blocked = (x: number, y: number) =>
    map.obstacles.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (blocked(x, y) !== blocked(map.width - 1 - x, map.height - 1 - y)) {
        errors.push(`obstáculo assimétrico na célula (${x}, ${y})`);
      }
    }
  }

  // Simetria de torres e cores.
  for (const t of map.energyTowers) {
    const m = mirrorPoint(t, map.width, map.height);
    if (!map.energyTowers.some((o) => o.x === m.x && o.y === m.y && o.radius === t.radius)) {
      errors.push(`torre sem espelho: (${t.x}, ${t.y})`);
    }
  }
  const coreMirror = mirrorPoint(map.cores.cian, map.width, map.height);
  if (coreMirror.x !== map.cores.magenta.x || coreMirror.y !== map.cores.magenta.y) {
    errors.push('cores não são espelhados');
  }

  // Spawns e cores em células livres.
  const mustBeFree = [
    map.cores.cian,
    map.cores.magenta,
    ...map.fragmentSpawns,
    ...map.unitSpawns.cian,
    ...map.unitSpawns.magenta,
  ];
  for (const p of mustBeFree) {
    if (isBlockedCell(map, Math.floor(p.x), Math.floor(p.y))) {
      errors.push(`ponto obrigatório bloqueado: (${p.x}, ${p.y})`);
    }
  }

  // Conectividade: flood fill do núcleo cian deve alcançar núcleo magenta e spawns.
  const seen = new Set<number>();
  const key = (x: number, y: number) => y * map.width + x;
  const queue: [number, number][] = [[Math.floor(map.cores.cian.x), Math.floor(map.cores.cian.y)]];
  seen.add(key(queue[0]![0], queue[0]![1]));
  while (queue.length > 0) {
    const [cx, cy] = queue.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isBlockedCell(map, nx, ny) && !seen.has(key(nx, ny))) {
        seen.add(key(nx, ny));
        queue.push([nx, ny]);
      }
    }
  }
  const mustReach = [map.cores.magenta, ...map.fragmentSpawns];
  for (const p of mustReach) {
    if (!seen.has(key(Math.floor(p.x), Math.floor(p.y)))) {
      errors.push(`inalcançável a partir do núcleo cian: (${p.x}, ${p.y})`);
    }
  }

  return { ok: errors.length === 0, errors };
}
