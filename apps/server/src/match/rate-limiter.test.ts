import { describe, expect, it } from 'vitest';
import { extractIp, IpRateLimiter } from './rate-limiter.js';

describe('IpRateLimiter', () => {
  it('permite conexões concorrentes até o limite e barra a próxima', () => {
    const rl = new IpRateLimiter({ maxConnectionsPerMinute: 100, maxConcurrentPerIp: 2 });
    expect(rl.tryConnect('1.2.3.4').allowed).toBe(true);
    expect(rl.tryConnect('1.2.3.4').allowed).toBe(true);
    const third = rl.tryConnect('1.2.3.4');
    expect(third.allowed).toBe(false);
    expect(third.reason).toMatch(/simultâneas/);
  });

  it('libera o slot concorrente no release()', () => {
    const rl = new IpRateLimiter({ maxConnectionsPerMinute: 100, maxConcurrentPerIp: 1 });
    expect(rl.tryConnect('9.9.9.9').allowed).toBe(true);
    expect(rl.tryConnect('9.9.9.9').allowed).toBe(false);
    rl.release('9.9.9.9');
    expect(rl.tryConnect('9.9.9.9').allowed).toBe(true);
  });

  it('barra taxa de novas conexões por minuto (janela deslizante)', () => {
    const rl = new IpRateLimiter({ maxConnectionsPerMinute: 3, maxConcurrentPerIp: 100 });
    const base = 1_000_000;
    expect(rl.tryConnect('5.5.5.5', base).allowed).toBe(true);
    expect(rl.tryConnect('5.5.5.5', base + 1).allowed).toBe(true);
    expect(rl.tryConnect('5.5.5.5', base + 2).allowed).toBe(true);
    const fourth = rl.tryConnect('5.5.5.5', base + 3);
    expect(fourth.allowed).toBe(false);
    expect(fourth.reason).toMatch(/min/);
    // fora da janela de 60s: volta a permitir
    expect(rl.tryConnect('5.5.5.5', base + 61_000).allowed).toBe(true);
  });

  it('IPs diferentes têm contadores independentes', () => {
    const rl = new IpRateLimiter({ maxConnectionsPerMinute: 100, maxConcurrentPerIp: 1 });
    expect(rl.tryConnect('1.1.1.1').allowed).toBe(true);
    expect(rl.tryConnect('2.2.2.2').allowed).toBe(true);
  });
});

describe('extractIp', () => {
  it('prioriza x-forwarded-for (proxy/load balancer)', () => {
    expect(extractIp({ headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' } })).toBe(
      '203.0.113.5',
    );
  });

  it('usa o socket remoto quando não há proxy', () => {
    expect(extractIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1');
  });

  it('não quebra com request undefined', () => {
    expect(extractIp(undefined)).toBeUndefined();
  });
});
