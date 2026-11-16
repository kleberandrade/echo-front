import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { replayFromJsonl } from './match.js';

const cli = new URL('../dist/cli.js', import.meta.url);

function run(cycles: string) {
  return spawnSync(process.execPath, [cli.pathname, '--cycles', cycles, '--bots', 'idle,idle'], {
    encoding: 'utf8',
    timeout: 2000,
  });
}

describe('simulator CLI', () => {
  it.each(['NaN', 'Infinity', '-1', '0', '1.5'])(
    'rejects invalid cycle count %s promptly',
    (cycles) => {
      const result = run(cycles);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('--cycles must be a positive safe integer');
      expect(result.stdout).toBe('');
    },
  );

  it('writes a replay containing the requested number of cycles', () => {
    const result = run('2');
    expect(result.status).toBe(0);
    expect(replayFromJsonl(result.stdout).cycles).toHaveLength(2);
  });
});
