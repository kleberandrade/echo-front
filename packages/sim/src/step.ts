/**
 * Pipeline de tick (docs/05-simulacao.md). Sprint 3: Data Run completo —
 * fragmentos, decoy/hide/boost/strike, combate e condições de vitória.
 */
import { dist2, moveFixed, toFixed } from './fixed.js';
import { isBlockedFixed, towerAt, type MapDef } from './map.js';
import { deriveStream, nextInt, seedRng } from './rng.js';
import { distanceUnits, hasLineOfSight, inVisionCone } from './geometry.js';
import {
  DEFAULT_CONFIG,
  type DecisionsByUnit,
  type MatchConfig,
  type MatchState,
  type TickResult,
  type Unit,
} from './types.js';

export const SIM_VERSION = '0.3.0';

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------

export function createMatch(
  seed: string,
  map: MapDef,
  cfg: MatchConfig = DEFAULT_CONFIG,
): MatchState {
  const mkUnit = (team: 'cian' | 'magenta', idx: number, cls: 'observer' | 'runner'): Unit => {
    const spawn = map.unitSpawns[team][idx]!;
    const stats = cfg.classes[cls];
    return {
      id: `${team}_${cls}_1`,
      team,
      class: cls,
      x: toFixed(spawn.x),
      y: toFixed(spawn.y),
      heading: team === 'cian' ? 0 : 180,
      speed: 0,
      energy: Math.min(80, stats.maxEnergy),
      integrity: stats.maxIntegrity,
      alive: true,
      carryingFragment: false,
      cooldowns: {},
      hiddenCycles: 0,
      boosting: false,
      energySpent: 0,
    };
  };

  const units = [
    mkUnit('cian', 0, 'observer'),
    mkUnit('cian', 1, 'runner'),
    mkUnit('magenta', 0, 'observer'),
    mkUnit('magenta', 1, 'runner'),
  ].sort((a, b) => (a.id < b.id ? -1 : 1));

  return {
    simVersion: SIM_VERSION,
    cycle: 0,
    tick: 0,
    seed,
    rngState: seedRng(seed),
    units,
    fragments: [],
    decoys: [],
    noises: [],
    messages: [],
    pulses: [],
    cycleEvents: ['match_start'],
    score: { cian: 0, magenta: 0 },
    ended: false,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampHeading(deg: number): number {
  const d = Math.round(deg) % 360;
  return d < 0 ? d + 360 : d;
}

export function inInterference(map: MapDef, fx: number, fy: number): boolean {
  for (const z of map.interferenceZones) {
    const dx = fx - toFixed(z.x);
    const dy = fy - toFixed(z.y);
    const r = toFixed(z.radius);
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

function spend(unit: Unit, amount: number): void {
  unit.energy -= amount;
  unit.energySpent += amount;
}

/** Derruba a unidade: solta fragmento no local e registra evento. */
function destroyUnit(s: MatchState, unit: Unit): void {
  unit.alive = false;
  unit.speed = 0;
  if (unit.carryingFragment) {
    unit.carryingFragment = false;
    const frag = s.fragments.find((f) => f.carrier === unit.id);
    if (frag) {
      frag.state = 'dropped';
      frag.carrier = undefined;
      frag.x = unit.x;
      frag.y = unit.y;
      s.cycleEvents.push('fragment_dropped');
    }
  }
  s.cycleEvents.push(`unit_destroyed:${unit.id}`);
}

// ---------------------------------------------------------------------------
// step — um tick
// ---------------------------------------------------------------------------

/**
 * Avança um tick. `decisions` só é considerado no primeiro tick de cada ciclo.
 * Retorna novo estado (o de entrada não é modificado).
 */
export function step(
  state: MatchState,
  decisions: DecisionsByUnit,
  map: MapDef,
  cfg: MatchConfig = DEFAULT_CONFIG,
): TickResult {
  if (state.ended) return { state, events: [] };

  const s: MatchState = structuredClone(state);
  const events: string[] = [];
  const isCycleStart = s.tick % cfg.ticksPerCycle === 0;
  const isCycleEnd = s.tick % cfg.ticksPerCycle === cfg.ticksPerCycle - 1;
  const ac = cfg.actions;

  // 1. Início de ciclo: expira transientes, spawna fragmentos, aplica decisões.
  if (isCycleStart) {
    if (s.tick > 0) s.cycleEvents = [];
    s.pulses = [];
    s.noises = [];
    s.messages = s.messages.filter((m) => m.cycle >= s.cycle - 1);
    for (const u of s.units) u.boosting = false;

    spawnFragments(s, map, cfg);

    for (const unit of s.units) {
      if (!unit.alive) continue;
      const d = decisions[unit.id];
      if (!d) continue;

      if (d.movement) {
        if (d.movement.direction !== undefined) unit.heading = clampHeading(d.movement.direction);
        if (d.movement.speed !== undefined) {
          unit.speed = Math.max(0, Math.min(1000, Math.round(d.movement.speed * 1000)));
        }
        // Mover quebra a camuflagem.
        if (unit.hiddenCycles > 0 && (d.movement.speed ?? 0) > 0) unit.hiddenCycles = 0;
      }

      switch (d.action) {
        case 'pulse_scan': {
          const cost =
            unit.class === 'observer' ? cfg.sensors.radarCostObserver : cfg.sensors.radarCost;
          if ((unit.cooldowns['pulse_scan'] ?? 0) === 0 && unit.energy >= cost) {
            spend(unit, cost);
            unit.cooldowns['pulse_scan'] = cfg.sensors.radarCooldownCycles;
            unit.hiddenCycles = 0;
            s.pulses.push({ unitId: unit.id, team: unit.team, x: unit.x, y: unit.y });
            s.cycleEvents.push('pulse_scan_detected');
          }
          break;
        }
        case 'deploy_decoy': {
          if ((unit.cooldowns['deploy_decoy'] ?? 0) === 0 && unit.energy >= ac.decoyCost) {
            spend(unit, ac.decoyCost);
            unit.cooldowns['deploy_decoy'] = ac.decoyLifeCycles;
            unit.hiddenCycles = 0;
            const target = d.target ?? [unit.x / 1000, unit.y / 1000];
            // Decoy nasce no alvo, limitado a 4 u da unidade e fora de obstáculo.
            let dx = toFixed(target[0]);
            let dy = toFixed(target[1]);
            if (distanceUnits(unit.x, unit.y, dx, dy) > 4 || isBlockedFixed(map, dx, dy)) {
              dx = unit.x;
              dy = unit.y;
            }
            s.decoys.push({
              id: `decoy_${unit.id}_${s.cycle}`,
              team: unit.team,
              x: dx,
              y: dy,
              lifeCycles: ac.decoyLifeCycles,
            });
            s.cycleEvents.push('decoy_deployed');
          }
          break;
        }
        case 'hide': {
          if (unit.energy >= ac.hideCost && unit.hiddenCycles === 0) {
            spend(unit, ac.hideCost);
            unit.hiddenCycles = ac.hideCycles;
            unit.speed = 0; // imóvel enquanto oculto
          }
          break;
        }
        case 'speed_boost': {
          if (unit.class === 'runner' && unit.energy >= ac.boostCostPerCycle) {
            spend(unit, ac.boostCostPerCycle);
            unit.boosting = true;
            unit.hiddenCycles = 0;
            s.noises.push({ x: unit.x, y: unit.y, intensity: ac.boostNoise });
          }
          break;
        }
        case 'strike': {
          if ((unit.cooldowns['strike'] ?? 0) === 0 && unit.energy >= ac.strikeCost) {
            // Alvo: inimigo vivo mais próximo dentro do alcance.
            let best: Unit | undefined;
            let bestDist = Infinity;
            for (const enemy of s.units) {
              if (enemy.team === unit.team || !enemy.alive) continue;
              const dist = distanceUnits(unit.x, unit.y, enemy.x, enemy.y);
              if (dist <= ac.strikeRange && dist < bestDist) {
                best = enemy;
                bestDist = dist;
              }
            }
            if (best) {
              spend(unit, ac.strikeCost);
              unit.cooldowns['strike'] = 1;
              unit.hiddenCycles = 0;
              best.integrity = Math.max(0, best.integrity - ac.strikeDamage);
              s.noises.push({ x: unit.x, y: unit.y, intensity: ac.strikeNoise });
              s.cycleEvents.push('strike');
              if (best.integrity === 0) destroyUnit(s, best);
            }
          }
          break;
        }
        default:
          break;
      }

      if (d.message_to_team !== undefined && d.message_to_team.length > 0) {
        if (!inInterference(map, unit.x, unit.y)) {
          s.messages.push({
            from: unit.id,
            team: unit.team,
            data: d.message_to_team.slice(0, 64),
            cycle: s.cycle,
          });
        }
      }
    }
  }

  // 2. Física/movimento com colisões (ocultos e portadores têm modificadores).
  for (const unit of s.units) {
    if (!unit.alive || unit.speed === 0 || unit.hiddenCycles > 0) continue;
    const stats = cfg.classes[unit.class];
    let effectiveSpeed = unit.energy <= 0 ? Math.min(unit.speed, cfg.exhaustedSpeedCap) : unit.speed;
    let maxPerTick = stats.maxSpeedPerTick;
    if (unit.boosting) maxPerTick = Math.round((maxPerTick * cfg.actions.boostFactor) / 1000);
    if (unit.carryingFragment)
      maxPerTick = Math.round((maxPerTick * cfg.fragments.carrySpeedFactor) / 1000);
    const dist = Math.round((maxPerTick * effectiveSpeed) / 1000);
    const [nx, ny] = moveFixed(unit.x, unit.y, unit.heading, dist);

    let tx = unit.x;
    let ty = unit.y;
    if (!isBlockedFixed(map, nx, ny)) {
      tx = nx;
      ty = ny;
    } else if (!isBlockedFixed(map, nx, unit.y)) {
      tx = nx;
    } else if (!isBlockedFixed(map, unit.x, ny)) {
      ty = ny;
    }

    const minD2 = (2 * cfg.unitRadius) * (2 * cfg.unitRadius);
    const collides = s.units.some(
      (o) => o.id !== unit.id && o.alive && dist2(tx, ty, o.x, o.y) < minD2,
    );
    if (!collides) {
      unit.x = tx;
      unit.y = ty;
    }
    // Fragmento carregado acompanha o portador.
    if (unit.carryingFragment) {
      const frag = s.fragments.find((f) => f.carrier === unit.id);
      if (frag) {
        frag.x = unit.x;
        frag.y = unit.y;
      }
    }
  }

  // 3. Entidades em andamento: decoys morrem se vistos por visão direta.
  for (const decoy of s.decoys) {
    for (const enemy of s.units) {
      if (!enemy.alive || enemy.team === decoy.team || enemy.hiddenCycles > 0) continue;
      const stats = cfg.classes[enemy.class];
      if (
        inVisionCone(enemy, decoy.x, decoy.y, stats.visionFov, stats.visionRange) &&
        hasLineOfSight(map, enemy.x, enemy.y, decoy.x, decoy.y)
      ) {
        decoy.lifeCycles = 0;
        s.cycleEvents.push('decoy_destroyed');
      }
    }
  }
  s.decoys = s.decoys.filter((d) => d.lifeCycles > 0);

  // 4. Objetivo (no fechamento do ciclo): captura e entrega.
  if (isCycleEnd) {
    objectiveTick(s, map, cfg);
  }

  // 5. Energia, cooldowns e vida de entidades (no fechamento do ciclo).
  if (isCycleEnd) {
    for (const unit of s.units) {
      if (!unit.alive) continue;
      const stats = cfg.classes[unit.class];
      let e = unit.energy + cfg.energyRegenPerCycle;
      if (towerAt(map, unit.x, unit.y)) e += cfg.towerBonusPerCycle;
      if (unit.speed > cfg.fastThreshold && unit.hiddenCycles === 0) {
        e -= cfg.fastMoveCostPerCycle;
        unit.energySpent += cfg.fastMoveCostPerCycle;
      }
      unit.energy = Math.max(0, Math.min(stats.maxEnergy, e));
      if (unit.hiddenCycles > 0) unit.hiddenCycles -= 1;
      for (const key of Object.keys(unit.cooldowns)) {
        const v = unit.cooldowns[key]!;
        if (v > 1) unit.cooldowns[key] = v - 1;
        else delete unit.cooldowns[key];
      }
    }
    for (const decoy of s.decoys) decoy.lifeCycles -= 1;
    s.decoys = s.decoys.filter((d) => d.lifeCycles > 0);
  }

  // 6. Relógio e fim de partida.
  s.tick += 1;
  if (s.tick % cfg.ticksPerCycle === 0) {
    s.cycle += 1;
    if (
      s.score.cian >= cfg.fragments.deliveriesToWin ||
      s.score.magenta >= cfg.fragments.deliveriesToWin
    ) {
      s.ended = true;
      s.endReason = 'fragments_delivered';
      events.push('match_end:fragments_delivered');
      s.cycleEvents.push('match_end:fragments_delivered');
    } else if (s.cycle >= cfg.totalCycles) {
      s.ended = true;
      s.endReason = 'time_up';
      events.push('match_end:time_up');
      s.cycleEvents.push('match_end:time_up');
    }
  }

  return { state: s, events };
}

// ---------------------------------------------------------------------------
// Fragmentos
// ---------------------------------------------------------------------------

function spawnFragments(s: MatchState, map: MapDef, cfg: MatchConfig): void {
  const fc = cfg.fragments;
  if (s.cycle % fc.spawnEveryCycles !== 0) return;
  const active = s.fragments.filter((f) => f.state !== 'delivered').length;
  if (active >= fc.maxActive) return;

  // Ponto de spawn escolhido por stream determinístico da semente.
  const used = new Set(
    s.fragments
      .filter((f) => f.state === 'spawned')
      .map((f) => `${Math.round(f.x / 1000)},${Math.round(f.y / 1000)}`),
  );
  const candidates = map.fragmentSpawns.filter((p) => !used.has(`${p.x},${p.y}`));
  if (candidates.length === 0) return;

  const stream = deriveStream(s.seed, 'frag', s.fragments.length, s.cycle);
  const pick = candidates[nextInt(stream, candidates.length).value]!;
  s.fragments.push({
    id: `frag_${s.fragments.length + 1}`,
    x: toFixed(pick.x),
    y: toFixed(pick.y),
    state: 'spawned',
  });
  s.cycleEvents.push('fragment_spawned');
}

function objectiveTick(s: MatchState, map: MapDef, cfg: MatchConfig): void {
  const fc = cfg.fragments;

  for (const frag of s.fragments) {
    if (frag.state === 'delivered') continue;

    if (frag.state === 'carried') {
      // Entrega: portador tocando o próprio núcleo.
      const carrier = s.units.find((u) => u.id === frag.carrier);
      if (!carrier || !carrier.alive) continue;
      const core = map.cores[carrier.team];
      if (distanceUnits(carrier.x, carrier.y, toFixed(core.x), toFixed(core.y)) <= fc.captureRadius) {
        frag.state = 'delivered';
        frag.carrier = undefined;
        carrier.carryingFragment = false;
        s.score[carrier.team] += 1;
        s.cycleEvents.push(`fragment_delivered:${carrier.team}`);
      }
      continue;
    }

    // spawned/dropped: captura por permanência adjacente sem inimigo no raio.
    const nearby = s.units.filter(
      (u) => u.alive && distanceUnits(u.x, u.y, frag.x, frag.y) <= fc.captureRadius,
    );
    const teams = new Set(nearby.map((u) => u.team));
    if (nearby.length === 0 || teams.size !== 1) {
      frag.capture = undefined; // ninguém, ou disputado — progresso zera
      continue;
    }
    // Candidato: unidade mais próxima sem fragmento (ordem por id em empate).
    const candidate = nearby
      .filter((u) => !u.carryingFragment)
      .sort((a, b) => {
        const da = distanceUnits(a.x, a.y, frag.x, frag.y);
        const db = distanceUnits(b.x, b.y, frag.x, frag.y);
        return da !== db ? da - db : a.id < b.id ? -1 : 1;
      })[0];
    if (!candidate) {
      frag.capture = undefined;
      continue;
    }
    if (frag.capture?.unitId === candidate.id) {
      frag.capture.cycles += 1;
    } else {
      frag.capture = { unitId: candidate.id, cycles: 1 };
    }
    if (frag.capture.cycles >= fc.captureCycles) {
      frag.state = 'carried';
      frag.carrier = candidate.id;
      frag.capture = undefined;
      candidate.carryingFragment = true;
      frag.x = candidate.x;
      frag.y = candidate.y;
      s.cycleEvents.push('fragment_captured');
    }
  }
}

// ---------------------------------------------------------------------------
// Vencedor (cadeia de tiebreak do game design)
// ---------------------------------------------------------------------------

export function decideWinner(s: MatchState): 'cian' | 'magenta' | 'draw' {
  if (s.score.cian !== s.score.magenta) {
    return s.score.cian > s.score.magenta ? 'cian' : 'magenta';
  }
  const by = (fn: (u: Unit) => number, team: 'cian' | 'magenta') =>
    s.units.filter((u) => u.team === team).reduce((acc, u) => acc + fn(u), 0);

  const carried = (team: 'cian' | 'magenta') =>
    s.fragments.filter(
      (f) => f.state === 'carried' && s.units.find((u) => u.id === f.carrier)?.team === team,
    ).length;
  if (carried('cian') !== carried('magenta')) {
    return carried('cian') > carried('magenta') ? 'cian' : 'magenta';
  }

  const integ = (team: 'cian' | 'magenta') => by((u) => (u.alive ? u.integrity : 0), team);
  if (integ('cian') !== integ('magenta')) {
    return integ('cian') > integ('magenta') ? 'cian' : 'magenta';
  }

  const spent = (team: 'cian' | 'magenta') => by((u) => u.energySpent, team);
  if (spent('cian') !== spent('magenta')) {
    return spent('cian') < spent('magenta') ? 'cian' : 'magenta'; // menor consumo vence
  }
  return 'draw';
}

/** Avança um ciclo inteiro (ticksPerCycle ticks) com as mesmas decisões. */
export function stepCycle(
  state: MatchState,
  decisions: DecisionsByUnit,
  map: MapDef,
  cfg: MatchConfig = DEFAULT_CONFIG,
): TickResult {
  let cur = state;
  const events: string[] = [];
  for (let i = 0; i < cfg.ticksPerCycle && !cur.ended; i++) {
    const r = step(cur, i === 0 ? decisions : {}, map, cfg);
    cur = r.state;
    events.push(...r.events);
  }
  return { state: cur, events };
}
