import { Agent, courierBot, hunterBot, type PerceptionBotFn } from '@echo-front/agents-sdk';
import type { PerceptionPayload, ServerMessage, Team, WelcomePayload } from '@echo-front/protocol';

export interface DemoAgentOptions {
  /** Pause between series or failed connection attempts, in milliseconds (1–60,000). */
  restartDelayMs?: number;
}

function validateOptions(url: string, options: DemoAgentOptions): number {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'ws:' && endpoint.protocol !== 'wss:') {
    throw new TypeError('Demo agents require a ws:// or wss:// URL');
  }
  const delay = options.restartDelayMs ?? 2_000;
  if (!Number.isInteger(delay) || delay < 1 || delay > 60_000) {
    throw new RangeError('Demo restartDelayMs must be an integer between 1 and 60000');
  }
  return delay;
}

/** Each seat owns its bot state, including the mirrored side and envelope cycle. */
class DemoSeat {
  readonly agent: Agent;
  private bot: PerceptionBotFn;
  private lastGame = true;
  private cycle = 0;

  constructor(
    url: string,
    agentName: string,
    private readonly makeBot: (team: Team) => PerceptionBotFn,
    private readonly isActive: () => boolean,
    private readonly finish: () => void,
    restart: () => void,
  ) {
    this.bot = makeBot('cian');
    this.agent = new Agent({
      url,
      agentName,
      onWelcome: (welcome) => this.onWelcome(welcome),
      onPerception: (unitId, perception) => this.decide(unitId, perception),
      onMessage: (message) => this.onMessage(message),
      onClose: restart,
    });
  }

  private onWelcome(welcome: WelcomePayload): void {
    if (!this.isActive()) return;
    this.bot = this.makeBot(welcome.team);
    this.lastGame = !welcome.series || welcome.series.game >= welcome.series.of;
  }

  private decide(unitId: string, perception: PerceptionPayload) {
    return this.isActive() ? this.bot(unitId, perception, this.cycle) : undefined;
  }

  private onMessage(message: ServerMessage): void {
    if (!this.isActive()) return;
    if (message.type === 'perception') this.cycle = message.cycle ?? 0;
    if (message.type === 'match_end' && this.lastGame) this.finish();
  }
}

/** Run reference bots through the public agent gateway until the returned stop function is called. */
export function startDemoAgents(url: string, options: DemoAgentOptions = {}): () => void {
  const restartDelayMs = validateOptions(url, options);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closeCurrent: (() => void) | undefined;

  function startPair(): void {
    if (stopped) return;
    let active = true;
    const agents: Agent[] = [];
    const finished = new Set<number>();
    const closePair = () => {
      active = false;
      for (const agent of agents) agent.close();
    };
    closeCurrent = closePair;

    // Both error and close may fire for one failure; only the active pair owns its retry.
    const restart = () => {
      if (!active || stopped) return;
      closePair();
      timer = setTimeout(() => {
        timer = undefined;
        startPair();
      }, restartDelayMs);
    };
    const finish = (index: number) => {
      finished.add(index);
      if (finished.size === 2) restart();
    };
    agents.push(
      new DemoSeat(
        url,
        'demo-hunter',
        hunterBot,
        () => active,
        () => finish(0),
        restart,
      ).agent,
      new DemoSeat(
        url,
        'demo-courier',
        courierBot,
        () => active,
        () => finish(1),
        restart,
      ).agent,
    );
    for (const agent of agents) void agent.connect().catch(restart);
  }

  startPair();
  return () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    closeCurrent?.();
  };
}
