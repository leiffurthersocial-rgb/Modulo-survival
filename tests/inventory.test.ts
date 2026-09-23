import { describe, expect, it } from 'vitest';
import { addItem, carryCapacity, countItem, removeItem, stackWeight, totalWeight, loadRatio } from '@/sim/inventory';
import { makeStack } from '@/gen/characters';
import { newGame } from './helpers';

describe('inventory', () => {
  it('merges stacks up to the stack limit and reports leftovers', () => {
    const slots = new Array(2).fill(null);
    expect(addItem(slots, makeStack('branch', 15))).toBeNull();
    const left = addItem(slots, makeStack('branch', 30));
    expect(countItem(slots, 'branch')).toBe(40);
    expect(left?.qty).toBe(5);
  });

  it('removes the least fresh food first', () => {
    const slots = new Array(4).fill(null);
    slots[0] = { ...makeStack('raw_fish', 1), q: 0.9 };
    slots[1] = { ...makeStack('raw_fish', 1), q: 0.2 };
    const got = removeItem(slots, 'raw_fish', 1);
    expect(got[0].q).toBe(0.2);
    expect(countItem(slots, 'raw_fish')).toBe(1);
  });

  it('counts weight including liquids and nested containers', () => {
    const bottle = makeStack('water_bottle', 1, { liquid: { ml: 1000, contam: 0 } });
    expect(stackWeight(bottle)).toBeCloseTo(1.05);
    const bag = makeStack('duffel_bag', 1);
    bag.contents![0] = makeStack('log', 2);
    expect(stackWeight(bag)).toBeCloseTo(1.5 + 12);
  });

  it('overloading slows the character down', () => {
    const g = newGame();
    const p = g.player;
    const base = g.moveSpeed(p);
    const free = p.inventory.findIndex((s) => !s);
    p.inventory[free] = makeStack('log', 4);
    p.inventory[free + 1] = makeStack('log', 4);
    expect(totalWeight(p)).toBeGreaterThan(carryCapacity(p));
    expect(loadRatio(p)).toBeGreaterThan(1);
    expect(g.moveSpeed(p)).toBeLessThan(base);
  });
});
