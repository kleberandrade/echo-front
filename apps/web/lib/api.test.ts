import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

it('loads hosted match replays from the configured API', async () => {
  vi.stubEnv('NEXT_PUBLIC_ECHO_API', 'https://echo-front-server.onrender.com');
  const { replayUrl } = await import('./api');
  expect(replayUrl('s2-g1')).toBe(
    'https://echo-front-server.onrender.com/api/matches/s2-g1/replay',
  );
});
it('keeps the bundled demo available when the live API is configured', async () => {
  vi.stubEnv('NEXT_PUBLIC_ECHO_API', 'https://example.com/');
  const { replayUrl } = await import('./api');
  expect(replayUrl('demo')).toBe('/replays/demo.replay.jsonl');
});
it('uses bundled replay files without an API and escapes the match identifier', async () => {
  vi.stubEnv('NEXT_PUBLIC_ECHO_API', '');
  const { replayUrl } = await import('./api');
  expect(replayUrl('round/a?b')).toBe('/replays/round%2Fa%3Fb.replay.jsonl');
});
it('normalizes a trailing API slash and escapes remote match identifiers', async () => {
  vi.stubEnv('NEXT_PUBLIC_ECHO_API', 'https://example.com/');
  const { replayUrl } = await import('./api');
  expect(replayUrl('round/a?b')).toBe('https://example.com/api/matches/round%2Fa%3Fb/replay');
});
