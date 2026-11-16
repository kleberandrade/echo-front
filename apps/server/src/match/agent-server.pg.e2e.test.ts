/**
 * E2E do AgentServer com PgMatchStore de verdade (sprint-15) — mesma série
 * ranqueada de agent-server.e2e.test.ts, mas com `configure({ databaseUrl })`
 * em vez de `dataDir`, provando o caminho de produção completo: matchmaking
 * síncrono (cache de Elo) → partida real via WebSocket → recordResult no
 * Postgres → refreshEloCache → standings/replay lidos de volta do banco.
 * Pulado se `TEST_DATABASE_URL` não estiver no ambiente (ver store-pg.test.ts).
 */
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { Pool } from 'pg';
import { describe, expect, it, onTestFinished } from 'vitest';
import { Agent, hunterBot, wandererBot } from '@echo-front/agents-sdk';
import { DEFAULT_CONFIG, replayFromJsonl, resimulate } from '@echo-front/sim';
import type { MatchEndPayload } from '@echo-front/protocol';
import { AgentServer } from './agent-server.js';
import { PgMatchStore } from './store-pg.js';

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const FAST_CFG = { ...DEFAULT_CONFIG, totalCycles: 10 };
const GAMES = 2;

function runBotAgent(
  url: string,
  name: string,
  bot: ReturnType<typeof wandererBot>,
  games: number,
) {
  const ends: MatchEndPayload[] = [];
  const agent = new Agent({ url, agentName: name, onPerception: (unitId, p) => bot(unitId, p, 0) });
  const done = new Promise<MatchEndPayload[]>((resolve) => {
    agent['opts'].onMessage = (msg) => {
      if (msg.type === 'match_end') {
        ends.push(msg.payload);
        if (ends.length === games) resolve(ends);
      }
    };
  });
  void agent.connect();
  return { agent, done };
}

describe.skipIf(!DATABASE_URL)('AgentServer e2e com PgMatchStore (sprint-15)', () => {
  it('série ranqueada persistida no Postgres: matchmaking, recordResult, standings e replay batem', async () => {
    const prefix = randomUUID().slice(0, 8);

    // Create the schema before cleanup: a fresh CI database has no tables yet.
    const bootstrapStore = new PgMatchStore(DATABASE_URL!);
    try {
      await bootstrapStore.listResults();
    } finally {
      await bootstrapStore.close();
    }

    // `AgentServer` numera séries sequencialmente a partir de 1 ("s1",
    // "s2", ...) por instância — como este teste sempre cria uma instância
    // nova, o matchId da primeira série é sempre "s1-g1"/"s1-g2", igual em
    // toda execução. Contra um Postgres de teste persistente (não recriado
    // a cada run), uma linha antiga com esse mesmo matchId faria o
    // `on conflict (match_id) do nothing` do recordResult descartar
    // silenciosamente o resultado novo — sem erro, só ausência dos dados.
    // Limpa essas linhas antes de rodar pra cada execução partir de um
    // estado limpo, independente do que rodou antes nesse banco.
    const cleanupPool = new Pool({ connectionString: DATABASE_URL });
    const deterministicMatchIds = Array.from({ length: GAMES }, (_, i) => `s1-g${i + 1}`);
    try {
      await cleanupPool.query('delete from results where match_id = any($1)', [
        deterministicMatchIds,
      ]);
    } finally {
      await cleanupPool.end();
    }

    const server = new AgentServer();
    server.configure({
      cycleMs: 30,
      cfg: FAST_CFG,
      databaseUrl: DATABASE_URL,
      seriesGames: GAMES,
      interGameMs: 50,
      seedFor: (sid, k) => `pg-e2e-${sid}-${k}`,
    });
    onTestFinished(async () => (server.store as PgMatchStore).close());
    const wss = new WebSocketServer({ port: 0, path: '/agent' });
    wss.on('connection', (ws) => server.attachAgentSocket(ws));
    await new Promise<void>((r) => wss.on('listening', () => r()));
    const addr = wss.address();
    const url = `ws://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/agent`;

    const nameA = `${prefix}-wanderer`;
    const nameB = `${prefix}-hunter`;
    const a = runBotAgent(url, nameA, wandererBot(), GAMES);
    const b = runBotAgent(url, nameB, hunterBot(), GAMES);
    const [endsA, endsB] = await Promise.all([a.done, b.done]);
    a.agent.close();
    b.agent.close();
    wss.close();

    expect(endsA.length).toBe(GAMES);
    expect(endsA.map((e) => e.finalHash)).toEqual(endsB.map((e) => e.finalHash));

    // Aguarda a persistência assíncrona do último resultado (recordResult é
    // fire-and-forget) — poll em vez de um sleep fixo, pra não ficar
    // frágil quando outros arquivos de teste concorrem pelo mesmo Postgres.
    let mine: Awaited<ReturnType<NonNullable<typeof server.store>['listResults']>> = [];
    for (let i = 0; i < 50; i++) {
      const results = await server.store!.listResults();
      mine = results.filter((r) => r.agents.cian === nameA || r.agents.magenta === nameA);
      if (mine.length >= GAMES) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(mine.length).toBe(GAMES);

    for (const r of mine) {
      const replay = replayFromJsonl((await server.store!.readReplay(r.matchId))!);
      expect(replay.finalHash).toBe(r.finalHash);
      expect(() => resimulate(replay)).not.toThrow();
    }

    const standings = await server.store!.standings();
    const rowA = standings.find((s) => s.agent === nameA)!;
    const rowB = standings.find((s) => s.agent === nameB)!;
    expect(rowA.matches).toBe(GAMES);
    expect(rowB.matches).toBe(GAMES);

    // Cache de Elo do matchmaking (síncrono) reflete o resultado gravado no Postgres.
    await server.refreshEloCache();
  }, 30000);
});
