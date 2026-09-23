import { Rng, hashString, rand3 } from '@/core/rng';
import { fbm, valueNoise } from '@/core/noise';
import { T, isWater, terrainDef } from '@/content/terrain';
import { ANIMALS } from '@/content/animals';
import { LORE_CAUSES } from '@/content/lore';
import { objectDef } from '@/content/objects';
import type { Animal, BuildingPOI, GameMode, GameState, ItemStack, WorldObject } from '@/sim/types';
import { CONTAM_CELL } from '@/sim/world';
import { generateRoster, makeStack } from './characters';

export const WORLD_SIZE = 320;
export const SAVE_VERSION = 1;
export const START_TIME = 5 * 1440 + 7 * 60;

interface Ctx {
  seed: number;
  rng: Rng;
  w: number;
  h: number;
  terrain: Uint8Array;
  reserved: Uint8Array;
  objects: Record<number, WorldObject>;
  occ: Int32Array;
  buildings: BuildingPOI[];
  nextId: number;
}

const idx = (c: Ctx, x: number, y: number) => y * c.w + x;
const inb = (c: Ctx, x: number, y: number) => x >= 0 && y >= 0 && x < c.w && y < c.h;

function setT(c: Ctx, x: number, y: number, t: number): void {
  if (inb(c, x, y)) c.terrain[idx(c, x, y)] = t;
}

function reserve(c: Ctx, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(c, x, y)) c.reserved[idx(c, x, y)] = 1;
}

function place(c: Ctx, type: string, x: number, y: number, extra: Partial<WorldObject> = {}): WorldObject | undefined {
  const d = objectDef(type);
  const w = d.w ?? 1;
  const h = d.h ?? 1;
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) {
      if (!inb(c, x + dx, y + dy)) return undefined;
      if (c.occ[idx(c, x + dx, y + dy)]) return undefined;
    }
  const o: WorldObject = { id: c.nextId++, type, x, y, v: (rand3(c.seed, x, y, 77) * 256) | 0, ...extra };
  c.objects[o.id] = o;
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) c.occ[idx(c, x + dx, y + dy)] = o.id;
  return o;
}

function blob(c: Ctx, cx: number, cy: number, r: number, fn: (x: number, y: number, d: number) => void, noiseSeed = 0): void {
  const R = Math.ceil(r * 1.4);
  for (let y = cy - R; y <= cy + R; y++)
    for (let x = cx - R; x <= cx + R; x++) {
      if (!inb(c, x, y)) continue;
      const n = valueNoise(c.seed + 991 + noiseSeed, x / 5, y / 5);
      const d = Math.hypot(x - cx, y - cy) / (r * (0.75 + 0.5 * n));
      if (d < 1) fn(x, y, d);
    }
}

/** Carve a wobbly line between two points. */
function carve(c: Ctx, ax: number, ay: number, bx: number, by: number, width: number, t: number, wobble: number, overWater: number | null): void {
  const len = Math.hypot(bx - ax, by - ay);
  const steps = Math.ceil(len * 2);
  const nx = -(by - ay) / (len || 1);
  const ny = (bx - ax) / (len || 1);
  const salt = hashString(`${ax},${ay},${bx},${by}`) % 1000;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const fade = Math.sin(f * Math.PI);
    const off = (valueNoise(c.seed + salt, f * len / 14, 3.3) - 0.5) * 2 * wobble * fade;
    const px = ax + (bx - ax) * f + nx * off;
    const py = ay + (by - ay) * f + ny * off;
    const r = width / 2;
    for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++)
      for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
        if (!inb(c, x, y)) continue;
        if ((x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2 > r * r + 0.3) continue;
        const cur = c.terrain[idx(c, x, y)];
        if (cur === T.WALL || cur === T.FLOOR || cur === T.CONCRETE) continue;
        if (isWater(cur)) {
          if (overWater !== null) c.terrain[idx(c, x, y)] = overWater;
        } else c.terrain[idx(c, x, y)] = t;
        c.reserved[idx(c, x, y)] = 1;
      }
  }
}

interface FurnitureSpec {
  type: string;
  dx: number;
  dy: number;
  loot?: string;
  doc?: string;
}

function stampBuilding(c: Ctx, kind: string, name: string, x: number, y: number, w: number, h: number, floor: number, furniture: FurnitureSpec[]): BuildingPOI {
  // clear area with margin
  for (let ty = y - 2; ty < y + h + 2; ty++)
    for (let tx = x - 2; tx < x + w + 2; tx++) {
      if (!inb(c, tx, ty)) continue;
      const t = c.terrain[idx(c, tx, ty)];
      if (isWater(t) || t === T.FOREST || t === T.ROCK || t === T.MUD) c.terrain[idx(c, tx, ty)] = T.GRASS;
      c.reserved[idx(c, tx, ty)] = 1;
    }
  for (let ty = y; ty < y + h; ty++)
    for (let tx = x; tx < x + w; tx++) {
      const edge = tx === x || ty === y || tx === x + w - 1 || ty === y + h - 1;
      setT(c, tx, ty, edge ? T.WALL : floor);
    }
  const doorX = x + Math.floor(w / 2);
  const doorY = y + h - 1;
  setT(c, doorX, doorY, floor);
  setT(c, doorX, doorY + 1, T.PATH);
  const b: BuildingPOI = { id: c.nextId++, kind, name, x, y, w, h, doorX, doorY, discovered: false };
  c.buildings.push(b);
  for (const f of furniture) {
    place(c, f.type, x + f.dx, y + f.dy, { ...(f.loot ? { lootTable: f.loot } : {}), ...(f.doc ? { doc: f.doc } : {}) });
  }
  return b;
}

/**
 * Dense forest can seal off small pockets of ground. Make every walkable tile
 * reachable from the start by clearing single natural obstacles (trees,
 * boulders, bushes) between isolated pockets and the connected area.
 */
function openPockets(c: Ctx, sx: number, sy: number): void {
  const N = c.w * c.h;
  const blocked = (i: number): boolean => {
    if (!terrainDef(c.terrain[i]).walkable) return true;
    const id = c.occ[i];
    return !!id && objectDef(c.objects[id].type).solid;
  };
  const removable = (i: number): boolean => {
    const id = c.occ[i];
    if (!id || !terrainDef(c.terrain[i]).walkable) return false;
    const k = objectDef(c.objects[id].type).kind;
    return k === 'tree' || k === 'rock' || k === 'plant' || k === 'resource' || k === 'decor';
  };
  const reach = new Uint8Array(N);
  const stack: number[] = [];
  for (let iter = 0; iter < 40; iter++) {
    reach.fill(0);
    const s0 = sy * c.w + sx;
    reach[s0] = 1;
    stack.push(s0);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % c.w;
      const y = (i / c.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= c.w || ny >= c.h) continue;
        const j = ny * c.w + nx;
        if (reach[j] || blocked(j)) continue;
        reach[j] = 1;
        stack.push(j);
      }
    }
    let changed = 0;
    for (let i = 0; i < N; i++) {
      if (reach[i] || blocked(i)) continue;
      const x = i % c.w;
      const y = (i / c.w) | 0;
      // an unreachable open tile: clear one obstacle toward reachable ground
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= c.w - 1 || ny >= c.h - 1) continue;
        const j = ny * c.w + nx;
        if (!removable(j)) continue;
        const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ex, ey]) => reach[(ny + ey) * c.w + nx + ex]);
        if (!touches) continue;
        const id = c.occ[j];
        const o = c.objects[id];
        const d = objectDef(o.type);
        for (let fy = 0; fy < (d.h ?? 1); fy++) for (let fx = 0; fx < (d.w ?? 1); fx++) c.occ[(o.y + fy) * c.w + o.x + fx] = 0;
        delete c.objects[id];
        changed++;
        break;
      }
    }
    if (!changed) break;
  }
}

function streamX(c: Ctx, startX: number, y: number): number {
  return startX + (valueNoise(c.seed + 55, 0.5, y / 38) - 0.5) * 70 + (valueNoise(c.seed + 56, 1.5, y / 11) - 0.5) * 8;
}

export interface WorldOptions {
  seed: number;
  mode: GameMode;
  playerId: string;
  worldName?: string;
}

export function generateWorld(opts: WorldOptions): GameState {
  const { seed, mode } = opts;
  const W = WORLD_SIZE;
  const H = WORLD_SIZE;
  const c: Ctx = {
    seed,
    rng: new Rng(seed ^ 0xa11ce),
    w: W,
    h: H,
    terrain: new Uint8Array(W * H).fill(T.FOREST),
    reserved: new Uint8Array(W * H),
    objects: {},
    occ: new Int32Array(W * H),
    buildings: [],
    nextId: 1,
  };
  const rng = c.rng;

  // --- Base: forest with meadows and clearings ---------------------------
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const m = fbm(seed + 1, x / 46, y / 46, 4);
      if (m > 0.63) setT(c, x, y, T.GRASS);
      const mud = fbm(seed + 3, x / 12, y / 12, 2);
      if (mud > 0.8 && m < 0.63) setT(c, x, y, T.MUD);
    }

  // --- Rocky outcrop -----------------------------------------------------
  const rockX = rng.int(120, 160);
  const rockY = rng.int(40, 70);
  blob(c, rockX, rockY, rng.int(9, 13), (x, y) => setT(c, x, y, T.ROCK), 3);

  // --- Lake in the north-east feeding a stream -------------------------
  const lakeX = rng.int(215, 245);
  const lakeY = rng.int(45, 75);
  const lakeR = rng.int(12, 16);
  blob(c, lakeX, lakeY, lakeR, (x, y, d) => setT(c, x, y, d < 0.7 ? T.DEEP : T.SHALLOW), 1);
  // stream: from the lake outlet south-west then south across the map
  const streamStart = rng.int(150, 185);
  let prevX = lakeX - lakeR + 2;
  let prevY = lakeY + Math.floor(lakeR * 0.6);
  const streamPts: [number, number][] = [];
  for (let y = prevY; y < H; y++) {
    const blend = Math.min(1, (y - prevY) / 60);
    const sx = (lakeX - lakeR * 0.5) * (1 - blend) + streamX(c, streamStart, y) * blend;
    streamPts.push([sx, y]);
  }
  for (const [sx, sy] of streamPts) {
    const width = 1.6 + valueNoise(seed + 60, sy / 20, 0) * 1.4;
    for (let x = Math.floor(sx - width / 2); x <= Math.ceil(sx + width / 2); x++) setT(c, x, sy, T.STREAM);
    // occasional pools
    if (rand3(seed, sy, 0, 61) < 0.012) blob(c, Math.round(sx), sy, 2.6, (x, y) => setT(c, x, y, T.SHALLOW), sy);
    // gravel banks
    if (rand3(seed, sy, 1, 62) < 0.2) setT(c, Math.round(sx + width / 2 + 1), sy, T.GRAVEL);
  }
  void prevX;
  const streamAt = (y: number): number => {
    const p = streamPts.find((q) => q[1] === y);
    return p ? p[0] : streamX(c, streamStart, y);
  };

  // --- Ponds -------------------------------------------------------------
  const pond1 = { x: rng.int(40, 70), y: rng.int(40, 70) };
  blob(c, pond1.x, pond1.y, 4.5, (x, y, d) => setT(c, x, y, d < 0.45 ? T.DEEP : T.SHALLOW), 5);
  const pond2 = { x: rng.int(90, 130), y: rng.int(225, 255) };
  blob(c, pond2.x, pond2.y, 5.5, (x, y, d) => setT(c, x, y, d < 0.5 ? T.DEEP : T.SHALLOW), 6);

  // --- Farmland in the east ----------------------------------------------
  const farmX = rng.int(236, 250);
  const farmY = rng.int(205, 225);
  for (let y = farmY - 20; y < farmY + 40; y++)
    for (let x = farmX - 26; x < W - 12; x++) {
      if (!inb(c, x, y) || isWater(c.terrain[idx(c, x, y)])) continue;
      const edge = valueNoise(seed + 70, x / 9, y / 9);
      if (edge > 0.3) setT(c, x, y, ((x >> 3) + (y >> 4)) % 3 === 0 ? T.GRASS : T.FIELD);
    }

  // --- Main road on the east edge ----------------------------------------
  const roadX = (y: number) => W - 26 + (valueNoise(seed + 80, 0, y / 50) - 0.5) * 14;
  for (let y = 0; y < H; y += 1) carve(c, roadX(y), y, roadX(y + 1), y + 1, 4.2, T.ROAD, 0, T.CONCRETE);

  // --- POIs ----------------------------------------------------------------
  // the class starts in the forest, a short but not obvious walk from the stream
  const startY = rng.int(150, 190);
  const start = { x: Math.max(22, Math.round(streamAt(startY)) - rng.int(26, 34)), y: startY };
  // a wide open clearing: grass all round, the middle kept completely free
  blob(c, start.x, start.y, 14, (x, y) => {
    if (!isWater(c.terrain[idx(c, x, y)])) setT(c, x, y, T.GRASS);
  }, 9);
  blob(c, start.x, start.y, 7, (x, y) => {
    c.reserved[idx(c, x, y)] = 1;
  }, 10);

  // Grillstelle (forest barbecue spot) beside the stream
  const gy = start.y + rng.int(-12, 12);
  const gx = Math.round(streamAt(gy)) - 7;
  blob(c, gx, gy, 5, (x, y) => {
    if (!isWater(c.terrain[idx(c, x, y)])) {
      setT(c, x, y, T.GRASS);
      c.reserved[idx(c, x, y)] = 1;
    }
  }, 10);
  place(c, 'fire_pit', gx, gy, { s: 0, lit: false, s2: 2 });
  place(c, 'bench', gx - 2, gy);
  place(c, 'bench', gx + 2, gy);
  place(c, 'bench', gx, gy - 2);
  place(c, 'sign', gx - 3, gy + 3, { doc: 'common_3' });
  place(c, 'crate', gx + 3, gy - 3, { lootTable: 'camp_crate' });

  // Forest hut near the first pond
  const hutX = pond1.x + 8;
  const hutY = pond1.y - 3;
  stampBuilding(c, 'forest_hut', 'Forest Hut', hutX, hutY, 7, 5, T.FLOOR, [
    { type: 'stove', dx: 1, dy: 1 },
    { type: 'cupboard', dx: 2, dy: 1, loot: 'cabin', doc: 'forester' },
    { type: 'wardrobe', dx: 4, dy: 1, loot: 'wardrobe' },
    { type: 'bed', dx: 5, dy: 2 },
    { type: 'table', dx: 1, dy: 3 },
  ]);

  // Forester's shed on a gravel forest road
  const shedX = rng.int(190, 210);
  const shedY = rng.int(105, 125);
  stampBuilding(c, 'forester_shed', 'Forestry Shed', shedX, shedY, 8, 5, T.CONCRETE, [
    { type: 'toolbox', dx: 1, dy: 1, loot: 'tools' },
    { type: 'shelf', dx: 3, dy: 1, loot: 'shed' },
    { type: 'crate', dx: 6, dy: 1, loot: 'shed' },
    { type: 'shelf', dx: 6, dy: 3, loot: 'first_aid' },
  ]);
  for (let i = 0; i < 4; i++) place(c, 'fallen_log', shedX + 9, shedY + i);

  // Farm
  stampBuilding(c, 'farmhouse', 'Farmhouse', farmX, farmY, 9, 6, T.FLOOR, [
    { type: 'stove', dx: 1, dy: 1 },
    { type: 'cupboard', dx: 2, dy: 1, loot: 'kitchen' },
    { type: 'fridge', dx: 3, dy: 1, loot: 'fridge' },
    { type: 'table', dx: 2, dy: 3 },
    { type: 'wardrobe', dx: 6, dy: 1, loot: 'wardrobe' },
    { type: 'bed', dx: 7, dy: 2 },
    { type: 'bed', dx: 7, dy: 3 },
    { type: 'shelf', dx: 5, dy: 1, loot: 'first_aid' },
  ]);
  stampBuilding(c, 'barn', 'Barn', farmX + 12, farmY + 12, 10, 7, T.CONCRETE, [
    { type: 'hay', dx: 1, dy: 1 },
    { type: 'hay', dx: 2, dy: 1 },
    { type: 'shelf', dx: 4, dy: 1, loot: 'farm_shelf' },
    { type: 'toolbox', dx: 6, dy: 1, loot: 'tools' },
    { type: 'crate', dx: 8, dy: 1, loot: 'barn' },
    { type: 'crate', dx: 8, dy: 4, loot: 'barn' },
  ]);
  for (let i = 0; i < 12; i++) place(c, 'fence', farmX - 3 + i, farmY + 9);

  // Pumping station (industrial remnant) by the stream in the south
  const py = rng.int(270, 292);
  const px = Math.round(streamAt(py)) + 5;
  stampBuilding(c, 'pump_station', 'Pumping Station', px, py, 6, 4, T.CONCRETE, [
    { type: 'toolbox', dx: 1, dy: 1, loot: 'industrial' },
    { type: 'shelf', dx: 4, dy: 1, loot: 'industrial' },
  ]);

  // Abandoned campsite of earlier survivors
  const campX = rng.int(28, 50);
  const campY = rng.int(265, 290);
  blob(c, campX, campY, 4, (x, y) => {
    if (!isWater(c.terrain[idx(c, x, y)])) setT(c, x, y, T.GRASS);
    c.reserved[idx(c, x, y)] = 1;
  }, 11);
  place(c, 'campfire', campX, campY, { s: 0, lit: false });
  place(c, 'tarp_shelter', campX + 2, campY - 3);
  place(c, 'crate', campX - 2, campY + 1, { lootTable: 'camp_crate' });

  // --- Roads and paths ---------------------------------------------------
  const forestRoadY = shedY + 6;
  carve(c, roadX(forestRoadY), forestRoadY, shedX + 4, forestRoadY, 3.6, T.GRAVEL, 4, T.CONCRETE);
  carve(c, shedX + 4, forestRoadY, gx + 6, gy - 20, 3.4, T.GRAVEL, 12, T.CONCRETE);
  carve(c, roadX(farmY + 7), farmY + 7, farmX + 4, farmY + 7, 3.6, T.GRAVEL, 3, T.CONCRETE);
  carve(c, start.x, start.y, gx, gy, 3, T.PATH, 6, null);
  carve(c, start.x, start.y, hutX + 3, hutY + 6, 2.8, T.PATH, 14, null);
  carve(c, gx, gy, gx + 6, gy - 20, 2.8, T.PATH, 4, null);
  carve(c, start.x, start.y, campX, campY, 2.6, T.PATH, 18, null);
  carve(c, gx, gy, px, py + 5, 2.6, T.PATH, 16, null);
  carve(c, gx + 6, gy - 20, rockX, rockY + 12, 2.4, T.PATH, 10, null);

  // Cars abandoned on the road
  for (let i = 0; i < 3; i++) {
    const cy = rng.int(20, H - 20);
    place(c, 'car_wreck', Math.round(roadX(cy)) - 1, cy, { lootTable: 'car' });
  }

  // Hunting stands on meadow edges
  let stands = 0;
  for (let tries = 0; tries < 4000 && stands < 3; tries++) {
    const x = rng.int(10, W - 40);
    const y = rng.int(10, H - 10);
    if (c.terrain[idx(c, x, y)] !== T.FOREST || c.reserved[idx(c, x, y)]) continue;
    if (c.terrain[idx(c, x, y + 2)] !== T.GRASS) continue;
    if (Math.hypot(x - start.x, y - start.y) < 25) continue;
    if (place(c, 'hunting_stand', x, y)) {
      reserve(c, x - 1, y - 1, x + 1, y + 1);
      stands++;
    }
  }

  // --- Natural scatter -----------------------------------------------------
  const nearWater = (x: number, y: number, r: number): boolean => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inb(c, x + dx, y + dy) && isWater(c.terrain[idx(c, x + dx, y + dy)])) return true;
    return false;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(c, x, y);
      if (c.reserved[i] || c.occ[i]) continue;
      const t = c.terrain[i];
      const r = rand3(seed, x, y, 1);
      const r2 = rand3(seed, x, y, 2);
      const dens = fbm(seed + 7, x / 26, y / 26, 3);
      const zone = fbm(seed + 9, x / 34, y / 34, 3);
      if (t === T.FOREST) {
        // open woodland rather than a wall of trunks; thinner still near the start
        const fromStart = Math.hypot(x - start.x, y - start.y);
        const nearStart = fromStart < 28 ? 0.35 + 0.65 * Math.max(0, (fromStart - 14) / 14) : 1;
        const pTree = (0.05 + dens * 0.17) * nearStart;
        if (r < pTree) {
          let type = 'spruce';
          if (zone > 0.57) type = r2 < 0.85 ? 'beech' : 'oak';
          else if (zone < 0.36) type = r2 < 0.7 ? 'pine' : 'spruce';
          else if (r2 < 0.12) type = 'birch';
          place(c, type, x, y);
          continue;
        }
        const u = rand3(seed, x, y, 3);
        if (u < 0.035) place(c, 'deadfall', x, y, { s: 3 });
        else if (u < 0.1 && zone > 0.45) place(c, 'fern', x, y);
        else if (u < 0.13 && zone < 0.55) place(c, 'bilberry', x, y, { s: 1 });
        else if (u < 0.14) place(c, 'rocks', x, y, { s: 2 });
        else if (u < 0.155) place(c, 'nettles', x, y, { s: 1 });
        else if (u < 0.165) place(c, 'hazel', x, y, { s: 1 });
        else if (u < 0.17) place(c, 'fallen_log', x, y);
        else if (u < 0.19 && zone > 0.52 && nearWater(x, y, 10)) place(c, 'wild_garlic', x, y, { s: 1 });
        else if (u < 0.197) place(c, 'mushrooms', x, y, { s: 0 });
        else if (u < 0.22) place(c, 'bush', x, y);
      } else if (t === T.GRASS) {
        const u = rand3(seed, x, y, 4);
        if (u < 0.012) place(c, r2 < 0.5 ? 'oak' : 'birch', x, y);
        else if (u < 0.1) place(c, 'tall_grass', x, y, { s: 1 });
        else if (u < 0.15) place(c, 'flowers', x, y);
        else if (u < 0.165) place(c, 'bramble', x, y, { s: 1 });
        else if (u < 0.175) place(c, 'bush', x, y);
      } else if (t === T.ROCK) {
        const u = rand3(seed, x, y, 5);
        if (u < 0.12) place(c, 'boulder', x, y);
        else if (u < 0.25) place(c, 'rocks', x, y, { s: 3 });
        else if (u < 0.3) place(c, 'pine', x, y);
      } else if (t === T.FIELD) {
        const u = rand3(seed, x, y, 6);
        if (u < 0.05) place(c, 'tall_grass', x, y, { s: 1 });
      } else if (t === T.MUD) {
        if (rand3(seed, x, y, 7) < 0.06) place(c, 'reeds', x, y, { s: 1 });
      }
      // reeds along water
      if ((t === T.GRASS || t === T.FOREST || t === T.MUD) && !c.occ[i] && rand3(seed, x, y, 8) < 0.22 && nearWater(x, y, 1)) {
        place(c, 'reeds', x, y, { s: 1 });
      }
    }

  openPockets(c, start.x, start.y);

  // --- Characters ------------------------------------------------------------
  const roster = generateRoster(seed, mode);
  const characters: GameState['characters'] = {};
  roster.forEach((ch, i) => {
    const a = (i / roster.length) * Math.PI * 2;
    ch.x = start.x + 0.5 + Math.cos(a) * 3.2;
    ch.y = start.y + 0.5 + Math.sin(a) * 2.6;
    ch.facing = 'down';
    characters[ch.id] = ch;
  });

  // Group supplies bag at the start
  const supplies: ItemStack[] = [
    makeStack('ration', mode === 'hardcore' ? 6 : 10),
    makeStack('canned_beans', mode === 'hardcore' ? 3 : 6),
    makeStack('pasta', 2),
    makeStack('cooking_pot', 1),
    makeStack('tarp', 2),
    makeStack('rope', 2),
    makeStack('matches', 1),
    makeStack('hatchet', 1),
    makeStack('folding_shovel', 1),
    makeStack('bandage', 6),
    makeStack('antiseptic', 1),
    makeStack('painkillers', 10),
    makeStack('purify_tablets', mode === 'hardcore' ? 5 : 12),
    makeStack('sleeping_bag', 1),
    makeStack('sleeping_bag', 1),
    makeStack('sleeping_bag', 1),
    makeStack('fishing_hooks', 6),
    makeStack('soap', 1),
    makeStack('water_bottle', 1, { liquid: { ml: 1000, contam: 0 } }),
    makeStack('map', 1),
  ];
  const bagInv: (ItemStack | null)[] = new Array(20).fill(null);
  supplies.forEach((s, i) => (bagInv[i] = s));
  place(c, 'supply_bag', start.x + 1, start.y - 1, { inv: bagInv });

  // --- Animals -------------------------------------------------------------
  const animals: Record<number, Animal> = {};
  const populations: GameState['populations'] = {};
  for (const def of Object.values(ANIMALS)) {
    const groups = Math.max(1, Math.round((def.cap * 0.7) / ((def.groupSize[0] + def.groupSize[1]) / 2)));
    let count = 0;
    for (let g = 0; g < groups; g++) {
      let hx = 0;
      let hy = 0;
      for (let tries = 0; tries < 200; tries++) {
        hx = rng.int(8, W - 8);
        hy = rng.int(8, H - 8);
        const t = c.terrain[idx(c, hx, hy)];
        if ((t === T.FOREST || t === T.GRASS) && !c.occ[idx(c, hx, hy)] && Math.hypot(hx - start.x, hy - start.y) > 30) break;
      }
      const n = rng.int(def.groupSize[0], def.groupSize[1]);
      for (let k = 0; k < n; k++) {
        const id = c.nextId++;
        animals[id] = {
          id, species: def.id, x: hx + rng.range(-2, 2), y: hy + rng.range(-2, 2), homeX: hx, homeY: hy, facing: 'down',
          state: 'idle', hp: def.hp, hunger: rng.range(0, 40), thirst: rng.range(0, 40), timer: 0, fear: 0, moving: false,
        };
        count++;
      }
    }
    populations[def.id] = { count, cap: def.cap };
  }

  // fish stocks per water body are computed lazily by label; seed a default
  const cause = LORE_CAUSES[seed % LORE_CAUSES.length].id;

  const contamination = new Float32Array(Math.ceil(W / CONTAM_CELL) * Math.ceil(H / CONTAM_CELL));
  const explored = new Uint8Array(W * H);

  const state: GameState = {
    saveVersion: SAVE_VERSION,
    seed,
    mode,
    worldName: opts.worldName ?? `Hardwald ${seed.toString(36).toUpperCase().slice(-4)}`,
    createdAt: Date.now(),
    // the story starts a few days into spring, early in the morning
    time: START_TIME,
    startTime: START_TIME,
    weather: {
      current: 'cloudy', since: 0, temp: 9, anomaly: 0, wind: 2, windDir: rng.range(0, Math.PI * 2),
      precipitation: 0, visibility: 1, dryness: 0.4, snowDepth: 0, nextLightning: 0,
    },
    width: W,
    height: H,
    terrain: c.terrain,
    explored,
    contamination,
    objects: c.objects,
    buildings: c.buildings,
    characters,
    playerId: opts.playerId in characters ? opts.playerId : roster[0].id,
    animals,
    populations,
    fishStock: {},
    startPoint: start,
    markers: [],
    expeditions: [],
    relationships: {},
    journal: [],
    lore: { cause, found: [] },
    hints: [],
    nextId: c.nextId,
    stats: { deaths: 0, daysSurvived: 0, structuresBuilt: 0 },
  };
  return state;
}
