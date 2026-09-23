import type { GameState, WorldObject } from '@/sim/types';
import { dayOf, season, formatClock } from '@/sim/clock';
import { migrate, CURRENT_SAVE_VERSION } from './migrations';

export const SAVE_FORMAT = 'modulo-survival-save';

export interface SaveMeta {
  slot: string;
  worldName: string;
  playerName: string;
  day: number;
  season: string;
  clock: string;
  savedAt: number;
  mode: string;
  seed: number;
  living: number;
  saveVersion: number;
}

/** Objects that only carry basic fields are packed into typed arrays. */
const PACK_KEYS = new Set(['id', 'type', 'x', 'y', 'v', 's']);

export interface PackedObjects {
  types: string[];
  /** rows of [id, typeIndex, x, y, v+1, s+1] as Int32 */
  rows: Int32Array;
  rich: WorldObject[];
}

export interface SaveData {
  format: typeof SAVE_FORMAT;
  saveVersion: number;
  meta: SaveMeta;
  state: Omit<GameState, 'objects'> & { objects: PackedObjects };
}

export class SaveError extends Error {}

export function packObjects(objects: Record<number, WorldObject>): PackedObjects {
  const types: string[] = [];
  const typeIdx = new Map<string, number>();
  const rows: number[] = [];
  const rich: WorldObject[] = [];
  for (const k in objects) {
    const o = objects[k];
    let simple = true;
    for (const key in o) {
      if (!PACK_KEYS.has(key) && (o as unknown as Record<string, unknown>)[key] !== undefined) {
        simple = false;
        break;
      }
    }
    if (simple && Number.isInteger(o.s ?? 0) && (o.s ?? 0) >= -1) {
      let ti = typeIdx.get(o.type);
      if (ti === undefined) {
        ti = types.length;
        types.push(o.type);
        typeIdx.set(o.type, ti);
      }
      rows.push(o.id, ti, o.x, o.y, o.v === undefined ? 0 : o.v + 1, o.s === undefined ? 0 : o.s + 2);
    } else rich.push(o);
  }
  return { types, rows: Int32Array.from(rows), rich };
}

export function unpackObjects(p: PackedObjects): Record<number, WorldObject> {
  const out: Record<number, WorldObject> = {};
  const r = p.rows;
  for (let i = 0; i + 5 < r.length; i += 6) {
    const o: WorldObject = { id: r[i], type: p.types[r[i + 1]], x: r[i + 2], y: r[i + 3] };
    if (r[i + 4]) o.v = r[i + 4] - 1;
    if (r[i + 5]) o.s = r[i + 5] - 2;
    out[o.id] = o;
  }
  for (const o of p.rich) out[o.id] = o;
  return out;
}

export function makeMeta(state: GameState, slot: string): SaveMeta {
  const p = state.characters[state.playerId];
  return {
    slot,
    worldName: state.worldName,
    playerName: p?.name ?? '?',
    day: dayOf(state.time),
    season: season(state.time).name,
    clock: formatClock(state.time),
    savedAt: Date.now(),
    mode: state.mode,
    seed: state.seed,
    living: Object.values(state.characters).filter((c) => c.alive).length,
    saveVersion: state.saveVersion,
  };
}

export function serialize(state: GameState, slot: string): SaveData {
  const { objects, ...rest } = state;
  // deep clone plain parts so later mutation does not affect the stored copy
  const clone = structuredClone({ ...rest, objects: packObjects(objects) });
  return { format: SAVE_FORMAT, saveVersion: CURRENT_SAVE_VERSION, meta: makeMeta(state, slot), state: clone };
}

export function deserialize(data: unknown): GameState {
  if (!data || typeof data !== 'object') throw new SaveError('Save data is empty or unreadable.');
  const d = data as SaveData;
  if (d.format !== SAVE_FORMAT) throw new SaveError('This file is not a Modulo: Survival save.');
  if (typeof d.saveVersion !== 'number') throw new SaveError('Save has no version number.');
  if (d.saveVersion > CURRENT_SAVE_VERSION) throw new SaveError('This save was made by a newer version of the game.');
  const migrated = migrate(d);
  const s = migrated.state;
  const state = { ...s, objects: unpackObjects(s.objects) } as GameState;
  validate(state);
  return state;
}

function validate(s: GameState): void {
  const problems: string[] = [];
  if (!s.width || !s.height) problems.push('world size missing');
  if (!(s.terrain instanceof Uint8Array) || s.terrain.length !== s.width * s.height) problems.push('terrain corrupted');
  if (!(s.explored instanceof Uint8Array) || s.explored.length !== s.width * s.height) {
    s.explored = new Uint8Array(s.width * s.height);
  }
  if (!(s.contamination instanceof Float32Array)) s.contamination = new Float32Array(Math.ceil(s.width / 8) * Math.ceil(s.height / 8));
  if (!s.characters || !Object.keys(s.characters).length) problems.push('no characters');
  if (problems.length) throw new SaveError(`Save is corrupted: ${problems.join(', ')}.`);
  if (!s.characters[s.playerId] || !s.characters[s.playerId].alive) {
    const alive = Object.values(s.characters).find((c) => c.alive);
    if (alive) s.playerId = alive.id;
  }
  // clamp invalid world positions
  for (const c of Object.values(s.characters)) {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) {
      c.x = s.startPoint.x;
      c.y = s.startPoint.y;
    }
    c.x = Math.min(Math.max(c.x, 1), s.width - 2);
    c.y = Math.min(Math.max(c.y, 1), s.height - 2);
  }
  s.markers ??= [];
  s.expeditions ??= [];
  s.hints ??= [];
  s.journal ??= [];
  s.fishStock ??= {};
}

// --- JSON export with typed arrays ------------------------------------------------

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function toJSON(data: SaveData): string {
  return JSON.stringify(data, (_k, v) => {
    if (v instanceof Uint8Array) return { $t: 'u8', b: toBase64(v) };
    if (v instanceof Int32Array) return { $t: 'i32', b: toBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
    if (v instanceof Float32Array) return { $t: 'f32', b: toBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
    if (typeof v === 'number' && !Number.isFinite(v)) return { $t: 'num', b: String(v) };
    return v;
  });
}

export function fromJSON(text: string): SaveData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text, (_k, v) => {
      if (v && typeof v === 'object' && typeof v.$t === 'string') {
        if (v.$t === 'num') return Number(v.b);
        const bytes = fromBase64(v.b);
        if (v.$t === 'u8') return bytes;
        const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        if (v.$t === 'i32') return new Int32Array(buf);
        if (v.$t === 'f32') return new Float32Array(buf);
      }
      return v;
    });
  } catch {
    throw new SaveError('The file is not valid JSON.');
  }
  return parsed as SaveData;
}
