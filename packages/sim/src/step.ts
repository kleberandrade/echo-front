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

export const SIM_VERSION = '0.6.0';

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------

export function createMatch(
  seed: string,
  map: MapDef,
  cfg: MatchConfig = DEFAULT_CONFIG,
): MatchState {
  const units: Unit[] = [];
  for (const team of ['cian', 'magenta'] as const) {
    const counters: Record<string, number> = {};
    cfg.composition[team].forEach((cls, idx) => {
      const spawn = map.unitSpawns[team][idx];
      if (!spawn) throw new Error(`sem spawn ${idx} para ${team} em ${map.id}`);
      counters[cls] = (counters[cls] ?? 0) + 1;
      const stats = cfg.classes[cls];
      units.push({
        id: `${team}_${cls}_${counters[cls]}`,
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
        lastAllies: [],
        pulsesUsed: 0,
      });
    });
  }
  units.sort((a, b) => (a.id < b.id ? -1 : 1));

  // Núcleos: fixos em data_run/silent_hunt; sorteados por semente em core_siege
  // (o "localizar" do modo — o adversário não sabe qual par foi escolhido).
  let site = map.cores !== undefined ? { cian: map.cores.cian, magenta: map.cores.magenta } : map.coreSites[0]!;
  if (cfg.mode === 'core_siege' && map.coreSites.length > 0) {
    const pick = nextInt(deriveStream(seed, 'core_site'), map.coreSites.length).value;
    site = map.coreSites[pick]!;
  }

  return {
    simVersion: SIM_VERSION,
    mode: cfg.mode,
    cycle: 0,
    tick: 0,
    seed,
    rngState: seedRng(seed),
    units,
    fragments: [],
    decoys: [],
    noises: [],
    heatTrails: [],
    messages: [],
    pulses: [],
    cycleEvents: ['match_start'],
    corePositions: {
      cian: { x: toFixed(site.cian.x), y: toFixed(site.cian.y) },
      magenta: { x: toFixed(site.magenta.x), y: toFixed(site.magenta.y) },
    },
    coreIntegrity: { cian: cfg.coreSiege.coreIntegrity, magenta: cfg.coreSiege.coreIntegrity },
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
          const limit = cfg.sensors.maxPulsesPerMatch;
          if (limit > 0 && unit.pulsesUsed >= limit) break; // silent_hunt: acabou a cota
          if ((unit.cooldowns['pulse_scan'] ?? 0) === 0 && unit.energy >= cost) {
            unit.pulsesUsed += 1;
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
            // Alvo: inimigo dentro do alcance do atacante; com `target`, o mais
            // próximo do ponto de mira — sem `target`, o mais próximo de si.
            const aimX = d.target ? toFixed(d.target[0]) : unit.x;
            const aimY = d.target ? toFixed(d.target[1]) : unit.y;
            let best: Unit | undefined;
            let bestDist = Infinity;
            for (const enemy of s.units) {
              if (enemy.team === unit.team || !enemy.alive) continue;
              if (distanceUnits(unit.x, unit.y, enemy.x, enemy.y) > ac.strikeRange) continue;
              const dist = distanceUnits(aimX, aimY, enemy.x, enemy.y);
              if (dist < bestDist) {
                best = enemy;
                bestDist = dist;
              }
            }
            // core_siege: o núcleo inimigo é alvo válido (prioridade pela mira).
            if (s.mode === 'core_siege') {
              const enemyTeam = unit.team === 'cian' ? 'magenta' : 'cian';
              const core = s.corePositions[enemyTeam];
              if (
                s.coreIntegrity[enemyTeam] > 0 &&
                distanceUnits(unit.x, unit.y, core.x, core.y) <= ac.strikeRange &&
                distanceUnits(aimX, aimY, core.x, core.y) < bestDist
              ) {
                spend(unit, ac.strikeCost);
                unit.cooldowns['strike'] = 1;
                unit.hiddenCycles = 0;
                s.coreIntegrity[enemyTeam] = Math.max(
                  0,
                  s.coreIntegrity[enemyTeam] - cfg.coreSiege.strikeDamageToCore,
                );
                s.noises.push({ x: unit.x, y: unit.y, intensity: ac.strikeNoise });
                s.cycleEvents.push(`core_hit:${enemyTeam}`);
                break;
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

    // Aliados: quem está FORA de interferência atualiza seu último quadro.
    for (const unit of s.units) {
      if (!unit.alive || inInterference(map, unit.x, unit.y)) continue;
      unit.lastAllies = s.units
        .filter((u) => u.team === unit.team && u.id !== unit.id && u.alive)
        .map((u) => ({
          unitId: u.id,
          x: u.x,
          y: u.y,
          energy: u.energy,
          integrity: u.integrity,
          carryingFragment: u.carryingFragment,
          cycle: s.cycle,
        }));
    }

    // Rastros de calor: decaem; unidades em movimento deixam calor residual.
    for (const t of s.heatTrails) t.cyclesLeft -= 1;
    s.heatTrails = s.heatTrails.filter((t) => t.cyclesLeft > 0);
    for (const unit of s.units) {
      if (unit.alive && unit.speed > 0 && unit.hiddenCycles === 0) {
        s.heatTrails.push({ x: unit.x, y: unit.y, cyclesLeft: cfg.sensors.heatTrailCycles });
      }
    }
  }

  // 6. Relógio e fim de partida.
  s.tick += 1;
  if (s.tick % cfg.ticksPerCycle === 0) {
    s.cycle += 1;
    if (s.mode === 'core_siege' && (s.coreIntegrity.cian === 0 || s.coreIntegrity.magenta === 0)) {
      s.ended = true;
      s.endReason = 'core_destroyed';
      events.push('match_end:core_destroyed');
      s.cycleEvents.push('match_end:core_destroyed');
    } else if (
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
  if (s.mode === 'core_siege') return; // sem fragmentos no cerco
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
      const core = s.corePositions[carrier.team];
      if (distanceUnits(carrier.x, carrier.y, core.x, core.y) <= fc.captureRadius) {
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
  // core_siege: quem preserva mais o próprio núcleo vence.
  if (s.mode === 'core_siege' && s.coreIntegrity.cian !== s.coreIntegrity.magenta) {
    return s.coreIntegrity.cian > s.coreIntegrity.magenta ? 'cian' : 'magenta';
  }
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
