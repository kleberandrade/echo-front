import { z } from 'zod';

/**
 * ECHO//FRONT — protocolo agente ↔ servidor.
 * Referência humana: docs/04-protocolo-agente.md
 */
export const PROTOCOL_VERSION = '0.3.0';

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

/** Posição em unidades lógicas do mapa. */
export const PositionSchema = z.tuple([z.number(), z.number()]);
export type Position = z.infer<typeof PositionSchema>;

/** Direção em graus: 0 = leste, sentido anti-horário. */
export const DirectionSchema = z.number().min(0).lt(360);

export const UnitClassSchema = z.enum([
  'observer',
  'runner',
  'warden',
  'phantom',
  'disruptor',
  'architect',
]);
export type UnitClass = z.infer<typeof UnitClassSchema>;

export const SignatureLevelSchema = z.enum(['none', 'low', 'medium', 'high']);

export const ActionNameSchema = z.enum([
  'pulse_scan',
  'deploy_decoy',
  'hide',
  'speed_boost',
  'strike',
  'pickup',
  'drop',
]);
export type ActionName = z.infer<typeof ActionNameSchema>;

export const TeamSchema = z.enum(['cian', 'magenta']);
export type Team = z.infer<typeof TeamSchema>;

// ---------------------------------------------------------------------------
// Sensores
// ---------------------------------------------------------------------------

export const VisualReadingSchema = z.object({
  type: z.enum(['unit', 'decoy', 'fragment', 'movement']),
  class_guess: UnitClassSchema.optional(),
  direction: DirectionSchema,
  distance: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
});

export const ThermalReadingSchema = z.object({
  intensity: z.number().min(0).max(1),
  direction: DirectionSchema,
});

export const SoundReadingSchema = z.object({
  intensity: z.number().min(0).max(1),
  direction: DirectionSchema,
});

export const RadarReadingSchema = z.object({
  type: z.enum(['unit', 'decoy', 'fragment', 'pulse_origin']),
  direction: DirectionSchema,
  /** Posição quantizada (células 2×2); ausente em pulse_origin. */
  position: PositionSchema.optional(),
  distance_band: z.enum(['near', 'mid', 'far']).optional(),
});

export const SensorsSchema = z.object({
  visual: z.array(VisualReadingSchema),
  thermal: z.array(ThermalReadingSchema),
  sound: z.array(SoundReadingSchema),
  radar: z.array(RadarReadingSchema),
});
export type Sensors = z.infer<typeof SensorsSchema>;

// ---------------------------------------------------------------------------
// Percepção (servidor → agente, uma por unidade por ciclo)
// ---------------------------------------------------------------------------

export const SelfStateSchema = z.object({
  position: PositionSchema,
  heading: DirectionSchema,
  energy: z.number().min(0),
  integrity: z.number().min(0),
  carrying_fragment: z.boolean(),
  signature: SignatureLevelSchema,
  class: UnitClassSchema,
  cooldowns: z.record(z.string(), z.number().int().nonnegative()),
});

export const AllyStateSchema = z.object({
  unitId: z.string(),
  position: PositionSchema,
  energy: z.number().min(0),
  integrity: z.number().min(0),
  carrying_fragment: z.boolean(),
  /** true quando o dado é defasado (interferência de comunicação). */
  stale: z.boolean().optional(),
});

export const TeamMessageSchema = z.object({
  from: z.string(),
  cycle: z.number().int().nonnegative(),
  data: z.string().max(64),
});

export const KnownFragmentSchema = z.object({
  position: PositionSchema,
  state: z.enum(['spawned', 'carried', 'dropped', 'delivered']),
  confidence: z.number().min(0).max(1),
});

export const ObjectiveSchema = z.object({
  mode: z.enum([
    'data_run',
    'core_siege',
    'signal_control',
    'silent_hunt',
    'energy_crisis',
    'mutation',
    'escort',
  ]),
  score: z.object({ cian: z.number().int(), magenta: z.number().int() }),
  time_remaining_cycles: z.number().int().nonnegative(),
  known_fragments: z.array(KnownFragmentSchema),
});

export const PerceptionPayloadSchema = z.object({
  self: SelfStateSchema,
  sensors: SensorsSchema,
  allies: z.array(AllyStateSchema),
  team_messages: z.array(TeamMessageSchema),
  events: z.array(z.string()),
  objective: ObjectiveSchema,
});
export type PerceptionPayload = z.infer<typeof PerceptionPayloadSchema>;

// ---------------------------------------------------------------------------
// Decisão (agente → servidor)
// ---------------------------------------------------------------------------

export const MovementSchema = z.object({
  direction: DirectionSchema.optional(),
  speed: z.number().min(0).max(1).optional(),
});

export const DecisionPayloadSchema = z.object({
  movement: MovementSchema.optional(),
  action: ActionNameSchema.optional(),
  target: PositionSchema.optional(),
  message_to_team: z.string().max(64).optional(),
  /** Ignorado pela simulação; gravado no replay para o espectador. */
  debug: z.record(z.string(), z.unknown()).optional(),
});
export type DecisionPayload = z.infer<typeof DecisionPayloadSchema>;

// ---------------------------------------------------------------------------
// Handshake e ciclo de vida
// ---------------------------------------------------------------------------

export const HelloPayloadSchema = z.object({
  agentName: z.string().min(1).max(48),
  token: z.string().optional(),
});
export type HelloPayload = z.infer<typeof HelloPayloadSchema>;

export const WelcomePayloadSchema = z.object({
  matchId: z.string(),
  team: TeamSchema,
  unitIds: z.array(z.string()).min(1),
  protocolVersion: z.string(),
  /** Hash da semente; o valor real é publicado após a partida. */
  seedPublic: z.string(),
  map: z.string(),
  /** Presente em partidas ranqueadas: posição desta partida na série. */
  series: z
    .object({ seriesId: z.string(), game: z.number().int().min(1), of: z.number().int().min(1) })
    .optional(),
});
export type WelcomePayload = z.infer<typeof WelcomePayloadSchema>;

export const MatchStartPayloadSchema = z.object({
  cycle: z.literal(0),
  mode: ObjectiveSchema.shape.mode,
});

export const MatchEndPayloadSchema = z.object({
  score: z.object({ cian: z.number().int(), magenta: z.number().int() }),
  winner: TeamSchema.or(z.literal('draw')),
  reason: z.enum(['fragments_delivered', 'time_up', 'forfeit']),
  seed: z.string(),
  finalHash: z.string(),
});
export type MatchEndPayload = z.infer<typeof MatchEndPayloadSchema>;

export const ErrorPayloadSchema = z.object({
  code: z.enum([
    'invalid_payload',
    'unknown_type',
    'version_mismatch',
    'not_in_match',
    'rate_limited',
  ]),
  message: z.string(),
});

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

const base = {
  v: z.string(),
  cycle: z.number().int().nonnegative().optional(),
  unitId: z.string().optional(),
};

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('welcome'), payload: WelcomePayloadSchema }),
  z.object({ ...base, type: z.literal('match_start'), payload: MatchStartPayloadSchema }),
  z.object({ ...base, type: z.literal('perception'), payload: PerceptionPayloadSchema }),
  z.object({ ...base, type: z.literal('match_end'), payload: MatchEndPayloadSchema }),
  z.object({ ...base, type: z.literal('error'), payload: ErrorPayloadSchema }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export const AgentMessageSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('hello'), payload: HelloPayloadSchema }),
  z.object({ ...base, type: z.literal('decision'), payload: DecisionPayloadSchema }),
]);
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

// ---------------------------------------------------------------------------
// Canal de espectador (/spectate) — formalizado na sprint-07.
// O estado é o MatchState do sim serializado; o schema valida o envelope e
// os campos que o front consome, sem acoplar a estrutura interna completa.
// ---------------------------------------------------------------------------

export const SpectateStateSchema = z.object({
  type: z.literal('spectate_state'),
  matchId: z.string(),
  /** MatchState serializado do @echo-front/sim (validação estrutural mínima). */
  state: z
    .object({
      cycle: z.number().int().nonnegative(),
      units: z.array(z.unknown()),
      score: z.object({ cian: z.number().int(), magenta: z.number().int() }),
      ended: z.boolean(),
    })
    .passthrough(),
});

export const SpectateIdleSchema = z.object({
  type: z.literal('spectate_idle'),
  message: z.string(),
});

export const SpectateEndSchema = z.object({
  type: z.literal('spectate_end'),
  matchId: z.string(),
  score: z.object({ cian: z.number().int(), magenta: z.number().int() }),
  winner: TeamSchema.or(z.literal('draw')),
  reason: z.string(),
  seed: z.string(),
  finalHash: z.string(),
});

export const SpectateMessageSchema = z.discriminatedUnion('type', [
  SpectateStateSchema,
  SpectateIdleSchema,
  SpectateEndSchema,
]);
export type SpectateMessage = z.infer<typeof SpectateMessageSchema>;

export function parseSpectateMessage(raw: unknown): SpectateMessage {
  return SpectateMessageSchema.parse(typeof raw === 'string' ? JSON.parse(raw) : raw);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parseAgentMessage(raw: unknown): AgentMessage {
  return AgentMessageSchema.parse(typeof raw === 'string' ? JSON.parse(raw) : raw);
}

export function parseServerMessage(raw: unknown): ServerMessage {
  return ServerMessageSchema.parse(typeof raw === 'string' ? JSON.parse(raw) : raw);
}

/** Compatível quando o major da versão coincide (SemVer). */
export function isCompatibleVersion(v: string): boolean {
  const major = v.split('.')[0];
  return major !== undefined && major === PROTOCOL_VERSION.split('.')[0];
}
