/**
 * PRNG determinístico e serializável — xoshiro128**.
 * Estado imutável: cada chamada retorna o próximo estado.
 */

export type RngState = [number, number, number, number];

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** Deriva estado inicial do PRNG a partir de uma string (splitmix32 sobre hash FNV-1a). */
export function seedRng(seed: string): RngState {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const out: number[] = [];
  let s = h >>> 0;
  for (let i = 0; i < 4; i++) {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    out.push((z ^ (z >>> 15)) >>> 0);
  }
  return out as unknown as RngState;
}

/**
 * Stream derivado por subsistema (docs/05-simulacao.md): mudar a ordem de
 * consumo de um subsistema não altera o ruído dos demais.
 */
export function deriveStream(seed: string, ...parts: (string | number)[]): RngState {
  return seedRng(`${seed}::${parts.join('::')}`);
}

/** Próximo uint32; retorna também o novo estado (imutável). */
export function nextU32(state: RngState): { value: number; state: RngState } {
  const [s0, s1, s2, s3] = state;
  const result = (Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0) >>> 0;
  const t = (s1 << 9) >>> 0;
  let n2 = (s2 ^ s0) >>> 0;
  let n3 = (s3 ^ s1) >>> 0;
  const n1 = (s1 ^ n2) >>> 0;
  const n0 = (s0 ^ n3) >>> 0;
  n2 = (n2 ^ t) >>> 0;
  n3 = rotl(n3, 11);
  return { value: result, state: [n0, n1, n2, n3] };
}

/** Float determinístico em [0, 1). */
export function nextFloat(state: RngState): { value: number; state: RngState } {
  const { value, state: s } = nextU32(state);
  return { value: value / 0x100000000, state: s };
}

/** Inteiro determinístico em [0, max). */
export function nextInt(state: RngState, max: number): { value: number; state: RngState } {
  const { value, state: s } = nextU32(state);
  return { value: value % max, state: s };
}
