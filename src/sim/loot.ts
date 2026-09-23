import { Rng } from '@/core/rng';
import { LOOT } from '@/content/loot';
import { COMMON_DOCS, causeById } from '@/content/lore';
import { objectDef } from '@/content/objects';
import { makeStack } from '@/gen/characters';
import type { Game } from './game';
import type { WorldObject } from './types';
import { addItem } from './inventory';

/** Rolls a container's contents on first access. Deterministic per world and container. */
export function ensureLoot(game: Game, o: WorldObject): void {
  if (o.inv && !o.lootTable) return;
  const def = objectDef(o.type);
  const slots = def.container ?? 8;
  if (!o.inv) o.inv = new Array(slots).fill(null);
  const tableId = o.lootTable;
  delete o.lootTable;
  const rng = new Rng((game.state.seed ^ Math.imul(o.id, 2654435761)) >>> 0);
  const hc = game.state.mode === 'hardcore' ? 0.6 : 1;
  const table = tableId ? LOOT[tableId] : undefined;
  if (table) {
    let rolls = rng.int(table.rolls[0], table.rolls[1]);
    rolls = Math.round(rolls * hc + (hc < 1 && rng.chance(0.3) ? 1 : 0));
    const entries = table.entries.filter((e) => e[1] > 0).map((e) => [e, e[1]] as const);
    for (let i = 0; i < rolls; i++) {
      const [id, , min, max] = rng.weighted(entries);
      const qty = rng.int(min, max);
      const stack = makeStack(id, qty);
      if (stack.liquid && rng.chance(0.5)) stack.liquid = { ml: rng.int(200, 900), contam: rng.chance(0.3) ? 0.3 : 0 };
      if (stack.q !== undefined && !objectDef(o.type).fire) stack.q = rng.range(0.55, 1);
      if (stack.charge !== undefined && stack.id !== 'matches') stack.charge = Math.round(stack.charge * rng.range(0.2, 0.9));
      if (stack.id === 'matches') stack.charge = rng.int(4, 20);
      addItem(o.inv, stack);
    }
  }
  // Evidence documents: some forced, the rest scattered by chance.
  const lore = game.state.lore;
  lore.placed ??= [];
  let docId = o.doc;
  if (!docId && table?.doc && rng.chance(table.doc)) {
    const cause = causeById(lore.cause);
    const pool = [...cause.docs.map((d) => d.id), ...COMMON_DOCS.map((d) => d.id)].filter((id) => !lore.placed!.includes(id));
    if (pool.length) docId = rng.pick(pool);
  }
  if (docId && o.type !== 'sign') {
    if (docId === 'forester') docId = `${lore.cause}_7`;
    lore.placed.push(docId);
    addItem(o.inv, makeStack('note', 1, { doc: docId }));
    delete o.doc;
  }
}

export function docById(game: Game, id: string): { title: string; text: string } | undefined {
  const cause = causeById(game.state.lore.cause);
  return cause.docs.find((d) => d.id === id) ?? COMMON_DOCS.find((d) => d.id === id);
}

export function readDoc(game: Game, id: string): void {
  const lore = game.state.lore;
  if (!lore.found.includes(id)) {
    lore.found.push(id);
    const d = docById(game, id);
    if (d) game.journal(`Found a document: "${d.title}".`, 'lore');
  }
}
