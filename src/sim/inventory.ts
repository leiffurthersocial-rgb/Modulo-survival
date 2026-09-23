import { itemDef, type ToolTag } from '@/content/items';
import type { Character, EquipSlot, ItemStack } from './types';

export type Slots = (ItemStack | null)[];

export const BASE_SLOTS = 8;

export function stackWeight(s: ItemStack | null | undefined): number {
  if (!s) return 0;
  const d = itemDef(s.id);
  let w = d.weight * s.qty;
  if (s.liquid) w += s.liquid.ml / 1000;
  if (s.contents) for (const c of s.contents) w += stackWeight(c);
  return w;
}

export function slotsWeight(slots: Slots): number {
  let w = 0;
  for (const s of slots) w += stackWeight(s);
  return w;
}

export function equipmentWeight(c: Character): number {
  let w = 0;
  for (const k in c.equipment) {
    const s = c.equipment[k as EquipSlot];
    // worn clothing is carried efficiently
    if (s) w += stackWeight(s) * (k === 'hand' ? 1 : 0.5);
  }
  return w;
}

export function totalWeight(c: Character): number {
  return slotsWeight(c.inventory) + equipmentWeight(c);
}

export function carryCapacity(c: Character): number {
  const bp = c.equipment.back ? itemDef(c.equipment.back.id).backpack : undefined;
  return 10 + c.attributes.strength * 1.6 + (bp?.carry ?? 0);
}

export function slotCapacity(c: Character): number {
  const bp = c.equipment.back ? itemDef(c.equipment.back.id).backpack : undefined;
  return BASE_SLOTS + (bp?.slots ?? 0);
}

/** 1 = unburdened; grows above 1 when overloaded. */
export function loadRatio(c: Character): number {
  return totalWeight(c) / carryCapacity(c);
}

/** Resize an inventory after changing a backpack. Returns overflow stacks. */
export function resizeInventory(c: Character): ItemStack[] {
  const cap = slotCapacity(c);
  const overflow: ItemStack[] = [];
  const kept = c.inventory.filter((s): s is ItemStack => !!s);
  c.inventory = new Array(cap).fill(null);
  for (const s of kept) {
    const left = addItem(c.inventory, s);
    if (left) overflow.push(left);
  }
  return overflow;
}

function canMerge(a: ItemStack, b: ItemStack): boolean {
  if (a.id !== b.id) return false;
  if (a.liquid || b.liquid || a.contents || b.contents || a.doc || b.doc) return false;
  const d = itemDef(a.id);
  if (d.maxStack <= 1) return false;
  if (d.food) return Math.abs((a.q ?? 1) - (b.q ?? 1)) < 0.25;
  if (a.charge !== undefined || b.charge !== undefined) return false;
  return true;
}

/**
 * Adds a stack. Returns the leftover stack (or null if everything fit).
 * The input stack is not mutated.
 */
export function addItem(slots: Slots, stack: ItemStack): ItemStack | null {
  const d = itemDef(stack.id);
  let qty = stack.qty;
  if (qty <= 0) return null;
  for (const s of slots) {
    if (!s || !canMerge(s, stack)) continue;
    const room = d.maxStack - s.qty;
    if (room <= 0) continue;
    const n = Math.min(room, qty);
    if (d.food) s.q = ((s.q ?? 1) * s.qty + (stack.q ?? 1) * n) / (s.qty + n);
    s.qty += n;
    qty -= n;
    if (qty <= 0) return null;
  }
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]) continue;
    const n = Math.min(d.maxStack, qty);
    slots[i] = { ...stack, qty: n, liquid: stack.liquid ? { ...stack.liquid } : undefined, contents: stack.contents };
    if (!slots[i]!.liquid) delete slots[i]!.liquid;
    if (!slots[i]!.contents) delete slots[i]!.contents;
    qty -= n;
    if (qty <= 0) return null;
  }
  return { ...stack, qty };
}

/** How many of a stack would fit. */
export function roomFor(slots: Slots, stack: ItemStack): number {
  const d = itemDef(stack.id);
  let room = 0;
  for (const s of slots) {
    if (!s) room += d.maxStack;
    else if (canMerge(s, stack)) room += d.maxStack - s.qty;
  }
  return room;
}

export function countItem(slots: Slots, id: string): number {
  let n = 0;
  for (const s of slots) if (s && s.id === id) n += s.qty;
  return n;
}

/** Removes qty of an item, consuming the least fresh first. Returns removed stacks. */
export function removeItem(slots: Slots, id: string, qty: number): ItemStack[] {
  const out: ItemStack[] = [];
  const order = slots
    .map((s, i) => ({ s, i }))
    .filter((e) => e.s && e.s.id === id)
    .sort((a, b) => (a.s!.q ?? 1) - (b.s!.q ?? 1));
  for (const { s, i } of order) {
    if (qty <= 0) break;
    const n = Math.min(qty, s!.qty);
    out.push({ ...s!, qty: n });
    s!.qty -= n;
    qty -= n;
    if (s!.qty <= 0) slots[i] = null;
  }
  return out;
}

export function removeAt(slots: Slots, index: number, qty?: number): ItemStack | null {
  const s = slots[index];
  if (!s) return null;
  const n = qty === undefined ? s.qty : Math.min(qty, s.qty);
  if (n >= s.qty) {
    slots[index] = null;
    return s;
  }
  s.qty -= n;
  return { ...s, qty: n };
}

export function findIndex(slots: Slots, pred: (s: ItemStack) => boolean): number {
  return slots.findIndex((s) => !!s && pred(s));
}

/** Best tool with a tag among inventory and hand slot. */
export function bestTool(c: Character, tag: ToolTag): { stack: ItemStack; power: number } | undefined {
  let best: { stack: ItemStack; power: number } | undefined;
  const consider = (s: ItemStack | null | undefined) => {
    if (!s) return;
    const t = itemDef(s.id).tool;
    if (!t || !t.tags.includes(tag)) return;
    if (t.wear > 0 && (s.q ?? 1) <= 0) return;
    if (itemDef(s.id).charges !== undefined && (s.charge ?? 0) <= 0) return;
    const p = t.power * (0.6 + 0.4 * (s.q ?? 1));
    if (!best || p > best.power) best = { stack: s, power: p };
  };
  consider(c.equipment.hand);
  for (const s of c.inventory) consider(s);
  return best;
}

/** Applies wear; returns true if the tool broke. */
export function wearTool(c: Character, stack: ItemStack, uses = 1): boolean {
  const t = itemDef(stack.id).tool;
  if (!t || t.wear <= 0) return false;
  stack.q = Math.max(0, (stack.q ?? 1) - t.wear * uses);
  if (stack.q <= 0) {
    const i = c.inventory.indexOf(stack);
    if (i >= 0) c.inventory[i] = null;
    if (c.equipment.hand === stack) c.equipment.hand = null;
    return true;
  }
  return false;
}

export function liquidTotal(slots: Slots, maxContam = 1): number {
  let ml = 0;
  for (const s of slots) if (s?.liquid && s.liquid.contam <= maxContam) ml += s.liquid.ml;
  return ml;
}

/** Water container with the cleanest water that has at least minMl. */
export function cleanestWater(slots: Slots, minMl = 50): ItemStack | undefined {
  let best: ItemStack | undefined;
  for (const s of slots) {
    if (!s?.liquid || s.liquid.ml < minMl) continue;
    if (!best || s.liquid.contam < best.liquid!.contam) best = s;
  }
  return best;
}

/** Pour water into a container, mixing contamination. Returns ml accepted. */
export function pourInto(stack: ItemStack, ml: number, contam: number): number {
  const cap = itemDef(stack.id).liquidCapacity ?? 0;
  if (!stack.liquid) stack.liquid = { ml: 0, contam: 0 };
  const room = cap - stack.liquid.ml;
  const n = Math.max(0, Math.min(room, ml));
  if (n <= 0) return 0;
  stack.liquid.contam = (stack.liquid.contam * stack.liquid.ml + contam * n) / (stack.liquid.ml + n);
  stack.liquid.ml += n;
  return n;
}

export function foodStacks(slots: Slots): ItemStack[] {
  return slots.filter((s): s is ItemStack => !!s && !!itemDef(s.id).food);
}

export function totalKcal(slots: Slots): number {
  let k = 0;
  for (const s of slots) {
    const f = s ? itemDef(s.id).food : undefined;
    if (f) k += f.kcal * s!.qty;
  }
  return k;
}

export function describeStack(s: ItemStack): string {
  const d = itemDef(s.id);
  const parts: string[] = [];
  if (s.liquid) parts.push(s.liquid.ml > 0 ? `${Math.round(s.liquid.ml)} ml ${contamLabel(s.liquid.contam)} water` : 'empty');
  if (d.food && d.food.spoilPerDay > 0 && s.q !== undefined) parts.push(freshnessLabel(s.q));
  if (d.tool && d.tool.wear > 0 && s.q !== undefined) parts.push(`${Math.round(s.q * 100)}% condition`);
  if (d.clothing && (s.dirt ?? 0) > 0.15) parts.push(s.dirt! > 0.7 ? 'filthy' : s.dirt! > 0.4 ? 'dirty' : 'a bit grubby');
  if (s.charge !== undefined && d.charges) {
    if (d.id === 'matches') parts.push(`${s.charge} left`);
    else if (d.id === 'flashlight' || d.id === 'torch') parts.push(`${Math.round(s.charge)}%`);
    else parts.push(`${Math.round((s.charge / d.charges) * 100)}%`);
  }
  return parts.join(', ');
}

export function contamLabel(c: number): string {
  if (c <= 0.02) return 'clean';
  if (c < 0.15) return 'probably safe';
  if (c < 0.4) return 'questionable';
  return 'unsafe';
}

export function freshnessLabel(q: number): string {
  if (q > 0.75) return 'fresh';
  if (q > 0.45) return 'okay';
  if (q > 0.15) return 'going off';
  return 'rotten';
}
