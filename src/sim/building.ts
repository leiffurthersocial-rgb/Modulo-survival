import { objectDef } from '@/content/objects';
import { itemDef } from '@/content/items';
import { T, isWater, terrainDef } from '@/content/terrain';
import type { Game } from './game';
import type { Character, WorldObject } from './types';
import { countItem, removeItem, addItem } from './inventory';
import { dropItems } from './actions';

export const BUILD_REACH = 4.5;

export interface PlacementCheck {
  ok: boolean;
  reason?: string;
  warn?: string;
}

/** Materials available to a builder: their inventory plus nearby storage. */
export function availableMaterial(game: Game, c: Character, id: string): number {
  let n = countItem(c.inventory, id);
  game.index.objectsNear(c.x, c.y, 6, (o) => {
    if (o.inv && o.build === undefined && o.type !== 'corpse') n += countItem(o.inv, id);
  });
  return n;
}

export function missingMaterials(game: Game, c: Character, type: string): string[] {
  const b = objectDef(type).build;
  if (!b) return ['not buildable'];
  const out: string[] = [];
  for (const [id, n] of Object.entries(b.materials)) {
    const have = availableMaterial(game, c, id);
    if (have < n) out.push(`${itemDef(id).name} ${have}/${n}`);
  }
  return out;
}

export function checkPlacement(game: Game, c: Character, type: string, x: number, y: number): PlacementCheck {
  const def = objectDef(type);
  const b = def.build;
  if (!b) return { ok: false, reason: 'Cannot be built.' };
  const w = def.w ?? 1;
  const h = def.h ?? 1;
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (Math.hypot(cx - c.x, cy - c.y) > BUILD_REACH + Math.max(w, h) / 2) return { ok: false, reason: 'Too far away.' };
  const idx = game.index;
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!idx.inBounds(tx, ty)) return { ok: false, reason: 'Out of bounds.' };
      const t = idx.terrainAt(tx, ty);
      const td = terrainDef(t);
      if (isWater(t)) return { ok: false, reason: 'Cannot build in water.' };
      if (b.on === 'floor') {
        if (t !== T.FLOOR && t !== T.CONCRETE) return { ok: false, reason: 'A roof needs a floor or foundation below it.' };
      } else if (b.on === 'soil') {
        if (!td.soil) return { ok: false, reason: 'The ground here is not suitable for planting.' };
      } else if (!td.buildable) return { ok: false, reason: `Cannot build on ${td.name.toLowerCase()}.` };
      if (idx.tileObj[ty * idx.w + tx]) return { ok: false, reason: 'Something is in the way.' };
      if (idx.buildingAt(tx, ty) && type !== 'roof' && def.solid) return { ok: false, reason: 'Not inside an existing building.' };
      if (def.solid) {
        for (const ch of game.livingCharacters()) {
          if (Math.floor(ch.x) === tx && Math.floor(ch.y) === ty) return { ok: false, reason: 'Someone is standing there.' };
        }
      }
    }
  const missing = missingMaterials(game, c, type);
  if (missing.length) return { ok: false, reason: `Missing: ${missing.join(', ')}` };
  let warn: string | undefined;
  if (b.warnNearWater) {
    const near = idx.findTileNear(cx, cy, b.warnNearWater, (tx, ty) => isWater(idx.terrainAt(tx, ty)));
    if (near) warn = 'This is close to water. Waste will seep into it.';
  }
  if (def.fire && !def.fire.safe) {
    const flam = idx.findTileNear(cx, cy, 1, (tx, ty) => {
      const o = idx.objAt(tx, ty);
      return !!o && !!objectDef(o.type).flammable;
    });
    if (flam) warn = 'Vegetation is close. Sparks may spread in dry weather.';
  }
  if (b.tool) {
    const has = c.inventory.some((s) => s && itemDef(s.id).tool?.tags.includes(b.tool!));
    if (!has) warn = `You will need a tool (${b.tool}) to build this.`;
  }
  return { ok: true, warn };
}

function consume(game: Game, c: Character, id: string, n: number): void {
  const fromInv = Math.min(n, countItem(c.inventory, id));
  removeItem(c.inventory, id, fromInv);
  let left = n - fromInv;
  if (left <= 0) return;
  game.index.objectsNear(c.x, c.y, 6, (o) => {
    if (left <= 0 || !o.inv || o.build !== undefined || o.type === 'corpse') return;
    const got = removeItem(o.inv, id, left);
    for (const s of got) left -= s.qty;
  });
}

/** Places a construction site. Materials are committed immediately. */
export function placeStructure(game: Game, c: Character, type: string, x: number, y: number): WorldObject | null {
  const check = checkPlacement(game, c, type, x, y);
  if (!check.ok) {
    game.charMessage(c, check.reason ?? 'Cannot build here.', 'warn');
    return null;
  }
  const b = objectDef(type).build!;
  for (const [id, n] of Object.entries(b.materials)) consume(game, c, id, n);
  const o = game.index.addObject({ type, x, y, build: 0, v: game.rng.int(0, 255) });
  game.charMessage(c, `Construction site placed: ${objectDef(type).name}. Work on it to finish.`, 'info');
  if (check.warn) game.charMessage(c, check.warn, 'warn');
  return o;
}

/** Cancel a site or dismantle a finished structure, refunding materials. */
export function dismantle(game: Game, c: Character, o: WorldObject): void {
  const def = objectDef(o.type);
  const b = def.build;
  if (!b) return;
  const share = o.build !== undefined ? 1 : 0.5;
  const out = Object.entries(b.materials)
    .map(([id, n]) => ({ id, qty: Math.floor(n * share) }))
    .filter((s) => s.qty > 0);
  const contents = (o.inv ?? []).filter(Boolean) as { id: string; qty: number }[];
  game.index.removeObject(o.id);
  const stacks = [...out, ...contents];
  const left = stacks.map((s) => addItem(c.inventory, s)).filter(Boolean) as { id: string; qty: number }[];
  if (left.length) dropItems(game, o.x + 0.5, o.y + 0.5, left);
  game.charMessage(c, o.build !== undefined ? 'Construction cancelled. Materials recovered.' : `Dismantled the ${def.name.toLowerCase()}.`, 'info');
}

/** Floors and foundations become terrain once finished. */
export function finalizeTerrainStructure(game: Game, o: WorldObject): boolean {
  if (o.type === 'plank_floor' || o.type === 'foundation') {
    game.index.removeObject(o.id);
    game.index.setTerrain(o.x, o.y, o.type === 'plank_floor' ? T.FLOOR : T.CONCRETE);
    return true;
  }
  return false;
}
