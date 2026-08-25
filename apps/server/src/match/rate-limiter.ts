/**
 * Rate limiting por IP (sprint-11): protege o gateway WS contra flood de
 * conexões — separado do kick por payload inválido (sprint-06/07, que trata
 * de conteúdo malformado numa conexão já aceita).
 *
 * Duas regras independentes por IP:
 * - `maxConnectionsPerMinute`: taxa de NOVAS tentativas de conexão (janela
 *   deslizante de 60 s) — barra flood de reconexões.
 * - `maxConcurrentPerIp`: sockets abertos ao mesmo tempo — barra um único IP
 *   monopolizando o servidor com muitas conexões simultâneas.
 */

export interface RateLimiterOptions {
  maxConnectionsPerMinute: number;
  maxConcurrentPerIp: number;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
}

export class IpRateLimiter {
  private readonly attempts = new Map<string, number[]>();
  private readonly concurrent = new Map<string, number>();
  private readonly windowMs = 60_000;

  constructor(private readonly opts: RateLimiterOptions) {}

  /** Chamado na tentativa de conexão. Se `allowed`, o chamador deve invocar `release(ip)` no close. */
  tryConnect(ip: string, now: number = Date.now()): RateLimitResult {
    const hist = (this.attempts.get(ip) ?? []).filter((t) => now - t < this.windowMs);
    hist.push(now);
    this.attempts.set(ip, hist);
    if (hist.length > this.opts.maxConnectionsPerMinute) {
      return {
        allowed: false,
        reason: `mais de ${this.opts.maxConnectionsPerMinute} conexões/min deste IP — tente novamente em instantes.`,
      };
    }
    const cur = this.concurrent.get(ip) ?? 0;
    if (cur >= this.opts.maxConcurrentPerIp) {
      return {
        allowed: false,
        reason: `mais de ${this.opts.maxConcurrentPerIp} conexões simultâneas deste IP.`,
      };
    }
    this.concurrent.set(ip, cur + 1);
    return { allowed: true };
  }

  /** Chamado no close de uma conexão que passou por `tryConnect` com sucesso. */
  release(ip: string): void {
    const cur = this.concurrent.get(ip) ?? 0;
    if (cur <= 1) this.concurrent.delete(ip);
    else this.concurrent.set(ip, cur - 1);
  }
}

/** IP real por trás de proxy/load balancer (Vercel, etc.): primeiro da cadeia `x-forwarded-for`. */
export function extractIp(
  req: { headers?: Record<string, unknown>; socket?: { remoteAddress?: string } } | undefined,
): string | undefined {
  const fwd = req?.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0];
  return req?.socket?.remoteAddress;
}
