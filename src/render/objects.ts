import { objectDef } from '@/content/objects';
import type { SeasonId, WorldObject } from '@/sim/types';
import { Rng } from '@/core/rng';
import { makeCanvas, PixelPainter, shade } from './pixel';

export interface ObjSprite {
  img: HTMLCanvasElement;
  /** offset from the footprint's top-left tile corner, in pixels */
  ox: number;
  oy: number;
}

const PAD = 8;
const EXTRA_TOP = 28;

const WOOD = '#7a5634';
const WOOD_D = '#56391f';
const WOOD_L = '#9a7448';
const STONE = '#8a8a82';
const STONE_D = '#5e5e58';
const STONE_L = '#aaa9a0';

type Drawer = (p: PixelPainter, fx: number, fy: number, w: number, h: number, rng: Rng, o: WorldObject, season: SeasonId, snow: boolean) => void;

function shadow(p: PixelPainter, cx: number, cy: number, rx: number, ry: number): void {
  p.ellipse(cx, cy, rx, ry, 'rgba(0,0,0,0.28)');
}

function leafy(p: PixelPainter, cx: number, cy: number, rx: number, ry: number, pal: string[], rng: Rng): void {
  p.ellipse(cx, cy, rx, ry, (_x, _y, nx, ny) => {
    if (rng.chance(0.08)) return null;
    const l = -nx * 0.4 - ny * 0.9;
    return l > 0.45 ? pal[3] : l > 0 ? pal[2] : l < -0.5 ? pal[0] : pal[1];
  });
}

const SHRUB: Record<SeasonId, string[]> = {
  spring: ['#2e4e22', '#44702e', '#5e8e3a', '#82b04e'],
  summer: ['#264620', '#3a6428', '#507e34', '#6a9a40'],
  autumn: ['#5a3a1a', '#8a5a22', '#b07a2c', '#d0a040'],
  winter: ['#3a3628', '#4a4432', '#5a543e', '#6a644a'],
};

function rock(p: PixelPainter, cx: number, cy: number, rx: number, ry: number, rng: Rng, moss: boolean): void {
  p.ellipse(cx, cy, rx, ry, (_x, _y, nx, ny) => {
    const l = -nx * 0.5 - ny * 0.8;
    let c = l > 0.4 ? STONE_L : l < -0.3 ? STONE_D : STONE;
    if (moss && ny < -0.2 && rng.chance(0.5)) c = '#5a7a3a';
    if (rng.chance(0.1)) c = shade(c, -0.1);
    return c;
  });
}

function sticks(p: PixelPainter, fx: number, fy: number, rng: Rng, n: number): void {
  for (let i = 0; i < n; i++) {
    const x0 = fx + rng.int(1, 8);
    const y0 = fy + rng.int(8, 14);
    const len = rng.int(5, 9);
    const dy = rng.int(-3, 3);
    p.line(x0, y0, x0 + len, y0 + dy, i % 2 ? WOOD_D : '#6a4a2c');
    p.px(x0 + 1, y0 - 1, WOOD_L);
  }
}

function box(p: PixelPainter, x: number, y: number, w: number, h: number, top: number, col: string, front = true): void {
  // 3/4 view box: top face then front face
  p.rect(x, y, w, top, shade(col, 0.18));
  p.rect(x, y + top, w, h - top, col);
  p.hline(x, x + w - 1, y + top, shade(col, -0.35));
  p.rect(x, y + h - 1, w, 1, shade(col, -0.5));
  p.vline(x, y, y + h - 1, shade(col, -0.4));
  p.vline(x + w - 1, y, y + h - 1, shade(col, -0.5));
  if (front) p.hline(x + 1, x + w - 2, y + top + Math.floor((h - top) / 2), shade(col, -0.2));
}

const DRAW: Record<string, Drawer> = {
  stump: (p, fx, fy, _w, _h, rng) => {
    shadow(p, fx + 8, fy + 13, 6, 2);
    p.rect(fx + 4, fy + 7, 8, 6, '#5a3e24');
    p.ellipse(fx + 8, fy + 7, 4, 2, '#b08a5a');
    p.px(fx + 8, fy + 7, '#8a6a42');
    p.px(fx + 5 + rng.int(0, 5), fy + 12, '#3e2a18');
  },
  burnt_tree: (p, fx, fy) => {
    shadow(p, fx + 8, fy + 14, 5, 2);
    p.rect(fx + 6, fy - 12, 4, 26, '#1e1a18');
    p.line(fx + 7, fy - 6, fx + 2, fy - 12, '#26211e');
    p.line(fx + 8, fy - 2, fx + 13, fy - 9, '#26211e');
    p.px(fx + 7, fy + 2, '#3a3430');
  },
  sapling: (p, fx, fy, _w, _h, rng, _o, season) => {
    p.vline(fx + 8, fy + 4, fy + 14, '#5a3e24');
    if (season !== 'winter') leafy(p, fx + 8, fy + 4, 4, 4, SHRUB[season], rng);
  },
  fallen_log: (p, fx, fy, _w, _h, rng) => {
    shadow(p, fx + 16, fy + 13, 15, 3);
    p.rect(fx + 2, fy + 6, 28, 7, '#5a3e24');
    p.hline(fx + 2, fx + 29, fy + 6, '#7a5634');
    p.hline(fx + 2, fx + 29, fy + 12, '#3e2a18');
    p.ellipse(fx + 30, fy + 9, 2, 3.5, '#a07a4a');
    for (let i = 0; i < 6; i++) p.px(fx + 4 + rng.int(0, 22), fy + 7 + rng.int(0, 4), '#4a6a2e');
  },
  deadfall: (p, fx, fy, _w, _h, rng) => sticks(p, fx + 3, fy - 3, rng, 5),
  rocks: (p, fx, fy, _w, _h, rng) => {
    rock(p, fx + 6, fy + 11, 3, 2, rng, false);
    rock(p, fx + 11, fy + 12, 2.5, 1.8, rng, false);
    rock(p, fx + 8, fy + 8, 2, 1.5, rng, false);
  },
  boulder: (p, fx, fy, _w, _h, rng, _o, _s, snow) => {
    shadow(p, fx + 8, fy + 14, 8, 3);
    rock(p, fx + 8, fy + 8, 8, 7, rng, true);
    if (snow) p.ellipse(fx + 7, fy + 3, 5, 2, '#eef3f6');
  },
  bush: (p, fx, fy, _w, _h, rng, _o, season) => {
    shadow(p, fx + 8, fy + 14, 7, 2);
    leafy(p, fx + 8, fy + 8, 7, 6, SHRUB[season], rng);
  },
  hazel: (p, fx, fy, _w, _h, rng, o, season) => {
    shadow(p, fx + 8, fy + 15, 8, 2);
    for (let i = 0; i < 4; i++) p.line(fx + 8, fy + 14, fx + 3 + i * 3, fy + 2, '#6a5a3a');
    if (season !== 'winter') leafy(p, fx + 8, fy + 3, 8, 8, SHRUB[season], rng);
    if (o.s && season === 'autumn') for (let i = 0; i < 5; i++) p.px(fx + 3 + rng.int(0, 10), fy + rng.int(0, 8), '#a07030');
  },
  fern: (p, fx, fy, _w, _h, rng, _o, season) => {
    const pal = season === 'autumn' ? ['#8a5a22', '#b07a2c'] : season === 'winter' ? ['#5a4a32', '#6a5a3a'] : ['#3e6a2a', '#5e9a3a'];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.45;
      const len = rng.range(5, 8);
      for (let k = 0; k < len; k++) {
        const x = fx + 8 + Math.cos(a) * k;
        const y = fy + 13 + Math.sin(a) * k + k * k * 0.06;
        p.px(x, y, pal[k % 2]);
        if (k > 1 && k % 2 === 0) p.px(x + 1, y, pal[0]);
      }
    }
  },
  bilberry: (p, fx, fy, _w, _h, rng, o, season) => {
    leafy(p, fx + 8, fy + 11, 6, 4, season === 'autumn' ? ['#6a2a1a', '#8a3a22', '#a84a2a', '#c86a3a'] : SHRUB[season], rng);
    if (o.s) for (let i = 0; i < 6; i++) p.px(fx + 4 + rng.int(0, 8), fy + 9 + rng.int(0, 4), '#2a3a7a');
  },
  bramble: (p, fx, fy, _w, _h, rng, o, season) => {
    leafy(p, fx + 8, fy + 10, 7, 5, season === 'winter' ? ['#3a2a28', '#4a3430', '#5a4038', '#6a4a40'] : ['#2a4a22', '#3a5a2a', '#4a6e32', '#5a7e3a'], rng);
    for (let i = 0; i < 5; i++) p.px(fx + 2 + rng.int(0, 12), fy + 6 + rng.int(0, 8), '#6a2a3a');
    if (o.s) for (let i = 0; i < 6; i++) p.px(fx + 3 + rng.int(0, 10), fy + 7 + rng.int(0, 6), '#1a1022');
  },
  nettles: (p, fx, fy, _w, _h, rng, _o, season) => {
    const c = season === 'winter' ? '#5a5238' : '#3e6a2a';
    for (let i = 0; i < 5; i++) {
      const x = fx + 3 + i * 2 + rng.int(0, 1);
      const hgt = rng.int(6, 10);
      p.vline(x, fy + 15 - hgt, fy + 14, c);
      p.px(x - 1, fy + 15 - hgt + 2, shade(c, 0.2));
      p.px(x + 1, fy + 15 - hgt + 4, shade(c, 0.2));
    }
  },
  tall_grass: (p, fx, fy, _w, _h, rng, _o, season) => {
    const pal = season === 'autumn' ? ['#9a8a46', '#b0a050'] : season === 'winter' ? ['#8a8466', '#9a9474'] : ['#5a8a34', '#78a848'];
    for (let i = 0; i < 8; i++) {
      const x = fx + 2 + rng.int(0, 12);
      const hgt = rng.int(5, 10);
      const lean = rng.int(-1, 1);
      for (let k = 0; k < hgt; k++) p.px(x + Math.round((k / hgt) * lean), fy + 14 - k, pal[k > hgt / 2 ? 1 : 0]);
    }
  },
  reeds: (p, fx, fy, _w, _h, rng, _o, season) => {
    const pal = season === 'winter' ? ['#8a7a58', '#a09068'] : ['#5a7a3a', '#7a9a4a'];
    for (let i = 0; i < 6; i++) {
      const x = fx + 2 + rng.int(0, 12);
      const hgt = rng.int(9, 15);
      p.vline(x, fy + 15 - hgt, fy + 14, pal[i % 2]);
      if (i % 2 === 0) p.rect(x, fy + 15 - hgt, 1, 3, '#6a4a2a');
    }
  },
  wild_garlic: (p, fx, fy, _w, _h, rng, o) => {
    for (let i = 0; i < 6; i++) {
      const x = fx + 3 + rng.int(0, 10);
      const y = fy + 8 + rng.int(0, 5);
      p.line(x, y + 4, x + rng.int(-2, 2), y, '#4a8a3a');
      p.px(x, y + 1, '#6aaa4a');
    }
    if (o.s) for (let i = 0; i < 4; i++) p.px(fx + 4 + rng.int(0, 8), fy + 7 + rng.int(0, 4), '#f4f4ee');
  },
  mushrooms: (p, fx, fy, _w, _h, rng, o) => {
    if (!o.s) {
      p.px(fx + 6, fy + 12, '#6a5a40');
      return;
    }
    for (let i = 0; i < 3; i++) {
      const x = fx + 4 + rng.int(0, 8);
      const y = fy + 9 + rng.int(0, 4);
      p.vline(x, y, y + 2, '#e8dcc0');
      p.hline(x - 1, x + 1, y - 1, '#d8962a');
      p.px(x, y - 2, '#e8aa3a');
    }
  },
  flowers: (p, fx, fy, _w, _h, rng, _o, season) => {
    if (season === 'winter') return;
    const cols = season === 'autumn' ? ['#c85a2a', '#d8a030'] : ['#e8d86a', '#f0f0f0', '#c86a9a', '#8a8ae0'];
    for (let i = 0; i < 5; i++) {
      const x = fx + 2 + rng.int(0, 12);
      const y = fy + 5 + rng.int(0, 8);
      p.vline(x, y + 1, y + 3, '#4a7a2e');
      p.px(x, y, cols[i % cols.length]);
    }
  },
  cupboard: (p, fx, fy) => {
    box(p, fx + 1, fy - 6, 14, 20, 4, '#8a6a44');
    p.vline(fx + 8, fy - 2, fy + 12, '#56391f');
    p.px(fx + 6, fy + 4, '#d0b070');
    p.px(fx + 10, fy + 4, '#d0b070');
  },
  wardrobe: (p, fx, fy) => {
    box(p, fx + 1, fy - 10, 14, 24, 4, '#6a4a30');
    p.vline(fx + 8, fy - 6, fy + 12, '#3e2a1a');
    p.px(fx + 7, fy + 2, '#c0a060');
    p.px(fx + 9, fy + 2, '#c0a060');
  },
  shelf: (p, fx, fy, _w, _h, rng) => {
    box(p, fx + 1, fy - 8, 14, 22, 3, '#7a5a3a', false);
    for (let k = 0; k < 3; k++) {
      p.hline(fx + 2, fx + 13, fy - 1 + k * 6, '#4a3220');
      for (let i = 0; i < 3; i++) p.rect(fx + 3 + rng.int(0, 8), fy - 4 + k * 6, 2, 3, ['#8a4a3a', '#4a6a8a', '#aaa070'][i]);
    }
  },
  toolbox: (p, fx, fy) => {
    box(p, fx + 3, fy + 5, 11, 8, 3, '#a8302a');
    p.hline(fx + 6, fx + 10, fy + 3, '#3a3a3a');
    p.px(fx + 6, fy + 4, '#3a3a3a');
    p.px(fx + 10, fy + 4, '#3a3a3a');
  },
  fridge: (p, fx, fy) => {
    box(p, fx + 2, fy - 8, 12, 22, 3, '#d8d8d0');
    p.hline(fx + 3, fx + 12, fy + 1, '#9a9a94');
    p.vline(fx + 11, fy - 3, fy - 1, '#6a6a66');
  },
  crate: (p, fx, fy) => {
    box(p, fx + 2, fy + 2, 12, 12, 4, '#9a7448');
    p.line(fx + 3, fy + 7, fx + 12, fy + 12, '#6a4a2c');
  },
  car_wreck: (p, fx, fy, _w, _h, rng) => {
    shadow(p, fx + 16, fy + 14, 15, 3);
    const col = rng.pick(['#6a7a8a', '#8a3a2a', '#3a4a3a', '#9a9a8e']);
    p.rect(fx + 1, fy + 3, 30, 10, col);
    p.rect(fx + 7, fy - 3, 16, 7, shade(col, -0.15));
    p.rect(fx + 9, fy - 2, 5, 4, '#2a3a4a');
    p.rect(fx + 16, fy - 2, 5, 4, '#2a3a4a');
    p.hline(fx + 1, fx + 30, fy + 3, shade(col, 0.2));
    p.rect(fx + 4, fy + 11, 5, 4, '#1a1a1a');
    p.rect(fx + 23, fy + 11, 5, 4, '#1a1a1a');
    for (let i = 0; i < 10; i++) p.px(fx + 2 + rng.int(0, 27), fy + 4 + rng.int(0, 8), '#7a4a2a');
  },
  bed: (p, fx, fy) => {
    p.rect(fx + 1, fy - 2, 14, 16, '#6a4a30');
    p.rect(fx + 2, fy - 1, 12, 5, '#d8d4c8');
    p.rect(fx + 2, fy + 4, 12, 9, '#5a6a8a');
    p.hline(fx + 2, fx + 13, fy + 4, '#4a5a78');
  },
  table: (p, fx, fy) => {
    p.rect(fx + 1, fy + 2, 14, 7, '#8a6a44');
    p.hline(fx + 1, fx + 14, fy + 2, '#a8845a');
    p.rect(fx + 2, fy + 9, 2, 5, '#56391f');
    p.rect(fx + 12, fy + 9, 2, 5, '#56391f');
  },
  stove: (p, fx, fy) => {
    box(p, fx + 2, fy, 12, 14, 3, '#2e2e30');
    p.rect(fx + 5, fy + 6, 6, 4, '#1a1a1a');
    p.rect(fx + 7, fy - 12, 3, 12, '#3a3a3c');
  },
  bench: (p, fx, fy) => {
    p.rect(fx + 1, fy + 6, 14, 3, WOOD);
    p.hline(fx + 1, fx + 14, fy + 6, WOOD_L);
    p.rect(fx + 2, fy + 9, 2, 4, WOOD_D);
    p.rect(fx + 12, fy + 9, 2, 4, WOOD_D);
  },
  log_seat: (p, fx, fy) => {
    shadow(p, fx + 8, fy + 13, 7, 2);
    p.rect(fx + 1, fy + 7, 14, 6, '#5a3e24');
    p.hline(fx + 1, fx + 14, fy + 7, '#8a6440');
    p.ellipse(fx + 14, fy + 10, 1.5, 3, '#b08a5a');
  },
  fence: (p, fx, fy) => {
    p.rect(fx + 2, fy + 2, 2, 12, WOOD_D);
    p.rect(fx + 12, fy + 2, 2, 12, WOOD_D);
    p.rect(fx, fy + 4, 16, 2, WOOD);
    p.rect(fx, fy + 9, 16, 2, WOOD);
  },
  sign: (p, fx, fy) => {
    p.rect(fx + 7, fy + 2, 2, 12, WOOD_D);
    p.rect(fx + 1, fy - 4, 14, 7, '#c8b068');
    p.hline(fx + 3, fx + 12, fy - 2, '#4a3a2a');
    p.hline(fx + 3, fx + 9, fy, '#4a3a2a');
  },
  hay: (p, fx, fy) => {
    box(p, fx + 1, fy + 1, 14, 13, 4, '#c8a84a');
    for (let i = 0; i < 5; i++) p.hline(fx + 2, fx + 13, fy + 6 + i * 2, '#a8883a');
  },
  corpse: (p, fx, fy) => {
    // a still figure under a blanket: presented without gore
    shadow(p, fx + 8, fy + 12, 7, 2);
    p.ellipse(fx + 8, fy + 9, 7, 3.5, '#5a5a62');
    p.ellipse(fx + 8, fy + 8, 6, 2.5, '#6a6a74');
    p.px(fx + 2, fy + 9, '#4a4a52');
  },
  carcass: (p, fx, fy) => {
    shadow(p, fx + 8, fy + 12, 7, 2);
    p.ellipse(fx + 8, fy + 9, 6, 3, '#7a5a3a');
    p.ellipse(fx + 3, fy + 8, 2, 2, '#6a4a30');
    p.line(fx + 10, fy + 11, fx + 13, fy + 13, '#4a3220');
  },
  pile: (p, fx, fy) => {
    shadow(p, fx + 8, fy + 13, 5, 2);
    p.ellipse(fx + 8, fy + 10, 5, 3.5, '#8a7a5a');
    p.ellipse(fx + 7, fy + 9, 3, 2, '#a8966e');
    p.px(fx + 10, fy + 8, '#6a5a40');
  },
  supply_bag: (p, fx, fy) => {
    shadow(p, fx + 8, fy + 13, 7, 2);
    p.rect(fx + 1, fy + 6, 14, 7, '#2e4a32');
    p.ellipse(fx + 1, fy + 9.5, 1.5, 3.5, '#26402a');
    p.ellipse(fx + 15, fy + 9.5, 1.5, 3.5, '#26402a');
    p.hline(fx + 1, fx + 14, fy + 6, '#3e5e40');
    p.hline(fx + 4, fx + 11, fy + 9, '#1a2a1c');
    p.line(fx + 4, fy + 6, fx + 8, fy + 2, '#1a1a1a');
    p.line(fx + 12, fy + 6, fx + 8, fy + 2, '#1a1a1a');
  },
  hunting_stand: (p, fx, fy) => {
    p.line(fx + 2, fy + 14, fx + 4, fy - 14, WOOD_D);
    p.line(fx + 14, fy + 14, fx + 12, fy - 14, WOOD_D);
    for (let i = 0; i < 5; i++) p.hline(fx + 4, fx + 12, fy + 10 - i * 5, WOOD);
    p.rect(fx, fy - 22, 16, 9, '#6a4a2c');
    p.rect(fx - 1, fy - 25, 18, 3, '#4a3220');
    p.rect(fx + 3, fy - 19, 10, 3, '#1a1a1a');
  },
  campfire: (p, fx, fy, _w, _h, rng, o) => {
    if (o.build === undefined && (o.s ?? 0) <= 0 && !o.lit) {
      p.ellipse(fx + 8, fy + 10, 5, 3, '#3a3430');
      p.ellipse(fx + 8, fy + 10, 3, 2, '#5a524a');
    } else {
      p.ellipse(fx + 8, fy + 11, 5, 2.5, '#2a2420');
      p.line(fx + 3, fy + 12, fx + 11, fy + 7, '#6a4a2c');
      p.line(fx + 13, fy + 12, fx + 5, fy + 7, '#5a3e24');
      p.line(fx + 8, fy + 13, fx + 8, fy + 6, '#7a5634');
    }
    void rng;
  },
  fire_pit: (p, fx, fy, _w, _h, rng, o) => {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      rock(p, fx + 8 + Math.cos(a) * 6, fy + 10 + Math.sin(a) * 3.5, 1.8, 1.4, rng, false);
    }
    p.ellipse(fx + 8, fy + 10, 4, 2.2, '#2a2420');
    if ((o.s ?? 0) > 0 || o.lit) {
      p.line(fx + 5, fy + 11, fx + 10, fy + 8, '#6a4a2c');
      p.line(fx + 11, fy + 11, fx + 6, fy + 8, '#5a3e24');
    }
  },
  lean_to: (p, fx, fy, _w, _h, rng, _o, season, snow) => {
    shadow(p, fx + 16, fy + 14, 15, 3);
    // sloped roof of branches seen from the front
    for (let x = 0; x < 30; x++) {
      const top = fy - 8 + Math.floor(x * 0.05);
      for (let y = top; y < fy + 8; y++) {
        const k = (y - top + x * 3 + rng.int(0, 2)) % 5;
        p.px(fx + 1 + x, y, k === 0 ? '#3e2a18' : season === 'autumn' ? '#8a5a2a' : k < 3 ? '#4a6a2e' : '#5a7a34');
      }
    }
    if (snow) p.rect(fx + 1, fy - 8, 30, 3, '#eef3f6');
    p.rect(fx + 3, fy + 8, 26, 6, '#2a2218');
    p.vline(fx + 1, fy - 8, fy + 14, WOOD_D);
    p.vline(fx + 30, fy - 8, fy + 14, WOOD_D);
    p.hline(fx + 1, fx + 30, fy - 9, WOOD);
  },
  tarp_shelter: (p, fx, fy, _w, _h, _rng, _o, _s, snow) => {
    shadow(p, fx + 16, fy + 29, 15, 3);
    for (let y = 0; y < 26; y++) {
      const inset = Math.abs(13 - y) < 2 ? 0 : 0;
      p.hline(fx + 1 + inset, fx + 30 - inset, fy - 4 + y, y < 12 ? '#3e6a3a' : '#355e32');
    }
    p.hline(fx + 1, fx + 30, fy + 8, '#2a4a2a');
    p.rect(fx + 5, fy + 14, 22, 12, '#1e2a1e');
    p.vline(fx + 16, fy - 6, fy + 26, WOOD_D);
    p.line(fx, fy - 6, fx + 31, fy - 6, '#c8c0a0');
    if (snow) p.rect(fx + 1, fy - 4, 30, 5, '#eef3f6');
  },
  bough_bed: (p, fx, fy, _w, _h, rng) => {
    p.rect(fx + 1, fy + 3, 14, 11, '#2e4a26');
    for (let i = 0; i < 14; i++) p.line(fx + 1 + rng.int(0, 12), fy + 4 + rng.int(0, 9), fx + 3 + rng.int(0, 12), fy + 4 + rng.int(0, 9), i % 2 ? '#3e6a2e' : '#24401e');
    p.rect(fx, fy + 3, 1, 11, '#5a3e24');
    p.rect(fx + 15, fy + 3, 1, 11, '#5a3e24');
  },
  latrine: (p, fx, fy, _w, _h, _rng, o) => {
    p.ellipse(fx + 8, fy + 11, 5, 2.5, '#2a2016');
    p.rect(fx + 2, fy + 2, 12, 5, '#5a3e24');
    for (let x = 2; x < 14; x += 2) p.vline(fx + x, fy - 4, fy + 6, x % 4 ? WOOD : WOOD_D);
    if ((o.s ?? 0) > 70) p.ellipse(fx + 8, fy + 11, 3, 1.5, '#4a3a22');
  },
  wash_station: (p, fx, fy) => {
    p.line(fx + 2, fy + 14, fx + 4, fy + 2, WOOD_D);
    p.line(fx + 14, fy + 14, fx + 12, fy + 2, WOOD_D);
    p.rect(fx + 3, fy + 3, 10, 2, WOOD);
    p.ellipse(fx + 8, fy + 2, 5, 2, '#7a7a7a');
    p.ellipse(fx + 8, fy + 2, 3.5, 1.2, '#4a8a9a');
  },
  storage_cache: (p, fx, fy, _w, _h, _rng, _o, _s, snow) => {
    shadow(p, fx + 8, fy + 14, 8, 2);
    p.rect(fx + 1, fy + 4, 14, 8, '#5a3e24');
    for (let i = 0; i < 3; i++) p.hline(fx + 1, fx + 14, fy + 5 + i * 3, '#7a5634');
    p.rect(fx, fy - 2, 16, 6, '#3e5a34');
    p.hline(fx, fx + 15, fy - 2, '#4e6e40');
    if (snow) p.rect(fx, fy - 3, 16, 2, '#eef3f6');
    p.rect(fx + 2, fy + 12, 2, 2, WOOD_D);
    p.rect(fx + 12, fy + 12, 2, 2, WOOD_D);
  },
  woven_chest: (p, fx, fy) => {
    shadow(p, fx + 8, fy + 14, 7, 2);
    box(p, fx + 1, fy + 2, 14, 12, 4, '#9a7a4a', false);
    // wicker weave
    for (let y = fy + 7; y < fy + 13; y += 2) for (let x = fx + 2 + ((y >> 1) % 2); x < fx + 14; x += 2) p.px(x, y, '#7a5a30');
    p.hline(fx + 1, fx + 14, fy + 6, '#6a4a28');
    p.rect(fx + 7, fy + 5, 2, 2, '#5a3e20');
  },
  pegged_chest: (p, fx, fy) => {
    box(p, fx + 1, fy, 14, 14, 5, '#8a6a42');
    for (const x of [fx + 3, fx + 12]) for (const y of [fy + 7, fy + 11]) p.px(x, y, '#c8a070');
    p.vline(fx + 8, fy + 6, fy + 12, '#6a4a2c');
  },
  woodpile: (p, fx, fy, _w, _h, _rng, o, _s, snow) => {
    shadow(p, fx + 8, fy + 14, 8, 2);
    // two posts and a bark roof over stacked log ends
    p.vline(fx + 1, fy + 1, fy + 13, WOOD_D);
    p.vline(fx + 14, fy + 1, fy + 13, WOOD_D);
    const n = (o.inv ?? []).reduce((a, s) => a + (s ? s.qty : 0), 0);
    const rows = Math.min(4, Math.ceil(n / 12));
    for (let r = 0; r < rows; r++)
      for (let i = 0; i < 4; i++) {
        const cx = fx + 3.5 + i * 3;
        const cy = fy + 11.5 - r * 3;
        p.ellipse(cx, cy, 1.6, 1.4, '#b08a5a');
        p.px(Math.round(cx), Math.round(cy), '#8a6a42');
      }
    p.rect(fx, fy - 1, 16, 2, '#5a3e24');
    p.hline(fx, fx + 15, fy - 1, '#7a5634');
    if (snow) p.rect(fx, fy - 2, 16, 1, '#eef3f6');
  },
  food_store: (p, fx, fy, _w, _h, _rng, _o, _s, snow) => {
    shadow(p, fx + 8, fy + 13, 8, 2);
    // stone rim and a plank lid
    p.ellipse(fx + 8, fy + 9, 8, 4.5, STONE_D);
    for (let i = 0; i < 9; i++) p.ellipse(fx + 1.5 + i * 1.6, fy + 9 + (i % 2 ? 1 : -0.5), 1.4, 1.2, i % 3 ? STONE : STONE_L);
    p.rect(fx + 3, fy + 5, 10, 5, WOOD);
    p.hline(fx + 3, fx + 12, fy + 5, WOOD_L);
    p.vline(fx + 6, fy + 5, fy + 9, WOOD_D);
    p.vline(fx + 10, fy + 5, fy + 9, WOOD_D);
    if (snow) p.rect(fx + 3, fy + 4, 10, 1, '#eef3f6');
  },
  tool_rack: (p, fx, fy, _w, _h, _rng, o) => {
    shadow(p, fx + 8, fy + 14, 7, 1.5);
    p.vline(fx + 2, fy - 4, fy + 13, WOOD_D);
    p.vline(fx + 13, fy - 4, fy + 13, WOOD_D);
    p.hline(fx + 1, fx + 14, fy - 3, WOOD);
    p.hline(fx + 1, fx + 14, fy + 5, WOOD);
    // hanging tools show how full it is
    const n = (o.inv ?? []).filter(Boolean).length;
    for (let i = 0; i < Math.min(4, n); i++) {
      const x = fx + 4 + i * 3;
      p.vline(x, fy - 2, fy + 4, i % 2 ? '#8a5e36' : '#6a4a2c');
      p.rect(x - 1, fy - 2, 3, 2, i % 2 ? '#a8acb0' : '#7a7a72');
    }
  },
  wooden_crate: (p, fx, fy) => {
    box(p, fx + 1, fy, 14, 14, 5, '#9a7448');
    p.line(fx + 2, fy + 6, fx + 13, fy + 12, '#6a4a2c');
    p.line(fx + 13, fy + 6, fx + 2, fy + 12, '#6a4a2c');
  },
  rain_collector: (p, fx, fy, _w, _h, _rng, o) => {
    p.rect(fx + 4, fy + 4, 9, 10, '#2e5a8a');
    p.hline(fx + 4, fx + 12, fy + 7, '#244a74');
    p.hline(fx + 4, fx + 12, fy + 11, '#244a74');
    p.line(fx, fy - 6, fx + 8, fy + 3, '#3e6a3a');
    p.line(fx + 16, fy - 6, fx + 8, fy + 3, '#3e6a3a');
    p.hline(fx, fx + 15, fy - 6, '#4e7a44');
    for (let y = -5; y < 2; y++) p.hline(fx + 1 + (y + 5), fx + 14 - (y + 5), fy + y, '#35603a');
    if ((o.water?.ml ?? 0) > 20000) p.ellipse(fx + 8, fy + 4, 4, 1, '#6aaac0');
  },
  water_filter: (p, fx, fy) => {
    p.line(fx + 3, fy + 14, fx + 5, fy - 6, WOOD_D);
    p.line(fx + 13, fy + 14, fx + 11, fy - 6, WOOD_D);
    p.rect(fx + 5, fy - 6, 6, 5, '#c8c0a0');
    p.rect(fx + 6, fy, 4, 4, '#2a2a2a');
    p.rect(fx + 6, fy + 5, 4, 3, '#b8a070');
    p.rect(fx + 5, fy + 10, 6, 4, '#7a7a7a');
  },
  drying_rack: (p, fx, fy, _w, _h, _rng, o) => {
    p.vline(fx + 1, fy - 6, fy + 14, WOOD_D);
    p.vline(fx + 14, fy - 6, fy + 14, WOOD_D);
    p.hline(fx + 1, fx + 14, fy - 5, WOOD);
    p.hline(fx + 1, fx + 14, fy + 2, WOOD);
    const n = (o.inv ?? []).filter(Boolean).length;
    for (let i = 0; i < Math.min(n * 2, 10); i++) p.rect(fx + 3 + (i % 5) * 2, fy - 4 + Math.floor(i / 5) * 7, 1, 5, '#8a3a2a');
  },
  garden_plot: (p, fx, fy, _w, _h, _rng, o) => {
    p.rect(fx, fy + 1, 16, 14, '#4a3422');
    for (let y = 0; y < 3; y++) p.hline(fx + 1, fx + 14, fy + 3 + y * 5, '#5e4430');
    const c = o.crop;
    if (!c) return;
    const stage = c.growth >= 1 ? 4 : Math.floor(c.growth * 4);
    const col = c.health < 0.35 ? '#8a7a3a' : '#4a8a36';
    for (let r = 0; r < 3; r++)
      for (let k = 0; k < 4; k++) {
        const x = fx + 2 + k * 4;
        const y = fy + 4 + r * 5;
        if (stage === 0) p.px(x, y, col);
        else {
          p.vline(x, y - stage, y, col);
          p.px(x - 1, y - stage + 1, shade(col, 0.2));
          if (stage >= 2) p.px(x + 1, y - stage + 2, shade(col, 0.2));
          if (stage >= 4) p.px(x, y - stage - 1, c.id === 'carrot' ? '#e07a2a' : c.id === 'bean' ? '#c8c060' : '#e8e0c0');
        }
      }
  },
  snare: (p, fx, fy, _w, _h, _rng, o) => {
    p.vline(fx + 8, fy + 6, fy + 13, WOOD_D);
    p.ellipse(fx + 8, fy + 12, 3, 1.5, (x, y, nx, ny) => (nx * nx + ny * ny > 0.5 ? '#c8b080' : null));
    if (o.s2 === 1) p.ellipse(fx + 10, fy + 11, 3, 2, '#8a7a5a');
  },
  workbench: (p, fx, fy) => {
    p.rect(fx, fy + 2, 16, 5, '#8a6440');
    p.hline(fx, fx + 15, fy + 2, '#a88050');
    p.rect(fx + 1, fy + 7, 2, 7, WOOD_D);
    p.rect(fx + 13, fy + 7, 2, 7, WOOD_D);
    p.rect(fx + 4, fy, 4, 2, '#6a6a6a');
    p.px(fx + 11, fy + 1, '#aa3a2a');
  },
  log_wall: (p, fx, fy, _w, _h, rng) => {
    for (let i = 0; i < 5; i++) {
      const y = fy - 6 + i * 4;
      p.rect(fx, y, 16, 4, i % 2 ? '#6a4a2c' : '#5a3e24');
      p.hline(fx, fx + 15, y, '#8a6440');
      p.ellipse(fx + (i % 2 ? 1 : 15), y + 2, 1, 1.5, '#a07a4a');
    }
    void rng;
  },
  roof: (p, fx, fy, _w, _h, rng, _o, _s, snow) => {
    for (let y = -10; y < 6; y++) for (let x = 0; x < 16; x++) p.px(fx + x, fy + y, (y + 10 + rng.int(0, 1)) % 4 === 0 ? '#5a4a2a' : '#8a7040');
    if (snow) p.rect(fx, fy - 10, 16, 4, '#eef3f6');
  },
  plank_floor: (p, fx, fy) => {
    p.rect(fx, fy, 16, 16, '#8c6a44');
    for (let y = 0; y < 16; y += 4) p.hline(fx, fx + 15, fy + y, '#735536');
  },
  foundation: (p, fx, fy, _w, _h, rng) => {
    for (let i = 0; i < 6; i++) rock(p, fx + 3 + (i % 3) * 5, fy + 4 + Math.floor(i / 3) * 7, 2.5, 2, rng, false);
  },
};

const cache = new Map<string, ObjSprite>();

/** Key captures the visual state so sprites rebuild only when appearance changes. */
function visualKey(o: WorldObject, season: SeasonId, snow: boolean): string {
  const t = o.type;
  let state = '';
  if (t === 'bilberry' || t === 'bramble' || t === 'hazel' || t === 'wild_garlic' || t === 'mushrooms') state = String(o.s ?? 0);
  else if (t === 'campfire' || t === 'fire_pit') state = (o.s ?? 0) > 0 || o.lit ? '1' : '0';
  else if (t === 'garden_plot') state = o.crop ? `${o.crop.id}${Math.floor(o.crop.growth * 4)}${o.crop.health < 0.35 ? 'd' : ''}` : '-';
  else if (t === 'snare') state = String(o.s2 ?? 0);
  else if (t === 'drying_rack' || t === 'tool_rack') state = String(Math.min(4, (o.inv ?? []).filter(Boolean).length));
  else if (t === 'woodpile') state = String(Math.min(4, Math.ceil((o.inv ?? []).reduce((a, s) => a + (s ? s.qty : 0), 0) / 12)));
  else if (t === 'rain_collector') state = (o.water?.ml ?? 0) > 20000 ? 'f' : 'e';
  else if (t === 'latrine') state = (o.s ?? 0) > 70 ? 'f' : '';
  return `${t}:${(o.v ?? 0) % 4}:${season}:${snow ? 1 : 0}:${state}`;
}

export function objectSprite(o: WorldObject, season: SeasonId, snow: boolean): ObjSprite | null {
  const key = visualKey(o, season, snow);
  let s = cache.get(key);
  if (s) return s;
  const draw = DRAW[o.type];
  if (!draw) return null;
  const d = objectDef(o.type);
  const w = d.w ?? 1;
  const h = d.h ?? 1;
  const cw = w * 16 + PAD * 2;
  const ch = h * 16 + EXTRA_TOP + 4;
  const { c, g } = makeCanvas(cw, ch);
  const p = new PixelPainter(g);
  const rng = new Rng(((o.v ?? 0) % 4) * 7919 + o.type.length * 31 + 5);
  draw(p, PAD, EXTRA_TOP, w, h, rng, o, season, snow);
  s = { img: c, ox: -PAD, oy: -EXTRA_TOP };
  cache.set(key, s);
  if (cache.size > 2000) cache.clear();
  return s;
}

export const hasSprite = (type: string): boolean => !!DRAW[type];
