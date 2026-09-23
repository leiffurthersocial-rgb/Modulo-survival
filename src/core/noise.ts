import { rand3 } from './rng';

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 2D value noise in [0,1]. */
export function valueNoise(seed: number, x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = rand3(seed, xi, yi);
  const b = rand3(seed, xi + 1, yi);
  const c = rand3(seed, xi, yi + 1);
  const d = rand3(seed, xi + 1, yi + 1);
  const ab = a + (b - a) * xf;
  const cd = c + (d - c) * xf;
  return ab + (cd - ab) * yf;
}

/** Fractal value noise in [0,1]. */
export function fbm(seed: number, x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(seed + i * 1013, x * freq, y * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
