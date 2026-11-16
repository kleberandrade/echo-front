import type { DecisionPayload, PerceptionPayload, Team } from '@echo-front/protocol';
import { ARENA_ALPHA, DEFAULT_CONFIG } from '@echo-front/sim';
import type { PerceptionBotFn } from './bots.js';
import { createNavigator, distance } from './navigation.js';
import { siegeRoutine } from './siege.js';

type Point = [number, number];
const point = (p: { x: number; y: number }): Point => [p.x, p.y];
const heading = (from: Point, to: Point): number =>
  ((Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI + 360) % 360;

function move(p: PerceptionPayload, waypoint: Point, mode: string): DecisionPayload {
  const length = distance(p.self.position, waypoint);
  const boost = p.self.class === 'runner' && p.self.energy > 35 && length > 5;
  const carry = p.self.carrying_fragment ? 0.8 : 1;
  const perCycle =
    (DEFAULT_CONFIG.classes[p.self.class].maxSpeedPerTick / 1000) * 5 * carry * (boost ? 1.6 : 1);
  return {
    movement: {
      direction: heading(p.self.position, waypoint),
      speed: Math.min(1, length / perCycle),
    },
    ...(boost ? { action: 'speed_boost' as const } : {}),
    debug: { strategy: 'kleber-vanguard', mode, target: waypoint },
  };
}

function defend(p: PerceptionPayload, decision: DecisionPayload): DecisionPayload {
  const enemy = p.sensors.visual.find((v) => v.type === 'unit' && v.distance < 2.9);
  if (enemy && p.self.energy >= 30 && (p.self.cooldowns['strike'] ?? 0) === 0) {
    decision.action = 'strike';
    const radians = (enemy.direction * Math.PI) / 180;
    decision.target = [
      p.self.position[0] + Math.cos(radians) * enemy.distance,
      p.self.position[1] + Math.sin(radians) * enemy.distance,
    ];
  }
  return decision;
}

class Collector {
  private readonly core: Point;
  private readonly spawns = ARENA_ALPHA.fragmentSpawns.map(point);
  private readonly navigate = createNavigator();
  private readonly siege: PerceptionBotFn;
  private readonly claims = new Map<string, Point>();
  private readonly visits = new Map<string, Map<number, number>>();

  constructor(team: Team) {
    this.core = point(ARENA_ALPHA.cores[team]);
    this.siege = siegeRoutine(team);
  }

  private chooseGoal(id: string, p: PerceptionPayload, cycle: number): Point {
    const seen = this.visits.get(id) ?? new Map<number, number>();
    this.visits.set(id, seen);
    this.spawns.forEach((spawn, i) => {
      if (distance(p.self.position, spawn) < 2.5) seen.set(i, cycle);
    });
    const known = p.objective.known_fragments.map((f) => f.position);
    const candidates = known.length ? known : this.spawns;
    const score = (goal: Point): number => {
      const claimed = p.allies.some(
        (ally) =>
          !ally.carrying_fragment &&
          distance(this.claims.get(ally.unitId) ?? ally.position, goal) < 2,
      );
      const agePenalty = known.length ? 0 : (seen.get(this.spawns.indexOf(goal)) ?? -100) * 0.3;
      return (
        this.navigate(p.self.position, goal).distance +
        distance(goal, this.core) * 0.2 +
        Number(claimed) * 18 +
        agePenalty
      );
    };
    const goal = [...candidates].sort((a, b) => score(a) - score(b))[0]!;
    this.claims.set(id, goal);
    return goal;
  }

  decide(id: string, p: PerceptionPayload, cycle: number): DecisionPayload {
    if (p.objective.mode === 'core_siege') return this.siege(id, p, cycle);
    if (p.self.carrying_fragment) {
      this.claims.delete(id);
      return move(p, this.navigate(p.self.position, this.core).waypoint, 'deliver');
    }
    const goal = this.chooseGoal(id, p, cycle);
    const decision =
      distance(p.self.position, goal) < 1.6
        ? { movement: { speed: 0 }, debug: { mode: 'capture' } }
        : move(p, this.navigate(p.self.position, goal).waypoint, 'collect');
    return defend(p, decision);
  }
}

/** Objective-first collector using only public geometry and team perceptions. */
export function vanguardBot(team: Team): PerceptionBotFn {
  const collector = new Collector(team);
  return (id, p, cycle) => collector.decide(id, p, cycle);
}
