import { describe, expect, it } from 'vitest';
import { watchTarget } from './watch-url';

describe('named-agent live stream', () => {
  const base = 'wss://example.com/spectate';
  it('selects an agent without changing the server or existing query parameters', () => {
    const result = watchTarget(`${base}?existing=1`, 'kleber & courier');
    expect(result.agent).toBe('kleber & courier');
    const url = new URL(result.url);
    expect(url.origin).toBe('wss://example.com');
    expect(url.searchParams.get('existing')).toBe('1');
    expect(url.searchParams.get('agent')).toBe('kleber & courier');
  });
  it.each([undefined, '', ['a', 'b'], 'x'.repeat(49)])(
    'ignores an invalid selection: %s',
    (candidate) => {
      expect(watchTarget(`${base}?agent=old`, candidate)).toEqual({ agent: undefined, url: base });
    },
  );
});
