import type { BuildingPOI } from '@/sim/types';
import { Rng } from '@/core/rng';
import { makeCanvas, PixelPainter, shade } from './pixel';

interface Style {
  roof: string;
  wall: string;
  trim: string;
  flat?: boolean;
}

const STYLES: Record<string, Style> = {
  forest_hut: { roof: '#6a4a30', wall: '#6a4a2c', trim: '#3e2a18' },
  forester_shed: { roof: '#5a6068', wall: '#8a7a64', trim: '#4a3e30' },
  farmhouse: { roof: '#9a4a32', wall: '#d8d0c0', trim: '#6a4a30' },
  barn: { roof: '#5a3a28', wall: '#7a5230', trim: '#3e2a1a' },
  pump_station: { roof: '#8a8a84', wall: '#a8a8a0', trim: '#6a6a66', flat: true },
};

const cache = new Map<string, HTMLCanvasElement>();

/**
 * Exterior of an abandoned building: roof (covering all but the front row)
 * and the front facade with door and windows. Hidden while the player is inside.
 */
export function buildingSprite(b: BuildingPOI, snow: boolean): HTMLCanvasElement {
  const key = `${b.id}:${snow ? 1 : 0}`;
  let c = cache.get(key);
  if (c) return c;
  const st = STYLES[b.kind] ?? STYLES.forest_hut;
  const W = b.w * 16 + 4;
  const roofH = b.h * 16;
  const H = roofH + 16;
  const m = makeCanvas(W, H);
  const p = new PixelPainter(m.g);
  const rng = new Rng(b.id * 131);

  // facade (front wall row)
  const fy = roofH;
  p.rect(2, fy - 2, W - 4, 18, st.wall);
  for (let y = fy; y < fy + 16; y += 3) p.hline(2, W - 3, y, shade(st.wall, -0.08));
  if (b.kind === 'farmhouse') {
    for (let x = 2; x < W - 2; x += 12) p.vline(x, fy - 2, fy + 15, st.trim);
    p.hline(2, W - 3, fy + 5, st.trim);
  }
  p.hline(2, W - 3, fy + 15, shade(st.wall, -0.4));
  const doorX = (b.doorX - b.x) * 16 + 2;
  p.rect(doorX + 3, fy + 2, 10, 14, '#2a1e14');
  p.rect(doorX + 3, fy + 2, 10, 1, st.trim);
  if (rng.chance(0.5)) p.rect(doorX + 9, fy + 3, 4, 12, shade(st.trim, 0.2)); // door hanging open
  // windows
  for (let tx = 0; tx < b.w; tx++) {
    const wx = tx * 16 + 2;
    if (Math.abs(wx - doorX) < 16 || tx === 0 || tx === b.w - 1) continue;
    if (tx % 2) continue;
    p.rect(wx + 4, fy + 3, 8, 6, '#1e2a34');
    p.rect(wx + 3, fy + 2, 10, 1, st.trim);
    p.rect(wx + 3, fy + 9, 10, 1, st.trim);
    p.vline(wx + 8, fy + 3, fy + 8, st.trim);
    if (rng.chance(0.5)) p.line(wx + 5, fy + 4, wx + 7, fy + 7, '#6a7a88'); // broken pane
  }

  // roof
  if (st.flat) {
    p.rect(0, 2, W, roofH - 2, st.roof);
    p.rect(0, 2, W, 2, shade(st.roof, 0.2));
    p.rect(0, roofH - 2, W, 2, shade(st.roof, -0.4));
    for (let i = 0; i < 6; i++) p.rect(rng.int(4, W - 8), rng.int(6, roofH - 8), rng.int(2, 6), 2, shade(st.roof, -0.12));
    p.rect(6, 6, 6, 4, '#5a5a56');
  } else {
    const ridge = Math.floor(roofH * 0.45);
    for (let y = 0; y < roofH; y++) {
      const upper = y < ridge;
      const base = upper ? shade(st.roof, 0.12) : shade(st.roof, -0.12);
      const row = upper ? (ridge - y) % 4 : (y - ridge) % 4;
      p.hline(0, W - 1, y, row === 0 ? shade(base, -0.25) : base);
      if (row !== 0) for (let x = (y * 3) % 6; x < W; x += 6) p.px(x, y, shade(base, -0.12));
    }
    p.hline(0, W - 1, ridge, shade(st.roof, -0.45));
    p.hline(0, W - 1, ridge - 1, shade(st.roof, 0.3));
    p.rect(0, roofH - 2, W, 2, shade(st.roof, -0.5));
    // weathering and moss
    for (let i = 0; i < b.w * 3; i++) p.px(rng.int(0, W - 1), rng.int(0, roofH - 3), rng.chance(0.5) ? '#4a5a2e' : shade(st.roof, -0.3));
    if (b.kind === 'farmhouse' || b.kind === 'forest_hut') {
      const cx = W - 22;
      p.rect(cx, ridge - 10, 6, 10, '#6a5a50');
      p.rect(cx, ridge - 10, 6, 2, '#3a3230');
    }
    if (snow) {
      for (let y = 0; y < roofH - 3; y++) for (let x = 0; x < W; x++) if ((x + y * 7) % 11 !== 0) p.px(x, y, y < ridge ? '#eef3f6' : '#d6e0e8');
    }
  }
  c = m.c;
  cache.set(key, c);
  return c;
}
