// Run inside the packaged server: imports must resolve from its runtime dependencies.
import assert from 'node:assert/strict';
import { replayFromJsonl, resimulate } from '@echo-front/sim';

const origin = 'http://127.0.0.1:3001';
async function get(path) {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200, `HTTP ${path}`);
  return response;
}
const { matches } = await (await get('/api/matches')).json();
assert.ok(matches.length >= Number(process.env.EXPECTED_MATCHES ?? 1));
for (const match of matches) {
  assert.deepEqual(Object.values(match.agents).sort(), ['echo-agent-demo-a', 'echo-agent-demo-b']);
  const jsonl = await (
    await get(`/api/matches/${encodeURIComponent(match.matchId)}/replay`)
  ).text();
  const replay = replayFromJsonl(jsonl);
  assert.equal(replay.header.seed, match.seed);
  assert.equal(replay.finalHash, match.finalHash);
  assert.ok(
    replay.cycles.some(({ d }) => Object.keys(d).length > 0),
    'Agents submitted decisions',
  );
  const state = resimulate(replay);
  const commanded = new Set(replay.cycles.flatMap(({ d }) => Object.keys(d)));
  for (const team of ['cian', 'magenta']) {
    assert.ok(
      state.units.some((unit) => unit.team === team && commanded.has(unit.id)),
      `Recorded decisions from team ${team}`,
    );
  }
  assert.equal(state.ended, true);
  assert.deepEqual(state.score, match.score);
  console.log(`Verified ${match.matchId}: ${replay.cycles.length} cycles, hash ${match.finalHash}`);
}
if (matches.length === 6) {
  const games = [...matches].sort((a, b) => a.game - b.game);
  assert.equal(new Set(games.map((match) => match.seriesId)).size, 1);
  assert.deepEqual(
    games.map((match) => match.game),
    [1, 2, 3, 4, 5, 6],
  );
  for (let index = 0; index < games.length; index += 2) {
    const first = games[index];
    const second = games[index + 1];
    assert.equal(first.seed, second.seed);
    assert.equal(first.agents.cian, second.agents.magenta);
    assert.equal(first.agents.magenta, second.agents.cian);
  }
  console.log('Complete six-game mirrored series verified.');
}
