import type { MatchState } from './types.js';

/** FNV-1a 32 bits sobre string. */
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** JSON canônico: chaves de objeto ordenadas, recursivamente. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

/**
 * Hash canônico do estado — dois FNV-1a com salts distintos (64 bits efetivos),
 * idêntico entre Node e browser por construção (só inteiros e strings).
 */
export function stateHash(state: MatchState): string {
  const json = canonicalJson(state);
  const a = fnv1a32(json).toString(16).padStart(8, '0');
  const b = fnv1a32(`echo//${json}`).toString(16).padStart(8, '0');
  return `${a}${b}`;
}
