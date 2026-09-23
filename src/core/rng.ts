/**
 * Deterministic seeded randomness. All procedural systems derive their
 * randomness from the world seed so a world stays identical after loading.
 */

export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stateless integer hash of up to three integers plus a seed. */
export function hash3(seed: number, x: number, y: number, z = 0): number {
  let h = seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Stateless float in [0,1). */
export function rand3(seed: number, x: number, y: number, z = 0): number {
  return hash3(seed, x, y, z) / 4294967296;
}

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  /** Current internal state; can be stored to resume a sequence. */
  get state(): number {
    return this.s;
  }
  set state(v: number) {
    this.s = v >>> 0;
  }
  next(): number {
    // mulberry32
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, w] of entries) total += w;
    let r = this.next() * total;
    for (const [v, w] of entries) {
      r -= w;
      if (r <= 0) return v;
    }
    return entries[entries.length - 1][0];
  }
  /** Approximately normal distribution via summed uniforms. */
  gauss(mean = 0, sd = 1): number {
    const u = this.next() + this.next() + this.next() + this.next() - 2;
    return mean + u * sd * 0.866;
  }
}
