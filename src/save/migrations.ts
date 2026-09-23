import type { SaveData } from './serialize';

/**
 * Save compatibility. Each migration upgrades a save from version N to N+1.
 * Never casually invalidate worlds: add a migration instead.
 */
export const CURRENT_SAVE_VERSION = 1;

type Migration = (d: SaveData) => SaveData;

const MIGRATIONS: Record<number, Migration> = {
  // 1 -> 2 example:
  // 1: (d) => { d.state.newField ??= defaultValue; d.saveVersion = 2; return d; },
};

export function migrate(d: SaveData): SaveData {
  let cur = d;
  while (cur.saveVersion < CURRENT_SAVE_VERSION) {
    const m = MIGRATIONS[cur.saveVersion];
    if (!m) throw new Error(`No migration from save version ${cur.saveVersion}`);
    cur = m(cur);
  }
  cur.state.saveVersion = CURRENT_SAVE_VERSION;
  return cur;
}
