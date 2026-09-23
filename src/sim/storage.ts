import { itemDef } from '@/content/items';
import { objectDef } from '@/content/objects';
import type { ItemStack, WorldObject } from './types';

/**
 * Camp storage: every item belongs to one sort class, and boxes either take
 * anything, take only what they are built for (a woodpile takes wood), or take
 * what the player labelled them for. NPCs put things where they belong.
 */
export type SortClass = 'food' | 'wood' | 'tools' | 'medical' | 'water' | 'clothing' | 'materials' | 'misc';

export const SORT_CLASSES: SortClass[] = ['food', 'wood', 'tools', 'medical', 'water', 'clothing', 'materials', 'misc'];

export const SORT_LABEL: Record<SortClass, string> = {
  food: 'Food',
  wood: 'Firewood',
  tools: 'Tools',
  medical: 'Medicine',
  water: 'Water',
  clothing: 'Clothing and bedding',
  materials: 'Materials',
  misc: 'Other',
};

const WOOD = new Set(['log', 'firewood', 'branch', 'charcoal']);

export function sortClassOf(id: string): SortClass {
  const d = itemDef(id);
  if (WOOD.has(id)) return 'wood';
  if (d.food) return 'food';
  if (d.category === 'medical' || id === 'soap') return 'medical';
  if (d.category === 'water') return id === 'cooking_pot' ? 'tools' : 'water';
  if (d.category === 'tool' || d.category === 'weapon' || d.category === 'light') return 'tools';
  if (d.category === 'clothing' || id === 'sleeping_bag') return 'clothing';
  if (d.category === 'material' || d.category === 'seed') return 'materials';
  return 'misc';
}

/** Box types NPCs treat as shared camp storage. */
export const STORAGE_TYPES = ['storage_cache', 'wooden_crate', 'supply_bag', 'woven_chest', 'pegged_chest', 'woodpile', 'food_store', 'tool_rack'];

/** The classes a box takes, or null for "anything". */
export function boxClasses(o: WorldObject): SortClass[] | null {
  const fixed = objectDef(o.type).storage?.accepts;
  if (fixed) return fixed;
  return o.sort ? [o.sort as SortClass] : null;
}

export function boxAccepts(o: WorldObject, id: string): boolean {
  const cls = boxClasses(o);
  return !cls || cls.includes(sortClassOf(id));
}

/** Short description of what a box is for, for the UI. */
export function boxPurpose(o: WorldObject): string {
  const cls = boxClasses(o);
  return cls ? cls.map((c) => SORT_LABEL[c]).join(', ') : 'Anything';
}

/** Whether at least part of the stack fits into the slots. */
export function hasRoomFor(inv: (ItemStack | null)[], s: ItemStack): boolean {
  const max = itemDef(s.id).maxStack;
  for (const x of inv) {
    if (!x) return true;
    if (max > 1 && x.id === s.id && x.qty < max && !x.liquid && !s.liquid) return true;
  }
  return false;
}

/**
 * The best box for an item among the given containers: a box made or marked
 * for its class first, then any general box. Returns undefined if nothing fits.
 */
export function bestBoxFor(boxes: WorldObject[], s: ItemStack, exclude?: WorldObject): WorldObject | undefined {
  const cls = sortClassOf(s.id);
  let general: WorldObject | undefined;
  for (const o of boxes) {
    if (o === exclude || !o.inv || !hasRoomFor(o.inv, s)) continue;
    const bc = boxClasses(o);
    if (bc?.includes(cls)) return o;
    if (!bc && !general) general = o;
  }
  return general;
}

export interface Misplaced {
  from: WorldObject;
  slot: number;
  to: WorldObject;
}

/**
 * Something sitting in the wrong box: either a box that does not take it
 * (after the player relabelled it) or a general box while a box made for it
 * has room. Returns the first such case.
 */
export function findMisplaced(boxes: WorldObject[]): Misplaced | undefined {
  for (const from of boxes) {
    if (!from.inv) continue;
    const fromCls = boxClasses(from);
    for (let slot = 0; slot < from.inv.length; slot++) {
      const s = from.inv[slot];
      if (!s) continue;
      const cls = sortClassOf(s.id);
      if (fromCls?.includes(cls)) continue; // already in a box meant for it
      const to = bestBoxFor(boxes, s, from);
      if (!to) continue;
      const toCls = boxClasses(to);
      // from a general box, only move into a box meant for it; a wrong box empties into anything
      if (!fromCls && !toCls?.includes(cls)) continue;
      return { from, slot, to };
    }
  }
  return undefined;
}
