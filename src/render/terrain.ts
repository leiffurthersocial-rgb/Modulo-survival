import { T } from '@/content/terrain';
import { valueNoise } from '@/core/noise';
import type { SeasonId } from '@/sim/types';
import type { WorldIndex } from '@/sim/world';
import { h2, hexToRgb } from './pixel';

export const TILE = 16;
export const CHUNK = 16; // tiles per chunk side
const CPX = TILE * CHUNK;

type RGB = [number, number, number];
const P = (...hex: string[]): RGB[] => hex.map(hexToRgb);

interface SeasonPal {
  grass: RGB[];
  forest: RGB[];
  field: RGB[];
  tuft: RGB[];
  flower: RGB[];
  litter: RGB[];
}

const SEASON_PAL: Record<SeasonId, SeasonPal> = {
  spring: {
    grass: P('#4f7a34', '#5b8839', '#66943f', '#476f2f'),
    forest: P('#3a4a2a', '#43532e', '#364226', '#4d5c34'),
    field: P('#5e6a36', '#6a7440', '#56602f'),
    tuft: P('#7aa84a', '#3c6428', '#8ab856'),
    flower: P('#f2f0e6', '#e8d86a', '#b8a8e0'),
    litter: P('#5a4a2e', '#6a5634', '#4a6a30'),
  },
  summer: {
    grass: P('#4a772d', '#558433', '#62923a', '#416a28'),
    forest: P('#384726', '#41502b', '#334022', '#4a5831'),
    field: P('#76703a', '#847c42', '#6a6434'),
    tuft: P('#72a040', '#355e24', '#86b04c'),
    flower: P('#e8c84a', '#f0f0f0', '#d06a8a'),
    litter: P('#5a4a2e', '#6a5634', '#445c2a'),
  },
  autumn: {
    grass: P('#6f7438', '#7c7e3e', '#646830', '#868444'),
    forest: P('#5a4226', '#684c2a', '#4e3a22', '#76562e'),
    field: P('#7a6436', '#886e3c', '#6c5830'),
    tuft: P('#9a8a46', '#6a6a30', '#aa9a50'),
    flower: P('#c85a2a', '#d8a030', '#a83a22'),
    litter: P('#b8642a', '#d08a34', '#8a3a1e'),
  },
  winter: {
    grass: P('#5c6446', '#66704c', '#545c40', '#6e7652'),
    forest: P('#4a4636', '#524e3c', '#433f30', '#5a5642'),
    field: P('#665e48', '#70684e', '#5c5440'),
    tuft: P('#80845e', '#5a5e42', '#8c9068'),
    flower: P('#7a7a6a', '#8a8a78', '#6a6a5c'),
    litter: P('#6a5a44', '#5a4c3a', '#7a6a50'),
  },
};

const SNOW = P('#e6edf2', '#dde6ee', '#f0f5f8', '#cdd8e2');
const FIXED: Record<number, RGB[]> = {
  [T.PATH]: P('#7a5c3c', '#6c5034', '#866642', '#624a30'),
  [T.ROAD]: P('#4c4c50', '#55555a', '#46464a', '#5c5c60'),
  [T.MUD]: P('#4a3a28', '#554330', '#3f3122', '#5c4a34'),
  [T.GRAVEL]: P('#8a847a', '#7a746a', '#9a948a', '#6c665c'),
  [T.FLOOR]: P('#8c6a44', '#7e5e3c', '#946f48', '#735536'),
  [T.WALL]: P('#5a3e26', '#4c3420', '#664830', '#3e2a1a'),
  [T.CONCRETE]: P('#8a8a86', '#80807c', '#94948e', '#76766f'),
  [T.ROCK]: P('#6c6c64', '#606058', '#78786e', '#56564e'),
  [T.SHALLOW]: P('#3c7a86', '#447f8c', '#367280', '#4a8894'),
  [T.STREAM]: P('#3a6e8a', '#407693', '#346680', '#4a82a0'),
  [T.DEEP]: P('#1f4a68', '#245272', '#1b425e', '#28587a'),
};

function isWaterT(t: number): boolean {
  return t === T.DEEP || t === T.SHALLOW || t === T.STREAM;
}
/** Man-made surfaces keep crisp edges. */
function isCrisp(t: number): boolean {
  return t === T.ROAD || t === T.FLOOR || t === T.WALL || t === T.CONCRETE;
}

/**
 * Terrain is rendered once per chunk into an offscreen canvas at 1x pixel
 * scale, with noise-jittered boundaries for organic edges, dithered texture
 * and baked ground decals. Chunks are cached and only rebuilt on change.
 */
export class TerrainCache {
  private cache = new Map<string, HTMLCanvasElement>();
  private order: string[] = [];
  private maxChunks = 64;
  private dirty = new Set<string>();

  constructor(private index: WorldIndex, private seed: number) {}

  setBudget(n: number): void {
    this.maxChunks = n;
  }

  invalidateTile(tileIndex: number): void {
    const x = tileIndex % this.index.w;
    const y = Math.floor(tileIndex / this.index.w);
    // neighbours can change too because of edge blending
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) this.dirty.add(`${Math.floor((x + dx) / CHUNK)},${Math.floor((y + dy) / CHUNK)}`);
  }

  clear(): void {
    this.cache.clear();
    this.order = [];
  }

  get(cx: number, cy: number, season: SeasonId, snow: boolean): HTMLCanvasElement {
    const key = `${cx},${cy},${season},${snow ? 1 : 0}`;
    const dk = `${cx},${cy}`;
    let c = this.cache.get(key);
    if (c && !this.dirty.has(dk)) return c;
    if (this.dirty.has(dk)) {
      this.dirty.delete(dk);
      for (const k of [...this.cache.keys()]) if (k.startsWith(dk + ',')) this.cache.delete(k);
    }
    c = this.build(cx, cy, season, snow);
    this.cache.set(key, c);
    this.order.push(key);
    while (this.order.length > this.maxChunks) {
      const old = this.order.shift()!;
      this.cache.delete(old);
    }
    return c;
  }

  private build(cx: number, cy: number, season: SeasonId, snow: boolean): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = CPX;
    canvas.height = CPX;
    const g = canvas.getContext('2d')!;
    const img = g.createImageData(CPX, CPX);
    const d = img.data;
    const idx = this.index;
    const seed = this.seed;
    const pal = SEASON_PAL[season];
    const x0 = cx * CPX;
    const y0 = cy * CPX;

    const terrainAtPx = (px: number, py: number): number => idx.terrainAt(Math.floor(px / TILE), Math.floor(py / TILE));

    for (let ly = 0; ly < CPX; ly++) {
      const py = y0 + ly;
      for (let lx = 0; lx < CPX; lx++) {
        const px = x0 + lx;
        const raw = terrainAtPx(px, py);
        let t = raw;
        if (!isCrisp(raw)) {
          const jx = (valueNoise(seed + 11, px / 7, py / 7) - 0.5) * 9;
          const jy = (valueNoise(seed + 12, px / 7, py / 7) - 0.5) * 9;
          const tj = terrainAtPx(px + jx, py + jy);
          if (!isCrisp(tj)) t = tj;
        }
        const n = h2(px, py, 3);
        const coarse = valueNoise(seed + 21, px / 5, py / 5);
        let col: RGB;
        let colors: RGB[];
        if (t === T.GRASS) colors = snow ? SNOW : pal.grass;
        else if (t === T.FOREST) colors = snow ? SNOW : pal.forest;
        else if (t === T.FIELD) colors = snow ? SNOW : pal.field;
        else colors = FIXED[t] ?? pal.grass;
        if (snow && (t === T.PATH || t === T.MUD || t === T.GRAVEL || t === T.ROCK)) colors = SNOW;
        // dithered texture: coarse patches plus per-pixel grain
        const k = Math.min(colors.length - 1, Math.floor((coarse * 0.7 + n * 0.3) * colors.length));
        col = colors[k];
        // surface-specific patterns
        if (t === T.FLOOR) {
          if (py % 4 === 0) col = colors[3];
          else if ((px + Math.floor(py / 4) * 7) % 16 === 0) col = colors[3];
        } else if (t === T.WALL) {
          if (py % 3 === 0) col = colors[3];
        } else if (t === T.ROAD) {
          const tx = Math.floor(px / TILE);
          const ty = Math.floor(py / TILE);
          // faded centre line where the road runs north-south
          const l = idx.terrainAt(tx - 1, ty) === T.ROAD && idx.terrainAt(tx + 1, ty) === T.ROAD;
          if (l && px % TILE === 8 && py % 10 < 5 && h2(tx, ty, 9) > 0.35) col = [150, 146, 128];
          if (n > 0.985) col = [110, 104, 90];
        } else if (t === T.FIELD && !snow) {
          if (py % 5 === 0) col = [col[0] - 12, col[1] - 10, col[2] - 8];
        } else if (isWaterT(t)) {
          // depth shading toward the shore
          const shoreN = !isWaterT(terrainAtPx(px, py - 3)) || !isWaterT(terrainAtPx(px - 3, py)) || !isWaterT(terrainAtPx(px + 3, py)) || !isWaterT(terrainAtPx(px, py + 3));
          if (shoreN) col = [Math.min(255, col[0] + 30), Math.min(255, col[1] + 35), Math.min(255, col[2] + 30)];
          const edge = !isWaterT(terrainAtPx(px, py - 1)) || !isWaterT(terrainAtPx(px, py + 1)) || !isWaterT(terrainAtPx(px - 1, py)) || !isWaterT(terrainAtPx(px + 1, py));
          if (edge) col = [170, 200, 196];
          if (t === T.STREAM && (px + py * 2) % 11 === 0 && n > 0.6) col = [120, 170, 190];
        } else {
          // land next to water gets a darker damp rim
          if (!isCrisp(t) && (isWaterT(terrainAtPx(px, py + 2)) || isWaterT(terrainAtPx(px, py - 2)) || isWaterT(terrainAtPx(px + 2, py)) || isWaterT(terrainAtPx(px - 2, py)))) {
            col = [col[0] * 0.78, col[1] * 0.8, col[2] * 0.78];
          }
        }
        const o = (ly * CPX + lx) * 4;
        d[o] = col[0];
        d[o + 1] = col[1];
        d[o + 2] = col[2];
        d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);

    // baked decals: grass tufts, flowers, leaf litter, pebbles
    for (let ty = 0; ty < CHUNK; ty++)
      for (let tx = 0; tx < CHUNK; tx++) {
        const wx = cx * CHUNK + tx;
        const wy = cy * CHUNK + ty;
        const t = idx.terrainAt(wx, wy);
        const bx = tx * TILE;
        const by = ty * TILE;
        const r = h2(wx, wy, 17);
        const put = (x: number, y: number, c: RGB) => {
          g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
          g.fillRect(bx + x, by + y, 1, 1);
        };
        if (snow) {
          if ((t === T.GRASS || t === T.FOREST) && r < 0.2) put(Math.floor(r * 70) % 14 + 1, Math.floor(r * 130) % 14 + 1, [150, 160, 150]);
          continue;
        }
        if (t === T.GRASS || t === T.FIELD) {
          const n = Math.floor(h2(wx, wy, 5) * 4) + 1;
          for (let i = 0; i < n; i++) {
            const x = Math.floor(h2(wx, wy, 20 + i) * 13) + 1;
            const y = Math.floor(h2(wx, wy, 30 + i) * 12) + 3;
            const c = pal.tuft[i % pal.tuft.length];
            put(x, y, c);
            put(x, y - 1, c);
            put(x + 1, y - 2, pal.tuft[0]);
            put(x - 1, y, pal.tuft[1]);
          }
          if (r < 0.12) {
            const x = Math.floor(h2(wx, wy, 41) * 12) + 2;
            const y = Math.floor(h2(wx, wy, 42) * 12) + 2;
            const c = pal.flower[Math.floor(h2(wx, wy, 43) * pal.flower.length)];
            put(x, y, c);
            put(x + 2, y + 1, c);
            put(x + 1, y + 3, c);
          }
        } else if (t === T.FOREST) {
          const n = Math.floor(h2(wx, wy, 6) * 5) + 2;
          for (let i = 0; i < n; i++) {
            const x = Math.floor(h2(wx, wy, 50 + i) * 14) + 1;
            const y = Math.floor(h2(wx, wy, 60 + i) * 14) + 1;
            const c = pal.litter[i % pal.litter.length];
            put(x, y, c);
            if (i % 2) put(x + 1, y, c);
          }
          // spring wood anemones
          if (season === 'spring' && r < 0.1) {
            const x = Math.floor(h2(wx, wy, 44) * 12) + 2;
            const y = Math.floor(h2(wx, wy, 45) * 12) + 2;
            put(x, y, [240, 240, 232]);
            put(x + 3, y + 2, [240, 240, 232]);
            put(x + 1, y + 1, [90, 140, 60]);
          }
        } else if (t === T.PATH || t === T.GRAVEL) {
          if (r < 0.5) {
            const x = Math.floor(h2(wx, wy, 70) * 14) + 1;
            const y = Math.floor(h2(wx, wy, 71) * 14) + 1;
            put(x, y, [150, 140, 120]);
            put(x + 1, y, [110, 100, 86]);
          }
        }
      }
    return canvas;
  }
}
