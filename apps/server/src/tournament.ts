/**
 * Torneio amistoso (sprint-06): round-robin entre os bots de referência,
 * partidas REAIS via WebSocket (séries espelhadas), replays verificados e
 * export estático para o site (apps/web/public/data + /replays).
 *   node dist/tournament.js [--games 6] [--cycleMs 25] [--out ../web/public]
 */
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';
import {
  Agent,
  courierBot,
  ghostBot,
  hunterBot,
  tricksterBot,
  type PerceptionBotFn,
} from '@echo-front/agents-sdk';
import { DEFAULT_CONFIG, replayFromJsonl, resimulate, type GameMode, type MatchConfig } from '@echo-front/sim';
import { AgentServer } from './match/agent-server.js';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const GAMES = Number(arg('games', '6'));
const CYCLE_MS = Number(arg('cycleMs', '25'));
const OUT = arg('out', join(process.cwd(), '..', 'web', 'public'));
const DATA_DIR = arg('data', 'data-tournament');

const ROSTER: Record<string, (team: 'cian' | 'magenta') => PerceptionBotFn> = {
  courier: (t) => courierBot(t),
  trickster: (t) => tricksterBot(t),
  ghost: (t) => ghostBot(t),
  hunter: (t) => hunterBot(t),
};

const MODES = arg('modes', 'data_run,core_siege,silent_hunt').split(',') as GameMode[];

function cfgFor(mode: GameMode): MatchConfig {
  if (mode === 'core_siege') return { ...DEFAULT_CONFIG, mode };
  if (mode === 'silent_hunt')
    return { ...DEFAULT_CONFIG, mode, sensors: { ...DEFAULT_CONFIG.sensors, maxPulsesPerMatch: 2 } };
  return { ...DEFAULT_CONFIG, mode: 'data_run' };
}

const server = new AgentServer();
server.configure({
  cycleMs: CYCLE_MS,
  cfg: DEFAULT_CONFIG,
  dataDir: DATA_DIR,
  seriesGames: GAMES,
  interGameMs: 60,
  seedFor: (sid, k) => `friendly-${sid}-${k}`,
});

const wss = new WebSocketServer({ port: 0, path: '/agent' });
wss.on('connection', (ws) => server.attachAgentSocket(ws));
await new Promise<void>((r) => wss.on('listening', () => r()));
const addr = wss.address();
const url = `ws://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/agent`;

function playSeries(nameA: string, nameB: string): Promise<void> {
  return new Promise((resolve) => {
    let finished = 0;
    for (const name of [nameA, nameB]) {
      let bot = ROSTER[name]!('cian');
      let played = 0;
      const agent = new Agent({
        url,
        agentName: name,
        onPerception: (unitId, p) => bot(unitId, p, p.objective.time_remaining_cycles),
        onMessage: (msg) => {
          if (msg.type === 'welcome') bot = ROSTER[name]!(msg.payload.team);
          if (msg.type === 'match_end') {
            played += 1;
            if (played >= GAMES) {
              agent.close();
              if (++finished === 2) setTimeout(resolve, 150);
            }
          }
        },
      });
      void agent.connect();
    }
  });
}

const names = Object.keys(ROSTER);
const started = performance.now();
for (const mode of MODES) {
  server.configure({ cfg: cfgFor(mode) });
  console.log(`\n████ MODO ${mode.toUpperCase()} ████`);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      console.log(`\n=== série ${names[i]} × ${names[j]} (${GAMES} partidas, ${mode}) ===`);
      await playSeries(names[i]!, names[j]!);
    }
  }
}
wss.close();

// ---------------------------------------------------------------------------
// Verificação: TODO replay do torneio precisa re-simular sem divergência.
// ---------------------------------------------------------------------------
const store = server.store!;
const results = store.listResults();
let divergences = 0;
for (const r of results) {
  const replay = replayFromJsonl(store.readReplay(r.matchId)!);
  try {
    resimulate(replay);
  } catch {
    divergences++;
    console.error(`✗ divergência no replay ${r.matchId}`);
  }
}

const standings = store.standings();
const elapsed = ((performance.now() - started) / 1000).toFixed(1);
console.log(`\n=== TORNEIO AMISTOSO: ${results.length} partidas em ${elapsed}s, divergências: ${divergences} ===`);
for (const [i, s] of standings.entries()) {
  console.log(
    `${i + 1}. ${s.agent.padEnd(12)} ${String(s.points).padStart(6)} pts · ${s.wins}V ${s.draws}E ${s.losses}D · ${s.fragmentsDelivered} frags · ${s.noKillWins} vitórias sem abate`,
  );
}
if (divergences > 0) process.exit(1);

// ---------------------------------------------------------------------------
// Export estático para o site.
// ---------------------------------------------------------------------------
mkdirSync(join(OUT, 'data'), { recursive: true });
mkdirSync(join(OUT, 'replays'), { recursive: true });
writeFileSync(
  join(OUT, 'data', 'standings.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), games: GAMES, standings }, null, 2),
);
writeFileSync(
  join(OUT, 'data', 'matches.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), matches: results }, null, 2),
);
for (const id of store.listReplayIds()) {
  cpSync(join(DATA_DIR, 'replays', `${id}.replay.jsonl`), join(OUT, 'replays', `${id}.replay.jsonl`));
}
console.log(`export: ${OUT}/data/{standings,matches}.json + ${results.length} replays`);
