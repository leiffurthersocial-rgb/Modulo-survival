import { log } from '@/core/logger';
import type { GameState } from '@/sim/types';
import { deserialize, fromJSON, serialize, toJSON, type SaveData, type SaveMeta } from './serialize';

/**
 * Local persistence. IndexedDB stores full saves (typed arrays are stored
 * natively); a small metadata store lists slots without loading worlds.
 */
const DB_NAME = 'modulo-survival';
const DB_VERSION = 1;
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'] as const;
export type SlotId = (typeof SLOTS)[number];

let dbPromise: Promise<IDBDatabase> | null = null;
const memory = new Map<string, SaveData>();

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('saves')) db.createObjectStore('saves');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch((e) => {
    log.warn('save', `IndexedDB unavailable, saves are kept in memory only: ${e}`);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function saveGame(state: GameState, slot: SlotId): Promise<SaveMeta> {
  const data = serialize(state, slot);
  try {
    await tx('saves', 'readwrite', (s) => s.put(data, slot));
    await tx('meta', 'readwrite', (s) => s.put(data.meta, slot));
  } catch (e) {
    log.warn('save', `falling back to memory save: ${(e as Error).message}`);
    memory.set(slot, data);
  }
  return data.meta;
}

export async function loadGame(slot: SlotId): Promise<GameState> {
  let data: SaveData | undefined;
  try {
    data = await tx<SaveData>('saves', 'readonly', (s) => s.get(slot));
  } catch {
    data = memory.get(slot);
  }
  if (!data) data = memory.get(slot);
  if (!data) throw new Error('Nothing saved in this slot.');
  return deserialize(data);
}

export async function listSaves(): Promise<SaveMeta[]> {
  try {
    const all = await tx<SaveMeta[]>('meta', 'readonly', (s) => s.getAll());
    return all.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [...memory.values()].map((d) => d.meta);
  }
}

export async function deleteSave(slot: SlotId): Promise<void> {
  memory.delete(slot);
  try {
    await tx('saves', 'readwrite', (s) => s.delete(slot));
    await tx('meta', 'readwrite', (s) => s.delete(slot));
  } catch (e) {
    log.warn('save', `delete failed: ${(e as Error).message}`);
  }
}

export function exportSave(state: GameState): Blob {
  return new Blob([toJSON(serialize(state, 'export'))], { type: 'application/json' });
}

export async function importSave(file: File): Promise<GameState> {
  const text = await file.text();
  return deserialize(fromJSON(text));
}
