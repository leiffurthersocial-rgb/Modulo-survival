import { terrainDef } from '@/content/terrain';
import type { WorldIndex } from './world';

/**
 * Grid A* with an expansion budget. Paths are requested only when an NPC
 * picks a new target (never per frame) and are cached on the NPC.
 */
class MinHeap {
  keys: number[] = [];
  vals: number[] = [];
  push(k: number, v: number): void {
    const a = this.keys;
    const b = this.vals;
    a.push(k);
    b.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p] <= a[i]) break;
      [a[p], a[i]] = [a[i], a[p]];
      [b[p], b[i]] = [b[i], b[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.keys;
    const b = this.vals;
    const top = b[0];
    const lk = a.pop()!;
    const lv = b.pop()!;
    if (a.length) {
      a[0] = lk;
      b[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l] < a[m]) m = l;
        if (r < a.length && a[r] < a[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        [b[m], b[i]] = [b[i], b[m]];
        i = m;
      }
    }
    return top;
  }
  get size(): number {
    return this.keys.length;
  }
}

let gScore: Float32Array | null = null;
let came: Int32Array | null = null;
let stamp: Uint32Array | null = null;
let curStamp = 1;

export interface PathStats {
  requests: number;
  failures: number;
  expansions: number;
}
export const pathStats: PathStats = { requests: 0, failures: 0, expansions: 0 };

export function findPath(index: WorldIndex, sx: number, sy: number, tx: number, ty: number, budget = 6000): number[] | null {
  pathStats.requests++;
  const W = index.w;
  const N = W * index.h;
  if (!gScore || gScore.length !== N) {
    gScore = new Float32Array(N);
    came = new Int32Array(N);
    stamp = new Uint32Array(N);
  }
  curStamp++;
  sx = Math.floor(sx);
  sy = Math.floor(sy);
  tx = Math.floor(tx);
  ty = Math.floor(ty);
  if (!index.inBounds(tx, ty) || !index.inBounds(sx, sy)) {
    pathStats.failures++;
    return null;
  }
  const goal = ty * W + tx;
  const start = sy * W + sx;
  // accept adjacency when target itself is solid (e.g. walking to a tree)
  const goalSolid = index.solid[goal] === 1;
  const heap = new MinHeap();
  const h = (i: number) => {
    const x = i % W;
    const y = (i / W) | 0;
    const dx = Math.abs(x - tx);
    const dy = Math.abs(y - ty);
    return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
  };
  gScore[start] = 0;
  stamp![start] = curStamp;
  came![start] = -1;
  heap.push(h(start), start);
  let expansions = 0;
  let best = start;
  let bestH = h(start);
  while (heap.size) {
    const cur = heap.pop();
    if (cur === goal) return build(cur, start);
    const cx = cur % W;
    const cy = (cur / W) | 0;
    if (goalSolid && Math.abs(cx - tx) <= 1 && Math.abs(cy - ty) <= 1) return build(cur, start);
    if (++expansions > budget) break;
    const g0 = gScore[cur];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= index.h) continue;
        const ni = ny * W + nx;
        if (index.solid[ni] && ni !== goal) continue;
        if (dx && dy && (index.solid[cy * W + nx] || index.solid[ny * W + cx])) continue;
        const terr = terrainDef(index.state.terrain[ni]);
        const cost = (dx && dy ? 1.414 : 1) / Math.max(0.3, terr.speed) + (terr.water ? 2 : 0);
        const g = g0 + cost;
        if (stamp![ni] === curStamp && g >= gScore[ni]) continue;
        stamp![ni] = curStamp;
        gScore[ni] = g;
        came![ni] = cur;
        const hh = h(ni);
        if (hh < bestH) {
          bestH = hh;
          best = ni;
        }
        heap.push(g + hh * 1.1, ni);
      }
  }
  pathStats.expansions += expansions;
  pathStats.failures++;
  // partial path toward the closest reached node
  return best !== start ? build(best, start) : null;
}

function build(end: number, start: number): number[] {
  const out: number[] = [];
  let c = end;
  let guard = 0;
  while (c !== start && c >= 0 && guard++ < 100000) {
    out.push(c);
    c = came![c];
  }
  out.reverse();
  return out;
}
