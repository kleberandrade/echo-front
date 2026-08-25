import { describe, expect, it } from 'vitest';
import {
  AgentMessageSchema,
  DecisionPayloadSchema,
  isCompatibleVersion,
  parseAgentMessage,
  PerceptionPayloadSchema,
  PROTOCOL_VERSION,
  ServerMessageSchema,
  WelcomePayloadSchema,
} from './index.js';

const validPerception = {
  self: {
    position: [42, 18],
    heading: 90,
    energy: 71,
    integrity: 86,
    carrying_fragment: false,
    signature: 'low',
    class: 'runner',
    cooldowns: { pulse_scan: 0, deploy_decoy: 3 },
  },
  sensors: {
    visual: [{ type: 'movement', direction: 83, distance: 21, confidence: 0.5 }],
    thermal: [{ intensity: 0.74, direction: 110 }],
    sound: [{ intensity: 0.41, direction: 270 }],
    radar: [],
    memory: [],
  },
  allies: [],
  team_messages: [{ from: 'cian_observer_1', cycle: 117, data: 'possible_enemy_near_relay_2' }],
  events: ['relay_2_activated', 'communication_interference'],
  objective: {
    mode: 'data_run',
    score: { cian: 1, magenta: 0 },
    time_remaining_cycles: 62,
    known_fragments: [{ position: [55, 20], state: 'spawned', confidence: 1.0 }],
  },
};

describe('PerceptionPayloadSchema', () => {
  it('aceita a percepção de exemplo do doc 04', () => {
    expect(PerceptionPayloadSchema.parse(validPerception)).toBeTruthy();
  });

  it('rejeita direção fora de [0, 360)', () => {
    const bad = structuredClone(validPerception);
    bad.sensors.sound[0]!.direction = 360;
    expect(() => PerceptionPayloadSchema.parse(bad)).toThrow();
  });

  it('rejeita confidence > 1', () => {
    const bad = structuredClone(validPerception);
    bad.sensors.visual[0]!.confidence = 1.2;
    expect(() => PerceptionPayloadSchema.parse(bad)).toThrow();
  });

  it('rejeita classe de unidade desconhecida', () => {
    const bad = structuredClone(validPerception) as Record<string, never> & typeof validPerception;
    (bad.self as { class: string }).class = 'dragon';
    expect(() => PerceptionPayloadSchema.parse(bad)).toThrow();
  });
});

describe('DecisionPayloadSchema', () => {
  it('aceita a decisão de exemplo do doc 04', () => {
    const decision = {
      movement: { direction: 95, speed: 0.7 },
      action: 'deploy_decoy',
      target: [55, 20],
      message_to_team: 'possible_enemy_near_relay_2',
      debug: { confidence_enemy_behind_tower: 0.72 },
    };
    expect(DecisionPayloadSchema.parse(decision)).toBeTruthy();
  });

  it('aceita decisão vazia (no-op explícito)', () => {
    expect(DecisionPayloadSchema.parse({})).toBeTruthy();
  });

  it('rejeita speed > 1', () => {
    expect(() => DecisionPayloadSchema.parse({ movement: { speed: 1.5 } })).toThrow();
  });

  it('rejeita ação desconhecida', () => {
    expect(() => DecisionPayloadSchema.parse({ action: 'teleport' })).toThrow();
  });

  it('rejeita message_to_team acima de 64 bytes', () => {
    expect(() => DecisionPayloadSchema.parse({ message_to_team: 'x'.repeat(65) })).toThrow();
  });
});

describe('Envelopes', () => {
  it('aceita hello válido', () => {
    const msg = parseAgentMessage(
      JSON.stringify({ v: PROTOCOL_VERSION, type: 'hello', payload: { agentName: 'test-bot' } }),
    );
    expect(msg.type).toBe('hello');
  });

  it('aceita decision com cycle e unitId', () => {
    const msg = AgentMessageSchema.parse({
      v: PROTOCOL_VERSION,
      type: 'decision',
      cycle: 12,
      unitId: 'cian_runner_1',
      payload: { movement: { direction: 10, speed: 0.5 } },
    });
    expect(msg.type).toBe('decision');
  });

  it('rejeita type desconhecido no envelope de agente', () => {
    expect(() =>
      AgentMessageSchema.parse({ v: PROTOCOL_VERSION, type: 'perception', payload: {} }),
    ).toThrow();
  });

  it('aceita welcome válido', () => {
    const welcome = {
      v: PROTOCOL_VERSION,
      type: 'welcome',
      payload: {
        matchId: 'm1',
        team: 'cian',
        unitIds: ['cian_observer_1', 'cian_runner_1'],
        protocolVersion: PROTOCOL_VERSION,
        seedPublic: 'ab34cd',
        map: 'arena_alpha@1',
      },
    };
    expect(ServerMessageSchema.parse(welcome).type).toBe('welcome');
  });

  it('rejeita welcome sem unitIds', () => {
    expect(() =>
      WelcomePayloadSchema.parse({
        matchId: 'm1',
        team: 'cian',
        unitIds: [],
        protocolVersion: PROTOCOL_VERSION,
        seedPublic: 'x',
        map: 'arena_alpha@1',
      }),
    ).toThrow();
  });

  it('aceita match_end com vencedor ou empate', () => {
    const end = {
      v: PROTOCOL_VERSION,
      type: 'match_end',
      payload: {
        score: { cian: 3, magenta: 1 },
        winner: 'cian',
        reason: 'fragments_delivered',
        seed: 'seed-123',
        finalHash: 'ab34',
      },
    };
    expect(ServerMessageSchema.parse(end).type).toBe('match_end');
    expect(
      ServerMessageSchema.parse({
        ...end,
        payload: { ...end.payload, winner: 'draw', reason: 'time_up' },
      }).type,
    ).toBe('match_end');
  });
});

describe('isCompatibleVersion', () => {
  it('aceita mesmo major', () => {
    expect(isCompatibleVersion('0.9.9')).toBe(true);
  });
  it('rejeita major diferente', () => {
    expect(isCompatibleVersion('1.0.0')).toBe(false);
  });
});
