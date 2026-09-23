import { objectDef } from '@/content/objects';
import { T, isWater, terrainDef } from '@/content/terrain';
import type { GameState, WorldObject } from './types';

export const CONTAM_CELL = 8;

/**
 * Runtime indices over GameState for fast spatial queries. Rebuilt on load;
 * never serialized.
 */
export class WorldIndex {
  readonly w: number;
  readonly h: number;
  /** object id occupying a tile (0 = none) */
  tileObj: Int32Array;
  /** 1 = blocked */
  solid: Uint8Array;
  /** connected water body label (0 = none) */
  waterLabel: Int32Array;
  byType = new Map<string, Set<number>>();
  /** unfinished construction sites */
  sites = new Set<number>();
  /** incremented when solidity changes (invalidates cached paths) */
  version = 0;
  /** tiles whose terrain/objects changed; renderers invalidate cached chunks */
  dirtyTiles: number[] = [];

  constructor(public state: GameState) {
    this.w = state.width;
    this.h = state.height;
    this.tileObj = new Int32Array(this.w * this.h);
    this.solid = new Uint8Array(this.w * this.h);
    this.waterLabel = new Int32Array(this.w * this.h);
    this.rebuild();
  }

  rebuild(): void {
    this.tileObj.fill(0);
    this.byType.clear();
    this.sites.clear();
    for (const k in this.state.objects) {
      const o = this.state.objects[k];
      this.indexObject(o);
    }
    this.recomputeSolid();
    this.labelWater();
  }

  private indexObject(o: WorldObject): void {
    const d = objectDef(o.type);
    const w = d.w ?? 1;
    const h = d.h ?? 1;
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) {
        const x = o.x + dx;
        const y = o.y + dy;
        if (this.inBounds(x, y)) this.tileObj[y * this.w + x] = o.id;
      }
    let set = this.byType.get(o.type);
    if (!set) this.byType.set(o.type, (set = new Set()));
    set.add(o.id);
    if (o.build !== undefined) this.sites.add(o.id);
  }

  private unindexObject(o: WorldObject): void {
    const d = objectDef(o.type);
    const w = d.w ?? 1;
    const h = d.h ?? 1;
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) {
        const x = o.x + dx;
        const y = o.y + dy;
        if (this.inBounds(x, y) && this.tileObj[y * this.w + x] === o.id) this.tileObj[y * this.w + x] = 0;
      }
    this.byType.get(o.type)?.delete(o.id);
    this.sites.delete(o.id);
  }

  recomputeSolid(): void {
    const { terrain } = this.state;
    for (let i = 0; i < terrain.length; i++) {
      let s = terrainDef(terrain[i]).walkable ? 0 : 1;
      const oid = this.tileObj[i];
      if (oid) {
        const o = this.state.objects[oid];
        if (o && this.objectSolid(o)) s = 1;
      }
      this.solid[i] = s;
    }
    this.version++;
  }

  objectSolid(o: WorldObject): boolean {
    const d = objectDef(o.type);
    if (o.build !== undefined) return false; // construction sites are walkable
    return d.solid;
  }

  private updateSolidAt(x: number, y: number): void {
    const i = y * this.w + x;
    let s = terrainDef(this.state.terrain[i]).walkable ? 0 : 1;
    const oid = this.tileObj[i];
    if (oid) {
      const o = this.state.objects[oid];
      if (o && this.objectSolid(o)) s = 1;
    }
    if (this.solid[i] !== s) {
      this.solid[i] = s;
      this.version++;
    }
    this.dirtyTiles.push(i);
  }

  /** tile count per water body label */
  waterSize = new Map<number, number>();

  labelWater(): void {
    const { terrain } = this.state;
    this.waterLabel.fill(0);
    this.waterSize.clear();
    let label = 0;
    const stack: number[] = [];
    for (let i = 0; i < terrain.length; i++) {
      if (this.waterLabel[i] || !isWater(terrain[i])) continue;
      label++;
      stack.push(i);
      this.waterLabel[i] = label;
      let size = 0;
      while (stack.length) {
        const j = stack.pop()!;
        size++;
        this.waterSize.set(label, size);
        const x = j % this.w;
        const y = (j / this.w) | 0;
        const n = [x > 0 ? j - 1 : -1, x < this.w - 1 ? j + 1 : -1, y > 0 ? j - this.w : -1, y < this.h - 1 ? j + this.w : -1];
        for (const k of n) {
          if (k >= 0 && !this.waterLabel[k] && isWater(terrain[k])) {
            this.waterLabel[k] = label;
            stack.push(k);
          }
        }
      }
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  terrainAt(x: number, y: number): number {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inBounds(x, y)) return T.DEEP;
    return this.state.terrain[y * this.w + x];
  }

  setTerrain(x: number, y: number, t: number): void {
    if (!this.inBounds(x, y)) return;
    this.state.terrain[y * this.w + x] = t;
    this.updateSolidAt(x, y);
  }

  isSolid(x: number, y: number): boolean {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inBounds(x, y)) return true;
    return this.solid[y * this.w + x] === 1;
  }

  objAt(x: number, y: number): WorldObject | undefined {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inBounds(x, y)) return undefined;
    const id = this.tileObj[y * this.w + x];
    return id ? this.state.objects[id] : undefined;
  }

  addObject(o: Omit<WorldObject, 'id'> & { id?: number }): WorldObject {
    const obj = { ...o, id: o.id ?? this.state.nextId++ } as WorldObject;
    this.state.objects[obj.id] = obj;
    this.indexObject(obj);
    const d = objectDef(obj.type);
    for (let dy = 0; dy < (d.h ?? 1); dy++) for (let dx = 0; dx < (d.w ?? 1); dx++) if (this.inBounds(obj.x + dx, obj.y + dy)) this.updateSolidAt(obj.x + dx, obj.y + dy);
    return obj;
  }

  removeObject(id: number): void {
    const o = this.state.objects[id];
    if (!o) return;
    this.unindexObject(o);
    delete this.state.objects[id];
    const d = objectDef(o.type);
    for (let dy = 0; dy < (d.h ?? 1); dy++) for (let dx = 0; dx < (d.w ?? 1); dx++) if (this.inBounds(o.x + dx, o.y + dy)) this.updateSolidAt(o.x + dx, o.y + dy);
  }

  /** Replace an object's type in place (tree -> stump etc.). */
  changeType(o: WorldObject, type: string): void {
    this.unindexObject(o);
    o.type = type;
    this.indexObject(o);
    const d = objectDef(type);
    for (let dy = 0; dy < (d.h ?? 1); dy++) for (let dx = 0; dx < (d.w ?? 1); dx++) if (this.inBounds(o.x + dx, o.y + dy)) this.updateSolidAt(o.x + dx, o.y + dy);
  }

  /** Refresh solidity after a state change like construction completion. */
  refreshObject(o: WorldObject): void {
    const d = objectDef(o.type);
    for (let dy = 0; dy < (d.h ?? 1); dy++) for (let dx = 0; dx < (d.w ?? 1); dx++) if (this.inBounds(o.x + dx, o.y + dy)) this.updateSolidAt(o.x + dx, o.y + dy);
  }

  /** Free tile check for placing a footprint. */
  isFree(x: number, y: number, w = 1, h = 1): boolean {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (!this.inBounds(tx, ty)) return false;
        if (this.tileObj[ty * this.w + tx]) return false;
        if (!terrainDef(this.state.terrain[ty * this.w + tx]).walkable) return false;
      }
    return true;
  }

  /** Nearest object of given types within radius, using the type index. */
  nearestOfType(types: string | string[], x: number, y: number, radius = 1e9, filter?: (o: WorldObject) => boolean): WorldObject | undefined {
    const list = Array.isArray(types) ? types : [types];
    let best: WorldObject | undefined;
    let bestD = radius * radius;
    for (const t of list) {
      const set = this.byType.get(t);
      if (!set) continue;
      for (const id of set) {
        const o = this.state.objects[id];
        if (!o) continue;
        const d = (o.x + 0.5 - x) ** 2 + (o.y + 0.5 - y) ** 2;
        if (d < bestD && (!filter || filter(o))) {
          bestD = d;
          best = o;
        }
      }
    }
    return best;
  }

  /** Ring scan for the nearest object matching a predicate (good for dense types like trees). */
  nearestObjectRing(x: number, y: number, radius: number, pred: (o: WorldObject) => boolean): WorldObject | undefined {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    for (let r = 0; r <= radius; r++) {
      let best: WorldObject | undefined;
      let bestD = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        const ty = cy + dy;
        if (ty < 0 || ty >= this.h) continue;
        const step = Math.abs(dy) === r ? 1 : 2 * r;
        for (let dx = -r; dx <= r; dx += step || 1) {
          const tx = cx + dx;
          if (tx < 0 || tx >= this.w) continue;
          const id = this.tileObj[ty * this.w + tx];
          if (!id) continue;
          const o = this.state.objects[id];
          if (o && pred(o)) {
            const d = dx * dx + dy * dy;
            if (d < bestD) {
              bestD = d;
              best = o;
            }
          }
        }
      }
      if (best) return best;
    }
    return undefined;
  }

  /** Spiral scan for tiles near (x,y) matching a predicate. */
  findTileNear(x: number, y: number, radius: number, pred: (tx: number, ty: number) => boolean): [number, number] | undefined {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    let best: [number, number] | undefined;
    let bestD = Infinity;
    for (let r = 0; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = cx + dx;
          const ty = cy + dy;
          if (!this.inBounds(tx, ty)) continue;
          if (pred(tx, ty)) {
            const d = dx * dx + dy * dy;
            if (d < bestD) {
              bestD = d;
              best = [tx, ty];
            }
          }
        }
      if (best && r * r > bestD) return best;
    }
    return best;
  }

  /** Scan objects in a square around a point. */
  objectsNear(x: number, y: number, r: number, cb: (o: WorldObject) => void): void {
    const x0 = Math.max(0, Math.floor(x - r));
    const x1 = Math.min(this.w - 1, Math.floor(x + r));
    const y0 = Math.max(0, Math.floor(y - r));
    const y1 = Math.min(this.h - 1, Math.floor(y + r));
    const seen = new Set<number>();
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const id = this.tileObj[ty * this.w + tx];
        if (id && !seen.has(id)) {
          seen.add(id);
          const o = this.state.objects[id];
          if (o) cb(o);
        }
      }
  }

  contamAt(x: number, y: number): number {
    const cw = Math.ceil(this.w / CONTAM_CELL);
    const cx = Math.floor(x / CONTAM_CELL);
    const cy = Math.floor(y / CONTAM_CELL);
    return this.state.contamination[cy * cw + cx] ?? 0;
  }

  addContam(x: number, y: number, v: number): void {
    const cw = Math.ceil(this.w / CONTAM_CELL);
    const cx = Math.floor(x / CONTAM_CELL);
    const cy = Math.floor(y / CONTAM_CELL);
    const i = cy * cw + cx;
    if (i >= 0 && i < this.state.contamination.length) this.state.contamination[i] = Math.min(1, this.state.contamination[i] + v);
  }

  /** Building footprint containing a point, if any. */
  buildingAt(x: number, y: number) {
    for (const b of this.state.buildings) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
    return undefined;
  }
}
