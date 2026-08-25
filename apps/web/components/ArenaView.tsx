'use client';

/**
 * Arena 2,5D em PixiJS — projeção isométrica via matriz (mundo 64×36 → tela).
 * Redesenha a camada dinâmica a cada frame com interpolação entre ciclos.
 * Modos de visão: onisciente ('all') ou fog of war por time ('cian'/'magenta').
 */
import { useEffect, useRef } from 'react';
import {
  ARENA_ALPHA,
  DEFAULT_CONFIG,
  hasLineOfSight,
  inVisionCone,
  type MatchState,
  type Unit,
} from '@echo-front/sim';

export type ViewMode = 'all' | 'cian' | 'magenta';

export interface ArenaViewProps {
  state: MatchState;
  prevState?: MatchState;
  /** 0–1: interpolação entre prevState e state. */
  progress: number;
  mode: ViewMode;
  selectedUnitId?: string;
  onSelectUnit?: (unitId: string | undefined) => void;
  width?: number;
  height?: number;
}

const COLORS = {
  cian: 0x22d3ee,
  magenta: 0xe64ce6,
  amber: 0xf5b942,
  grid: 0x123a44,
  obstacle: 0x1c2733,
  fog: 0x02040a,
};

const K = 10; // px por unidade (antes da projeção)
const MAP = ARENA_ALPHA;
const CFG = DEFAULT_CONFIG;

function proj(x: number, y: number): [number, number] {
  return [K * (x - y) + K * MAP.height + 24, 0.5 * K * (x + y) + 16];
}

function unproj(sx: number, sy: number): [number, number] {
  const a = (sx - (K * MAP.height + 24)) / K; // x - y
  const b = (sy - 16) / (0.5 * K); // x + y
  return [(a + b) / 2, (b - a) / 2];
}

type Gfx = import('pixi.js').Graphics;

function polyProj(g: Gfx, pts: [number, number][]): Gfx {
  const flat: number[] = [];
  for (const [x, y] of pts) {
    const [sx, sy] = proj(x, y);
    flat.push(sx, sy);
  }
  return g.poly(flat);
}

function circleProj(g: Gfx, cx: number, cy: number, r: number, segments = 40): Gfx {
  const pts: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * 2 * Math.PI;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return polyProj(g, pts);
}

function conePts(u: { x: number; y: number; heading: number }, fov: number, range: number): [number, number][] {
  const cx = u.x / 1000;
  const cy = u.y / 1000;
  const pts: [number, number][] = [[cx, cy]];
  for (let a = -fov / 2; a <= fov / 2; a += fov / 8) {
    const rad = ((u.heading + a) * Math.PI) / 180;
    pts.push([cx + range * Math.cos(rad), cy + range * Math.sin(rad)]);
  }
  return pts;
}

/** O inimigo `target` é percebido pelo time `team` neste estado? */
function perceived(state: MatchState, team: 'cian' | 'magenta', tx: number, ty: number): boolean {
  for (const ally of state.units) {
    if (ally.team !== team || !ally.alive || ally.hiddenCycles > 0) continue;
    const stats = CFG.classes[ally.class];
    if (
      inVisionCone(ally, tx, ty, stats.visionFov, stats.visionRange) &&
      hasLineOfSight(MAP, ally.x, ally.y, tx, ty)
    ) {
      return true;
    }
  }
  for (const p of state.pulses) {
    if (p.team !== team) continue;
    const d = Math.hypot((p.x - tx) / 1000, (p.y - ty) / 1000);
    if (d <= CFG.sensors.radarRadius) return true;
  }
  return false;
}

export default function ArenaView(props: ArenaViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const trailsRef = useRef(new Map<string, [number, number][]>());
  const lastCycleRef = useRef(-1);

  useEffect(() => {
    let destroyed = false;
    let app: import('pixi.js').Application | undefined;

    void (async () => {
      const { Application, Container, Graphics } = await import('pixi.js');
      if (destroyed || !hostRef.current) return;

      const width = propsRef.current.width ?? 1080;
      const height = propsRef.current.height ?? 560;
      app = new Application();
      await app.init({ width, height, background: 0x07090d, antialias: true });
      if (destroyed || !hostRef.current) {
        app.destroy(true);
        return;
      }
      hostRef.current.appendChild(app.canvas);

      const root = new Container();
      app.stage.addChild(root);
      const ground = new Graphics();
      const dynamic = new Graphics();
      const fog = new Graphics();
      root.addChild(ground, dynamic, fog);

      // ------------------------------------------------------------------
      // Chão estático
      // ------------------------------------------------------------------
      for (let x = 0; x <= MAP.width; x += 4) {
        const [ax, ay] = proj(x, 0);
        const [bx, by] = proj(x, MAP.height);
        ground.moveTo(ax, ay).lineTo(bx, by);
      }
      for (let y = 0; y <= MAP.height; y += 4) {
        const [ax, ay] = proj(0, y);
        const [bx, by] = proj(MAP.width, y);
        ground.moveTo(ax, ay).lineTo(bx, by);
      }
      ground.stroke({ width: 1, color: COLORS.grid, alpha: 0.5 });

      polyProj(ground, [[0, 0], [MAP.width, 0], [MAP.width, MAP.height], [0, MAP.height]]).stroke({
        width: 2,
        color: COLORS.grid,
        alpha: 0.9,
      });

      for (const r of MAP.obstacles) {
        // Bloco "extrudado": topo deslocado para cima dá a leitura 2,5D.
        const base: [number, number][] = [
          [r.x, r.y],
          [r.x + r.w, r.y],
          [r.x + r.w, r.y + r.h],
          [r.x, r.y + r.h],
        ];
        const lift = 10;
        const top = base.map(([x, y]) => proj(x, y).map((v, i) => (i === 1 ? v - lift : v))) as [
          number,
          number,
        ][];
        polyProj(ground, base).fill({ color: COLORS.obstacle, alpha: 0.9 });
        ground.poly(top.flat()).fill({ color: 0x263445, alpha: 0.95 });
        ground.poly(top.flat()).stroke({ width: 1, color: 0x3d5a73, alpha: 0.9 });
      }

      for (const z of MAP.interferenceZones) {
        circleProj(ground, z.x, z.y, z.radius).stroke({ width: 1.5, color: 0x8a4de6, alpha: 0.5 });
        circleProj(ground, z.x, z.y, z.radius).fill({ color: 0x8a4de6, alpha: 0.06 });
      }
      for (const t of MAP.energyTowers) {
        circleProj(ground, t.x, t.y, t.radius).stroke({ width: 1, color: COLORS.amber, alpha: 0.4 });
        const [sx, sy] = proj(t.x, t.y);
        ground.poly([sx, sy - 12, sx + 5, sy - 2, sx - 5, sy - 2]).fill({ color: COLORS.amber, alpha: 0.8 });
      }
      for (const team of ['cian', 'magenta'] as const) {
        const c = MAP.cores[team];
        const [sx, sy] = proj(c.x, c.y);
        ground
          .poly([sx, sy - 14, sx + 9, sy, sx, sy + 7, sx - 9, sy])
          .fill({ color: COLORS[team], alpha: 0.9 });
        circleProj(ground, c.x, c.y, CFG.fragments.captureRadius).stroke({
          width: 1,
          color: COLORS[team],
          alpha: 0.5,
        });
      }

      // ------------------------------------------------------------------
      // Interação: clique seleciona unidade
      // ------------------------------------------------------------------
      app.canvas.addEventListener('click', (ev) => {
        const rect = app!.canvas.getBoundingClientRect();
        const [wx, wy] = unproj(ev.clientX - rect.left, ev.clientY - rect.top);
        const { state, onSelectUnit } = propsRef.current;
        let best: string | undefined;
        let bestD = 2.5;
        for (const u of state.units) {
          if (!u.alive) continue;
          const d = Math.hypot(u.x / 1000 - wx, u.y / 1000 - wy);
          if (d < bestD) {
            bestD = d;
            best = u.id;
          }
        }
        onSelectUnit?.(best);
      });

      // ------------------------------------------------------------------
      // Camada dinâmica por frame
      // ------------------------------------------------------------------
      const lerpUnit = (u: Unit, prev: MatchState | undefined, t: number): [number, number] => {
        const pu = prev?.units.find((p) => p.id === u.id);
        const x = pu ? pu.x + (u.x - pu.x) * t : u.x;
        const y = pu ? pu.y + (u.y - pu.y) * t : u.y;
        return [x / 1000, y / 1000];
      };

      app.ticker.add(() => {
        const { state, prevState, progress, mode, selectedUnitId } = propsRef.current;
        const g = dynamic;
        g.clear();
        fog.clear();

        // Trilhas: registra posição a cada mudança de ciclo.
        if (state.cycle !== lastCycleRef.current) {
          lastCycleRef.current = state.cycle;
          for (const u of state.units) {
            if (!u.alive) continue;
            const arr = trailsRef.current.get(u.id) ?? [];
            arr.push([u.x / 1000, u.y / 1000]);
            if (arr.length > 22) arr.shift();
            trailsRef.current.set(u.id, arr);
          }
        }

        const showEnemy = (u: Unit): boolean => {
          if (mode === 'all') return true;
          if (u.team === mode) return true;
          if (u.hiddenCycles > 0) return false;
          return perceived(state, mode, u.x, u.y);
        };

        // Trilhas
        for (const u of state.units) {
          if (!u.alive || !showEnemy(u)) continue;
          const arr = trailsRef.current.get(u.id);
          if (!arr || arr.length < 2) continue;
          for (let i = 1; i < arr.length; i++) {
            const [ax, ay] = proj(arr[i - 1]![0], arr[i - 1]![1]);
            const [bx, by] = proj(arr[i]![0], arr[i]![1]);
            g.moveTo(ax, ay).lineTo(bx, by).stroke({
              width: 1.5,
              color: COLORS[u.team],
              alpha: 0.05 + (0.3 * i) / arr.length,
            });
          }
        }

        // Cones de visão (do time em foco, ou de todos no onisciente)
        for (const u of state.units) {
          if (!u.alive || u.hiddenCycles > 0) continue;
          if (mode !== 'all' && u.team !== mode) continue;
          const stats = CFG.classes[u.class];
          polyProj(g, conePts(u, stats.visionFov, stats.visionRange)).fill({
            color: COLORS[u.team],
            alpha: 0.05,
          });
        }

        // Pulsos de radar: onda expansiva animada
        for (const p of state.pulses) {
          const r = Math.max(1, progress) * CFG.sensors.radarRadius;
          circleProj(g, p.x / 1000, p.y / 1000, r).stroke({
            width: 2,
            color: COLORS[p.team],
            alpha: 0.6 * (1 - progress * 0.7),
          });
          circleProj(g, p.x / 1000, p.y / 1000, r * 0.6).stroke({
            width: 1,
            color: COLORS[p.team],
            alpha: 0.3,
          });
        }

        // Ruídos transientes (strike/boost): anel curto
        for (const n of state.noises) {
          circleProj(g, n.x / 1000, n.y / 1000, 1.5 + 2 * progress).stroke({
            width: 1.5,
            color: 0xffffff,
            alpha: 0.35 * n.intensity * (1 - progress),
          });
        }

        // Fragmentos
        for (const f of state.fragments) {
          if (f.state === 'delivered') continue;
          if (f.state === 'carried') continue; // brilha no portador
          const [sx, sy] = proj(f.x / 1000, f.y / 1000);
          g.poly([sx, sy - 10, sx + 6, sy - 2, sx, sy + 4, sx - 6, sy - 2]).fill({
            color: COLORS.amber,
            alpha: 0.95,
          });
          circleProj(g, f.x / 1000, f.y / 1000, 1.2 + 0.4 * Math.sin(progress * Math.PI * 2)).stroke({
            width: 1,
            color: COLORS.amber,
            alpha: 0.5,
          });
        }

        // Decoys: no onisciente, contorno tracejado; na visão de time inimigo
        // aparecem apenas se dentro de um cone (e aí a visão os desmascara).
        for (const d of state.decoys) {
          const visibleHere =
            mode === 'all' || d.team === mode || perceived(state, mode, d.x, d.y);
          if (!visibleHere) continue;
          const [sx, sy] = proj(d.x / 1000, d.y / 1000);
          g.poly([sx, sy - 9, sx + 6, sy + 3, sx - 6, sy + 3]).stroke({
            width: 1.5,
            color: COLORS[d.team],
            alpha: 0.7,
          });
          if (mode === 'all') {
            g.moveTo(sx - 5, sy - 6).lineTo(sx + 5, sy + 1).stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
          }
        }

        // Unidades
        for (const u of state.units) {
          if (!u.alive) continue;
          if (!showEnemy(u)) continue;
          const [wx, wy] = lerpUnit(u, prevState, progress);
          const [sx, sy] = proj(wx, wy);
          const color = COLORS[u.team];
          const ghost = u.hiddenCycles > 0;
          const alpha = ghost ? 0.35 : 1;

          // Sombra/base
          circleProj(g, wx, wy, 0.8).fill({ color, alpha: 0.15 * alpha });

          if (u.class === 'observer') {
            g.poly([sx, sy - 14, sx + 8, sy + 2, sx - 8, sy + 2]).fill({ color, alpha });
          } else {
            g.poly([sx, sy - 16, sx + 6, sy - 2, sx, sy + 2, sx - 6, sy - 2]).fill({ color, alpha });
          }
          // Indicador de rumo
          const rad = (u.heading * Math.PI) / 180;
          const [hx, hy] = proj(wx + 1.6 * Math.cos(rad), wy + 1.6 * Math.sin(rad));
          g.moveTo(sx, sy - 4).lineTo(hx, hy - 4).stroke({ width: 1.5, color: 0xffffff, alpha: 0.6 * alpha });

          if (u.carryingFragment) {
            g.poly([sx, sy - 22, sx + 4, sy - 16, sx, sy - 12, sx - 4, sy - 16]).fill({
              color: COLORS.amber,
              alpha: 1,
            });
            circleProj(g, wx, wy, 1.6).stroke({ width: 1.5, color: COLORS.amber, alpha: 0.7 });
          }
          if (u.id === selectedUnitId) {
            circleProj(g, wx, wy, 1.3).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
          }
          // Barra de integridade
          const stats = CFG.classes[u.class];
          const frac = u.integrity / stats.maxIntegrity;
          g.rect(sx - 10, sy + 7, 20, 2).fill({ color: 0x223344, alpha: 0.9 });
          g.rect(sx - 10, sy + 7, 20 * frac, 2).fill({
            color: frac > 0.5 ? 0x3ddc84 : frac > 0.25 ? COLORS.amber : 0xe64c5b,
            alpha: 0.95,
          });
        }

        // Fog of war (visões por time): escuro com furos nos cones + pulsos.
        if (mode !== 'all') {
          polyProj(fog, [[0, 0], [MAP.width, 0], [MAP.width, MAP.height], [0, MAP.height]]).fill({
            color: COLORS.fog,
            alpha: 0.72,
          });
          for (const u of state.units) {
            if (!u.alive || u.team !== mode || u.hiddenCycles > 0) continue;
            const stats = CFG.classes[u.class];
            polyProj(fog, conePts(u, stats.visionFov, stats.visionRange)).cut();
            circleProj(fog, u.x / 1000, u.y / 1000, 3).cut();
          }
          for (const p of state.pulses) {
            if (p.team !== mode) continue;
            circleProj(fog, p.x / 1000, p.y / 1000, CFG.sensors.radarRadius).cut();
          }
        }
      });
    })();

    return () => {
      destroyed = true;
      app?.destroy(true, { children: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="overflow-x-auto" />;
}
