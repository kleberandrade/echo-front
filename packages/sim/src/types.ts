import type { DecisionPayload, Team, UnitClass } from '@echo-front/protocol';
import type { Fixed } from './fixed.js';
import type { RngState } from './rng.js';

export interface ClassStats {
  /** Velocidade máxima em fixed-units por tick (ex.: 400 = 0,4 unidade/tick = 4 u/s). */
  maxSpeedPerTick: Fixed;
  maxEnergy: number;
  maxIntegrity: number;
  /** Abertura do cone de visão em graus. */
  visionFov: number;
  /** Alcance da visão em unidades lógicas. */
  visionRange: number;
  /** Intensidade sonora base ao mover na velocidade máxima (0–1). */
  soundBase: number;
}

export interface SensorConfig {
  soundRange: number;
  /** Multiplicador de intensidade por obstáculo atravessado (0.6 = atenua 40%). */
  soundObstacleFactor: number;
  /** Jitter máximo de direção do som, em graus (±). */
  soundJitterDeg: number;
  /** Leituras abaixo desta intensidade são descartadas. */
  soundMinIntensity: number;
  radarRadius: number;
  radarCost: number;
  radarCostObserver: number;
  radarCooldownCycles: number;
  thermalRange: number;
  thermalMinIntensity: number;
  /** Multiplicador por obstáculo atravessado (térmico atravessa parcialmente). */
  thermalObstacleFactor: number;
  /** Ciclos que um rastro de calor persiste onde a unidade passou. */
  heatTrailCycles: number;
  /** silent_hunt: máximo de pulse_scan por unidade na partida (0 = ilimitado). */
  maxPulsesPerMatch: number;
}

export interface ActionsConfig {
  decoyCost: number;
  decoyLifeCycles: number;
  /** Intensidade sonora emitida pelo decoy (0–1). */
  decoySound: number;
  hideCost: number;
  hideCycles: number;
  boostCostPerCycle: number;
  /** Multiplicador de velocidade do boost, fixed ×1000 (1600 = ×1,6). */
  boostFactor: number;
  boostNoise: number;
  strikeCost: number;
  strikeDamage: number;
  strikeRange: number;
  strikeNoise: number;
}

export interface CoreSiegeConfig {
  /** Integridade do núcleo. */
  coreIntegrity: number;
  /** Dano do strike contra o núcleo. */
  strikeDamageToCore: number;
  /** Distância máxima em que o núcleo inimigo aparece na visão. */
  coreVisionRange: number;
}

export interface FragmentsConfig {
  deliveriesToWin: number;
  /** Ciclos consecutivos adjacente ao fragmento para capturar. */
  captureCycles: number;
  /** Raio (unidades) de captura/entrega — e de bloqueio por inimigo. */
  captureRadius: number;
  /** Fator de velocidade do portador, fixed ×1000 (800 = −20%). */
  carrySpeedFactor: number;
  /** Multiplicador de assinatura sonora do portador. */
  carrySoundFactor: number;
  /** Máximo de fragmentos ativos simultâneos. */
  maxActive: number;
  /** Intervalo de ciclos entre tentativas de spawn. */
  spawnEveryCycles: number;
}

export type GameMode = 'data_run' | 'core_siege' | 'silent_hunt';

export interface MatchConfig {
  ticksPerCycle: number;
  totalCycles: number;
  map: string;
  /** Modo de disputa (docs/02-game-design.md). */
  mode: GameMode;
  energyRegenPerCycle: number;
  towerBonusPerCycle: number;
  fastMoveCostPerCycle: number;
  fastThreshold: number;
  exhaustedSpeedCap: number;
  unitRadius: Fixed;
  sensors: SensorConfig;
  actions: ActionsConfig;
  coreSiege: CoreSiegeConfig;
  fragments: FragmentsConfig;
  classes: Record<UnitClass, ClassStats>;
  /** Composição de cada time, em ordem de spawn (máx. = spawns do mapa). */
  composition: Record<Team, UnitClass[]>;
}

export const DEFAULT_CONFIG: MatchConfig = {
  ticksPerCycle: 5,
  totalCycles: 180,
  map: 'arena_alpha@1',
  mode: 'data_run',
  energyRegenPerCycle: 2,
  towerBonusPerCycle: 4,
  fastMoveCostPerCycle: 1,
  fastThreshold: 700,
  exhaustedSpeedCap: 500,
  unitRadius: 600,
  sensors: {
    soundRange: 30,
    soundObstacleFactor: 0.6,
    soundJitterDeg: 25,
    soundMinIntensity: 0.05,
    radarRadius: 18,
    radarCost: 25,
    radarCostObserver: 15,
    radarCooldownCycles: 5,
    thermalRange: 20,
    thermalMinIntensity: 0.05,
    thermalObstacleFactor: 0.5,
    heatTrailCycles: 3,
    maxPulsesPerMatch: 0,
  },
  actions: {
    decoyCost: 20,
    decoyLifeCycles: 10,
    decoySound: 0.5,
    hideCost: 10,
    hideCycles: 3,
    boostCostPerCycle: 3,
    boostFactor: 1600,
    boostNoise: 0.6,
    strikeCost: 15,
    strikeDamage: 20,
    strikeRange: 3,
    strikeNoise: 0.9,
  },
  coreSiege: {
    coreIntegrity: 100,
    strikeDamageToCore: 20,
    coreVisionRange: 10,
  },
  composition: {
    cian: ['observer', 'runner'],
    magenta: ['observer', 'runner'],
  },
  fragments: {
    deliveriesToWin: 3,
    captureCycles: 2,
    captureRadius: 2,
    carrySpeedFactor: 800,
    carrySoundFactor: 1500,
    maxActive: 2,
    spawnEveryCycles: 15,
  },
  classes: {
    observer: { maxSpeedPerTick: 400, maxEnergy: 120, maxIntegrity: 60, visionFov: 120, visionRange: 18, soundBase: 0.5 },
    runner: { maxSpeedPerTick: 700, maxEnergy: 100, maxIntegrity: 80, visionFov: 90, visionRange: 14, soundBase: 0.55 },
    warden: { maxSpeedPerTick: 300, maxEnergy: 100, maxIntegrity: 140, visionFov: 90, visionRange: 14, soundBase: 0.5 },
    phantom: { maxSpeedPerTick: 550, maxEnergy: 110, maxIntegrity: 60, visionFov: 90, visionRange: 14, soundBase: 0.35 },
    disruptor: { maxSpeedPerTick: 450, maxEnergy: 110, maxIntegrity: 90, visionFov: 90, visionRange: 14, soundBase: 0.5 },
    architect: { maxSpeedPerTick: 300, maxEnergy: 130, maxIntegrity: 100, visionFov: 90, visionRange: 14, soundBase: 0.5 },
  },
};

export interface Unit {
  id: string;
  team: Team;
  class: UnitClass;
  x: Fixed;
  y: Fixed;
  heading: number; // graus inteiros [0, 360)
  /** Velocidade comandada, 0–1000 (fração fixed da velocidade máxima da classe). */
  speed: number;
  energy: number;
  integrity: number;
  alive: boolean;
  carryingFragment: boolean;
  /** Cooldowns por ação, em ciclos restantes. */
  cooldowns: Record<string, number>;
  /** Ciclos restantes de camuflagem (`hide`); 0 = visível. */
  hiddenCycles: number;
  /** `speed_boost` ativo neste ciclo. */
  boosting: boolean;
  /** Energia total consumida em ações/movimento (tiebreak de eficiência). */
  energySpent: number;
  /** Último quadro de aliados conhecido (atualizado fora de interferência). */
  lastAllies: AllySnapshot[];
  /** silent_hunt: pulsos já disparados nesta partida. */
  pulsesUsed: number;
}

/** Mensagem de time em trânsito (enviada no ciclo `cycle`, entregue no seguinte). */
export interface QueuedMessage {
  from: string;
  team: Team;
  data: string;
  cycle: number;
}

/** Pulso de radar ativo no ciclo corrente. */
export interface RadarPulse {
  unitId: string;
  team: Team;
  x: Fixed;
  y: Fixed;
}

export type FragmentState = 'spawned' | 'carried' | 'dropped' | 'delivered';

export interface Fragment {
  id: string;
  x: Fixed;
  y: Fixed;
  state: FragmentState;
  carrier?: string;
  /** Progresso de captura em andamento. */
  capture?: { unitId: string; cycles: number };
}

export interface Decoy {
  id: string;
  team: Team;
  x: Fixed;
  y: Fixed;
  /** Ciclos de vida restantes. */
  lifeCycles: number;
}

/** Ruído transiente do ciclo (strike, boost) — fonte pontual para o sensor de som. */
export interface Noise {
  x: Fixed;
  y: Fixed;
  intensity: number;
}

/** Último snapshot de aliados visto por uma unidade FORA de interferência. */
export interface AllySnapshot {
  unitId: string;
  x: Fixed;
  y: Fixed;
  energy: number;
  integrity: number;
  carryingFragment: boolean;
  /** Ciclo em que o snapshot foi tirado. */
  cycle: number;
}

/** Rastro de calor residual deixado por unidades em movimento. */
export interface HeatTrail {
  x: Fixed;
  y: Fixed;
  cyclesLeft: number;
}

export interface MatchState {
  simVersion: string;
  mode: GameMode;
  cycle: number;
  tick: number; // tick global desde o início
  seed: string;
  rngState: RngState;
  units: Unit[]; // sempre ordenadas por id
  fragments: Fragment[];
  decoys: Decoy[];
  noises: Noise[];
  heatTrails: HeatTrail[];
  messages: QueuedMessage[];
  pulses: RadarPulse[];
  /** Eventos globais do ciclo corrente (limpos no início de cada ciclo). */
  cycleEvents: string[];
  /** Posições dos núcleos (em core_siege, sorteadas por semente). */
  corePositions: { cian: { x: Fixed; y: Fixed }; magenta: { x: Fixed; y: Fixed } };
  /** Integridade dos núcleos (usada em core_siege; cheia nos demais modos). */
  coreIntegrity: { cian: number; magenta: number };
  score: { cian: number; magenta: number };
  ended: boolean;
  endReason?: 'time_up' | 'fragments_delivered' | 'core_destroyed';
}

/** Decisões do ciclo, por unitId. */
export type DecisionsByUnit = Record<string, DecisionPayload>;

export interface TickResult {
  state: MatchState;
  events: string[];
}
