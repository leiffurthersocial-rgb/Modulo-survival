import type { SeasonId } from '@/sim/types';
import { Rng } from '@/core/rng';
import { makeCanvas, PixelPainter, shade } from './pixel';

export interface TreeSprite {
  img: HTMLCanvasElement;
  /** anchor: bottom centre of trunk in sprite pixels */
  ax: number;
  ay: number;
  /** rows at and below this y belong to the trunk (do not sway) */
  split: number;
}

const W = 40;
const H = 56;

function conifer(p: PixelPainter, rng: Rng, season: SeasonId, snow: boolean, pine: boolean): number {
  const cx = W / 2;
  const base = H - 2;
  const trunkH = pine ? 16 : 7;
  const bark = pine ? '#6a3e24' : '#4a3222';
  // trunk
  for (let y = base - trunkH - 6; y <= base; y++) {
    p.px(cx - 1, y, shade(bark, 0.15));
    p.px(cx, y, bark);
    p.px(cx + 1, y, shade(bark, -0.35));
  }
  p.px(cx - 2, base, shade(bark, -0.2));
  p.px(cx + 2, base, shade(bark, -0.4));
  const dark = season === 'winter' ? '#1c3024' : '#1a3622';
  const mid = season === 'winter' ? '#24402c' : '#23482a';
  const light = season === 'winter' ? '#325438' : '#2f5e34';
  const hi = season === 'spring' ? '#4f8a44' : '#3f7040';
  if (!pine) {
    // spruce: stacked jagged tiers
    const top = 4;
    const bottom = base - trunkH;
    for (let y = top; y <= bottom; y++) {
      const f = (y - top) / (bottom - top);
      const tier = ((y - top) % 9) / 9;
      let half = 2 + f * 15 * (0.55 + tier * 0.55);
      half += rng.range(-0.8, 0.8);
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        const rel = (x - cx) / Math.max(1, half);
        let c = mid;
        if (rel < -0.35) c = light;
        if (rel > 0.4) c = dark;
        if (tier > 0.8) c = dark;
        if (rel < -0.55 && tier < 0.5 && rng.chance(0.35)) c = hi;
        if (rng.chance(0.08)) c = shade(c, -0.15);
        p.px(x, y, c);
        if (snow && tier < 0.25 && rng.chance(0.75)) p.px(x, y, rel < 0 ? '#f2f6f8' : '#d8e2ea');
      }
    }
    p.px(cx, top - 1, mid);
    p.px(cx, top - 2, dark);
    return bottom - 2;
  }
  // pine: reddish upper trunk and a rounded, clumpy crown
  for (let y = 14; y < base - trunkH; y++) {
    p.px(cx - 1, y, '#a8603a');
    p.px(cx, y, '#8a4a2a');
    p.px(cx + 1, y, '#6a3620');
  }
  const clumps: [number, number, number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const r = i === 0 ? 0 : rng.range(4, 8);
    clumps.push([cx + Math.cos(a) * r * 1.3, 17 + Math.sin(a) * r * 0.9 - (i === 0 ? 3 : 0), rng.range(5, 7.5), rng.range(4, 5.5)]);
  }
  clumps.sort((a, b) => a[1] - b[1]);
  for (const [ccx, ccy, rx, ry] of clumps) {
    p.ellipse(ccx, ccy, rx, ry, (_x, _y, nx, ny) => {
      const l = -nx * 0.45 - ny * 0.85;
      let c = mid;
      if (l > 0.45) c = light;
      else if (l < -0.35) c = dark;
      if (l > 0.7 && rng.chance(0.45)) c = hi;
      if (rng.chance(0.07)) c = shade(c, -0.18);
      if (snow && ny < -0.45) c = '#eef3f6';
      return c;
    });
  }
  return base - trunkH + 2;
}

const LEAVES: Record<SeasonId, string[][]> = {
  spring: [['#3e6a2c', '#5a8e3a', '#78ae4a', '#a0cc62']],
  summer: [['#2e5424', '#3e6a2c', '#548436', '#6e9c42']],
  autumn: [
    ['#7a3a1a', '#a85a22', '#cc7a2c', '#e8a040'],
    ['#8a6a1e', '#b08e28', '#d0ae3a', '#ecd060'],
    ['#6a2e18', '#94401e', '#b85a26', '#d8803a'],
  ],
  winter: [['#000000', '#000000', '#000000', '#000000']],
};

function deciduous(p: PixelPainter, rng: Rng, type: string, season: SeasonId, snow: boolean): number {
  const cx = W / 2;
  const base = H - 2;
  const birch = type === 'birch';
  const oak = type === 'oak';
  const bark = birch ? '#e8e4d8' : oak ? '#4a3a2a' : '#6a6a62';
  const trunkTop = base - (birch ? 20 : 16);
  const tw = oak ? 3 : 2;
  for (let y = trunkTop; y <= base; y++) {
    for (let k = -tw + 1; k <= tw - 1; k++) {
      let c = k < 0 ? shade(bark, 0.12) : k > 0 ? shade(bark, -0.3) : bark;
      if (birch && rng.chance(0.18)) c = '#2a2a28';
      p.px(cx + k, y, c);
    }
  }
  p.px(cx - tw, base, shade(bark, -0.3));
  p.px(cx + tw, base, shade(bark, -0.45));
  if (season === 'winter') {
    // bare branching crown
    const branch = (x: number, y: number, ang: number, len: number, depth: number) => {
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      p.line(x, y, x2, y2, depth > 1 ? shade(bark, -0.25) : shade(bark, -0.1));
      if (snow && depth > 0) p.px(x2, y2 - 1, '#eef3f6');
      if (depth > 0) {
        branch(x2, y2, ang - rng.range(0.3, 0.7), len * 0.7, depth - 1);
        branch(x2, y2, ang + rng.range(0.3, 0.7), len * 0.7, depth - 1);
      }
    };
    branch(cx, trunkTop + 2, -Math.PI / 2, 10, 3);
    return trunkTop + 4;
  }
  const sets = LEAVES[season];
  const pal = sets[rng.int(0, sets.length - 1)];
  const clumps = oak ? 9 : 7;
  const crownCy = trunkTop - (birch ? 8 : 10);
  const spread = oak ? 13 : birch ? 8 : 11;
  const bl = [] as [number, number, number, number][];
  for (let i = 0; i < clumps; i++) {
    bl.push([cx + rng.range(-spread, spread), crownCy + rng.range(-9, 7), rng.range(5, oak ? 9 : 8), rng.range(4, 7)]);
  }
  // back clumps darker first, front lighter
  bl.sort((a, b) => a[1] - b[1]);
  for (const [bx, by, rx, ry] of bl) {
    p.ellipse(bx, by, rx, ry, (_x, _y, nx, ny) => {
      if (rng.chance(0.05)) return null;
      const l = -nx * 0.5 - ny * 0.8;
      let c = pal[1];
      if (l > 0.55) c = pal[3];
      else if (l > 0.1) c = pal[2];
      else if (l < -0.45) c = pal[0];
      if (rng.chance(0.12)) c = pal[Math.max(0, pal.indexOf(c) - 1)];
      return c;
    });
  }
  // a few branches showing through
  p.line(cx, trunkTop + 2, cx - 5, trunkTop - 4, shade(bark, -0.2));
  p.line(cx, trunkTop + 1, cx + 6, trunkTop - 5, shade(bark, -0.3));
  return trunkTop + 3;
}

const cache = new Map<string, TreeSprite>();

export function treeSprite(type: string, variant: number, season: SeasonId, snow: boolean): TreeSprite {
  const v = variant % 4;
  const key = `${type}:${v}:${season}:${snow ? 1 : 0}`;
  let s = cache.get(key);
  if (s) return s;
  const { c, g } = makeCanvas(W, H);
  const p = new PixelPainter(g);
  const rng = new Rng(type.length * 7919 + v * 104729 + 17);
  let split: number;
  if (type === 'spruce' || type === 'pine') split = conifer(p, rng, season, snow, type === 'pine');
  else split = deciduous(p, rng, type, season, snow);
  // outline pass for readability: darken transparent-adjacent edge pixels
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] === 0) continue;
      const empty = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= W || yy >= H || d[(yy * W + xx) * 4 + 3] === 0;
      if (empty(x + 1, y) || empty(x, y + 1)) {
        out[i] *= 0.62;
        out[i + 1] *= 0.62;
        out[i + 2] *= 0.62;
      }
    }
  g.putImageData(new ImageData(out, W, H), 0, 0);
  s = { img: c, ax: W / 2, ay: H - 2, split };
  cache.set(key, s);
  return s;
}
