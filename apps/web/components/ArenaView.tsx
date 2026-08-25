'use client';

/**
 * Arena 2,5D em PixiJS — visual guiado pelo concept art (docs/assets/concept-01.png):
 * placa eletrônica viva, wireframes translúcidos, glow ciano/magenta, trilhas
 * pontilhadas com setas, anéis de sonar, pedestal âmbar do fragmento e fog of
 * war por time. Camada de glow = redesenho borrado das formas-chave.
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
  progress: number;
  mode: ViewMode;
  selectedUnitId?: string;
  onSelectUnit?: (unitId: string | undefined) => void;
  width?: number;
  height?: number;
}

const COLORS = {
  cian: 0x22d3ee,
  cianDim: 0x0e7490,
  magenta: 0xe64ce6,
  magentaDim: 0x86259c,
  amber: 0xf5b942,
  grid: 0x0f3038,
  wire: 0x2a4155,
  fog: 0x02040a,
};

const K = 10;
const MAP = ARENA_ALPHA;
const CFG = DEFAULT_CONFIG;
const LIFT = 16; // altura visual dos blocos

export function projPoint(x: number, y: number): [number, number] {
  return [K * (x - y) + K * MAP.height + 24, 0.5 * K * (x + y) + 26];
}

function unproj(sx: number, sy: number): [number, number] {
  const a = (sx - (K * MAP.height + 24)) / K;
  const b = (sy - 26) / (0.5 * K);
  return [(a + b) / 2, (b - a) / 2];
}

type Gfx = import('pixi.js').Graphics;

function polyProj(g: Gfx, pts: [number, number][], liftPx = 0): Gfx {
  const flat: number[] = [];
  for (const [x, y] of pts) {
    const [sx, sy] = projPoint(x, y);
    flat.push(sx, sy - liftPx);
  }
  return g.poly(flat);
}

function circleProj(g: Gfx, cx: number, cy: number, r: number, segments = 44): Gfx {
  const pts: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * 2 * Math.PI;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return polyProj(g, pts);
}

/** Círculo pontilhado (estética de circuito). */
function dottedCircle(
  g: Gfx,
  cx: number,
  cy: number,
  r: number,
  color: number,
  alpha: number,
  dots = 36,
): void {
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * 2 * Math.PI;
    const [sx, sy] = projPoint(cx + r * Math.cos(a), cy + r * Math.sin(a));
    g.circle(sx, sy, 1).fill({ color, alpha });
  }
}

function conePts(
  u: { x: number; y: number; heading: number },
  fov: number,
  range: number,
): [number, number][] {
  const cx = u.x / 1000;
  const cy = u.y / 1000;
  const pts: [number, number][] = [[cx, cy]];
  for (let a = -fov / 2; a <= fov / 2; a += fov / 10) {
    const rad = ((u.heading + a) * Math.PI) / 180;
    pts.push([cx + range * Math.cos(rad), cy + range * Math.sin(rad)]);
  }
  return pts;
}

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
    if (Math.hypot((p.x - tx) / 1000, (p.y - ty) / 1000) <= CFG.sensors.radarRadius) return true;
  }
  return false;
}

/** Diamante (cristal) projetado no ponto, com altura em px. */
function crystal(
  g: Gfx,
  x: number,
  y: number,
  size: number,
  color: number,
  alpha: number,
  lift = 0,
): void {
  const [sx, syRaw] = projPoint(x, y);
  const sy = syRaw - lift;
  g.poly([
    sx,
    sy - size * 1.6,
    sx + size,
    sy - size * 0.3,
    sx,
    sy + size * 0.5,
    sx - size,
    sy - size * 0.3,
  ]).fill({ color, alpha });
  g.poly([
    sx,
    sy - size * 1.6,
    sx + size,
    sy - size * 0.3,
    sx,
    sy + size * 0.5,
    sx - size,
    sy - size * 0.3,
  ]).stroke({ width: 1, color: 0xffffff, alpha: alpha * 0.35 });
  g.moveTo(sx, sy - size * 1.6)
    .lineTo(sx, sy + size * 0.5)
    .stroke({ width: 0.8, color: 0xffffff, alpha: alpha * 0.25 });
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
      const { Application, BlurFilter, Container, Graphics } = await import('pixi.js');
      if (destroyed || !hostRef.current) return;

      const width = propsRef.current.width ?? 1080;
      const height = propsRef.current.height ?? 580;
      app = new Application();
      await app.init({ width, height, background: 0x05070c, antialias: true });
      if (destroyed || !hostRef.current) {
        app.destroy(true);
        return;
      }
      hostRef.current.appendChild(app.canvas);

      const root = new Container();
      app.stage.addChild(root);
      const groundGlow = new Graphics();
      groundGlow.filters = [new BlurFilter({ strength: 6 })];
      const ground = new Graphics();
      const glow = new Graphics();
      glow.filters = [new BlurFilter({ strength: 7 })];
      glow.alpha = 0.9;
      const dynamic = new Graphics();
      const fog = new Graphics();
      root.addChild(groundGlow, ground, glow, dynamic, fog);

      // ------------------------------------------------------------------
      // Chão: circuito pontilhado + grid fraco + moldura
      // ------------------------------------------------------------------
      for (let x = 0; x <= MAP.width; x += 2) {
        for (let y = 0; y <= MAP.height; y += 2) {
          const [sx, sy] = projPoint(x, y);
          ground.circle(sx, sy, 0.7).fill({ color: COLORS.grid, alpha: 0.7 });
        }
      }
      for (let x = 0; x <= MAP.width; x += 8) {
        const [ax, ay] = projPoint(x, 0);
        const [bx, by] = projPoint(x, MAP.height);
        ground.moveTo(ax, ay).lineTo(bx, by).stroke({ width: 1, color: COLORS.grid, alpha: 0.35 });
      }
      for (let y = 0; y <= MAP.height; y += 8) {
        const [ax, ay] = projPoint(0, y);
        const [bx, by] = projPoint(MAP.width, y);
        ground.moveTo(ax, ay).lineTo(bx, by).stroke({ width: 1, color: COLORS.grid, alpha: 0.35 });
      }
      polyProj(ground, [
        [0, 0],
        [MAP.width, 0],
        [MAP.width, MAP.height],
        [0, MAP.height],
      ]).stroke({
        width: 1.5,
        color: 0x155e6e,
        alpha: 0.8,
      });
      // Halos de território nos cantos (ciano a oeste, magenta a leste).
      polyProj(groundGlow, [
        [0, 0],
        [10, 0],
        [0, 36],
      ]).fill({ color: COLORS.cianDim, alpha: 0.25 });
      polyProj(groundGlow, [
        [64, 0],
        [64, 36],
        [54, 36],
      ]).fill({ color: COLORS.magentaDim, alpha: 0.25 });

      // Obstáculos: blocos wireframe translúcidos "extrudados".
      for (const r of MAP.obstacles) {
        const corners: [number, number][] = [
          [r.x, r.y],
          [r.x + r.w, r.y],
          [r.x + r.w, r.y + r.h],
          [r.x, r.y + r.h],
        ];
        polyProj(ground, corners).fill({ color: 0x0d1420, alpha: 0.85 });
        polyProj(ground, corners, LIFT).fill({ color: 0x131c2b, alpha: 0.9 });
        polyProj(ground, corners, LIFT).stroke({ width: 1.2, color: COLORS.wire, alpha: 0.9 });
        for (const [cx, cy] of corners) {
          const [sx, sy] = projPoint(cx, cy);
          ground
            .moveTo(sx, sy)
            .lineTo(sx, sy - LIFT)
            .stroke({ width: 1, color: COLORS.wire, alpha: 0.7 });
        }
        polyProj(ground, corners).stroke({ width: 1, color: COLORS.wire, alpha: 0.4 });
      }

      // Zonas de interferência: círculo pontilhado violeta.
      for (const z of MAP.interferenceZones) {
        dottedCircle(ground, z.x, z.y, z.radius, 0x9d5ce6, 0.7);
        circleProj(groundGlow, z.x, z.y, z.radius).fill({ color: 0x8a4de6, alpha: 0.08 });
      }

      // Torres de energia: obelisco âmbar com anel.
      for (const t of MAP.energyTowers) {
        dottedCircle(ground, t.x, t.y, t.radius, COLORS.amber, 0.5, 24);
        crystal(ground, t.x, t.y, 5, COLORS.amber, 0.9, 6);
        crystal(groundGlow, t.x, t.y, 7, COLORS.amber, 0.5, 6);
      }

      // Núcleos: estrutura hex com glow do time.
      for (const team of ['cian', 'magenta'] as const) {
        const c = MAP.cores[team];
        crystal(ground, c.x, c.y, 7, COLORS[team], 0.95, 8);
        crystal(groundGlow, c.x, c.y, 10, COLORS[team], 0.6, 8);
        dottedCircle(ground, c.x, c.y, CFG.fragments.captureRadius, COLORS[team], 0.6, 20);
      }

      // ------------------------------------------------------------------
      // Clique → seleção
      // ------------------------------------------------------------------
      app.canvas.addEventListener('click', (ev) => {
        const rect = app!.canvas.getBoundingClientRect();
        const scaleX = app!.canvas.width / rect.width / app!.renderer.resolution;
        const [wx, wy] = unproj(
          (ev.clientX - rect.left) * scaleX,
          (ev.clientY - rect.top) * scaleX,
        );
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
      // Frame
      // ------------------------------------------------------------------
      const lerpUnit = (u: Unit, prev: MatchState | undefined, t: number): [number, number] => {
        const pu = prev?.units.find((p) => p.id === u.id);
        return [
          (pu ? pu.x + (u.x - pu.x) * t : u.x) / 1000,
          (pu ? pu.y + (u.y - pu.y) * t : u.y) / 1000,
        ];
      };

      const drawUnitShape = (
        g: Gfx,
        u: Unit,
        sx: number,
        sy: number,
        color: number,
        alpha: number,
        scale = 1,
      ): void => {
        if (u.class === 'observer') {
          // Tetraedro (como o CIAN SCOUT do concept)
          const s = 9 * scale;
          g.poly([sx, sy - s * 1.8, sx + s, sy + s * 0.4, sx - s, sy + s * 0.4]).fill({
            color,
            alpha: alpha * 0.85,
          });
          g.poly([sx, sy - s * 1.8, sx + s, sy + s * 0.4, sx - s, sy + s * 0.4]).stroke({
            width: 1.2,
            color: 0xffffff,
            alpha: alpha * 0.5,
          });
          g.moveTo(sx, sy - s * 1.8)
            .lineTo(sx, sy + s * 0.4)
            .stroke({ width: 0.8, color: 0xffffff, alpha: alpha * 0.35 });
        } else if (u.class === 'phantom') {
          // Prisma fantasma
          const s = 8 * scale;
          g.poly([sx, sy - s * 1.9, sx + s * 0.8, sy, sx, sy + s * 0.5, sx - s * 0.8, sy]).stroke({
            width: 1.4,
            color,
            alpha,
          });
          g.poly([sx, sy - s * 1.9, sx + s * 0.8, sy, sx, sy + s * 0.5, sx - s * 0.8, sy]).fill({
            color,
            alpha: alpha * 0.25,
          });
        } else {
          // Runner: obelisco
          const s = 8 * scale;
          g.poly([
            sx,
            sy - s * 2.1,
            sx + s * 0.7,
            sy - s * 0.3,
            sx,
            sy + s * 0.4,
            sx - s * 0.7,
            sy - s * 0.3,
          ]).fill({ color, alpha: alpha * 0.9 });
          g.poly([
            sx,
            sy - s * 2.1,
            sx + s * 0.7,
            sy - s * 0.3,
            sx,
            sy + s * 0.4,
            sx - s * 0.7,
            sy - s * 0.3,
          ]).stroke({ width: 1.1, color: 0xffffff, alpha: alpha * 0.45 });
        }
      };

      app.ticker.add(() => {
        const { state, prevState, progress, mode, selectedUnitId } = propsRef.current;
        const g = dynamic;
        g.clear();
        glow.clear();
        fog.clear();

        if (state.cycle !== lastCycleRef.current) {
          lastCycleRef.current = state.cycle;
          for (const u of state.units) {
            if (!u.alive) continue;
            const arr = trailsRef.current.get(u.id) ?? [];
            arr.push([u.x / 1000, u.y / 1000]);
            if (arr.length > 26) arr.shift();
            trailsRef.current.set(u.id, arr);
          }
        }

        const showEnemy = (u: Unit): boolean => {
          if (mode === 'all' || u.team === mode) return true;
          if (u.hiddenCycles > 0) return false;
          return perceived(state, mode, u.x, u.y);
        };

        // Rastros de calor (onisciente): brasas fracas.
        if (mode === 'all') {
          for (const t of state.heatTrails) {
            const [sx, sy] = projPoint(t.x / 1000, t.y / 1000);
            g.circle(sx, sy, 2).fill({ color: 0xe66a3c, alpha: 0.1 * t.cyclesLeft });
          }
        }

        // Trilhas pontilhadas com seta na ponta.
        for (const u of state.units) {
          if (!u.alive || !showEnemy(u)) continue;
          const arr = trailsRef.current.get(u.id);
          if (!arr || arr.length < 2) continue;
          for (let i = 1; i < arr.length; i++) {
            const [sx, sy] = projPoint(arr[i]![0], arr[i]![1]);
            g.circle(sx, sy, 1.3).fill({
              color: COLORS[u.team],
              alpha: 0.06 + (0.4 * i) / arr.length,
            });
          }
          const [ax, ay] = projPoint(arr[arr.length - 2]![0], arr[arr.length - 2]![1]);
          const [bx, by] = projPoint(arr[arr.length - 1]![0], arr[arr.length - 1]![1]);
          const ang = Math.atan2(by - ay, bx - ax);
          g.poly([
            bx + 5 * Math.cos(ang),
            by + 5 * Math.sin(ang),
            bx + Math.cos(ang + 2.5) * 4,
            by + Math.sin(ang + 2.5) * 4,
            bx + Math.cos(ang - 2.5) * 4,
            by + Math.sin(ang - 2.5) * 4,
          ]).fill({ color: COLORS[u.team], alpha: 0.5 });
        }

        // Cones de visão.
        for (const u of state.units) {
          if (!u.alive || u.hiddenCycles > 0) continue;
          if (mode !== 'all' && u.team !== mode) continue;
          const stats = CFG.classes[u.class];
          polyProj(g, conePts(u, stats.visionFov, stats.visionRange)).fill({
            color: COLORS[u.team],
            alpha: 0.05,
          });
          polyProj(g, conePts(u, stats.visionFov, stats.visionRange)).stroke({
            width: 1,
            color: COLORS[u.team],
            alpha: 0.12,
          });
        }

        // Anéis de sonar dos observers (idle, como no concept).
        for (const u of state.units) {
          if (!u.alive || u.class !== 'observer' || u.hiddenCycles > 0) continue;
          if (mode !== 'all' && u.team !== mode) continue;
          const [cx, cy] = lerpUnit(u, prevState, progress);
          const phase = (state.cycle % 3) / 3 + progress / 3;
          for (let i = 0; i < 3; i++) {
            const r = ((i + phase) / 3) * 9;
            circleProj(g, cx, cy, r).stroke({
              width: 1,
              color: COLORS[u.team],
              alpha: 0.14 * (1 - r / 9) + 0.02,
            });
          }
        }

        // Pulsos de radar.
        for (const p of state.pulses) {
          const r = Math.max(1, progress) * CFG.sensors.radarRadius;
          circleProj(g, p.x / 1000, p.y / 1000, r).stroke({
            width: 2,
            color: COLORS[p.team],
            alpha: 0.55 * (1 - progress * 0.7),
          });
          circleProj(g, p.x / 1000, p.y / 1000, r * 0.66).stroke({
            width: 1,
            color: COLORS[p.team],
            alpha: 0.3,
          });
          circleProj(glow, p.x / 1000, p.y / 1000, r).stroke({
            width: 4,
            color: COLORS[p.team],
            alpha: 0.4 * (1 - progress * 0.7),
          });
        }

        // Ruídos.
        for (const n of state.noises) {
          circleProj(g, n.x / 1000, n.y / 1000, 1.5 + 2 * progress).stroke({
            width: 1.5,
            color: 0xffffff,
            alpha: 0.3 * n.intensity * (1 - progress),
          });
        }

        // Fragmentos no chão: cristal âmbar em pedestal com glow.
        for (const f of state.fragments) {
          if (f.state !== 'spawned' && f.state !== 'dropped') continue;
          const fx = f.x / 1000;
          const fy = f.y / 1000;
          circleProj(g, fx, fy, 1.4).fill({ color: 0x1a1206, alpha: 0.9 });
          circleProj(g, fx, fy, 1.4).stroke({ width: 1, color: COLORS.amber, alpha: 0.6 });
          const bob = 3 * Math.sin(progress * Math.PI * 2 + state.cycle);
          crystal(g, fx, fy, 6, COLORS.amber, 0.95, 10 + bob);
          crystal(glow, fx, fy, 9, COLORS.amber, 0.7, 10 + bob);
        }

        // Decoys: holograma tracejado (a "mentira" fica linda no onisciente).
        for (const d of state.decoys) {
          const visibleHere = mode === 'all' || d.team === mode || perceived(state, mode, d.x, d.y);
          if (!visibleHere) continue;
          const [sx, sy] = projPoint(d.x / 1000, d.y / 1000);
          const flicker = 0.55 + 0.35 * Math.sin(progress * Math.PI * 6 + d.x);
          g.poly([sx, sy - 15, sx + 7, sy + 2, sx - 7, sy + 2]).stroke({
            width: 1.4,
            color: COLORS[d.team],
            alpha: flicker,
          });
          glow
            .poly([sx, sy - 15, sx + 7, sy + 2, sx - 7, sy + 2])
            .stroke({ width: 3, color: COLORS[d.team], alpha: flicker * 0.5 });
          dottedCircle(g, d.x / 1000, d.y / 1000, 1.1, COLORS[d.team], flicker * 0.5, 12);
          if (mode === 'all') {
            g.moveTo(sx - 6, sy - 9)
              .lineTo(sx + 6, sy - 3)
              .stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
          }
        }

        // Unidades.
        for (const u of state.units) {
          if (!u.alive || !showEnemy(u)) continue;
          const [wx, wy] = lerpUnit(u, prevState, progress);
          const [sx, sy] = projPoint(wx, wy);
          const color = COLORS[u.team];
          const ghosted = u.hiddenCycles > 0;
          const alpha = ghosted ? 0.35 : 1;

          circleProj(g, wx, wy, 0.9).stroke({ width: 1, color, alpha: 0.35 * alpha });
          drawUnitShape(g, u, sx, sy, color, alpha);
          drawUnitShape(glow, u, sx, sy, color, alpha * 0.55, 1.25);

          const rad = (u.heading * Math.PI) / 180;
          const [hx, hy] = projPoint(wx + 2.0 * Math.cos(rad), wy + 2.0 * Math.sin(rad));
          g.moveTo(sx, sy - 4)
            .lineTo(hx, hy - 4)
            .stroke({ width: 1.4, color: 0xffffff, alpha: 0.55 * alpha });

          if (u.carryingFragment) {
            crystal(g, wx, wy, 4, COLORS.amber, 1, 26);
            crystal(glow, wx, wy, 6, COLORS.amber, 0.7, 26);
            dottedCircle(g, wx, wy, 1.8, COLORS.amber, 0.6, 16);
          }
          if (u.id === selectedUnitId) {
            circleProj(g, wx, wy, 1.5).stroke({ width: 1.6, color: 0xffffff, alpha: 0.9 });
            dottedCircle(g, wx, wy, 2.0, 0xffffff, 0.5, 20);
          }
          const stats = CFG.classes[u.class];
          const frac = u.integrity / stats.maxIntegrity;
          g.rect(sx - 11, sy + 8, 22, 2.5).fill({ color: 0x16202e, alpha: 0.9 });
          g.rect(sx - 11, sy + 8, 22 * frac, 2.5).fill({
            color: frac > 0.5 ? 0x3ddc84 : frac > 0.25 ? COLORS.amber : 0xe64c5b,
            alpha: 0.95,
          });
        }

        // Fog of war por time.
        if (mode !== 'all') {
          polyProj(fog, [
            [-3, -3],
            [MAP.width + 3, -3],
            [MAP.width + 3, MAP.height + 3],
            [-3, MAP.height + 3],
          ]).fill({ color: COLORS.fog, alpha: 0.78 });
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
