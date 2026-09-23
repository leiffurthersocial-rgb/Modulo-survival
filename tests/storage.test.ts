import { describe, expect, it } from 'vitest';
import { newGame } from './helpers';
import { bestBoxFor, boxAccepts, findMisplaced, sortClassOf } from '@/sim/storage';
import { makeStack } from '@/gen/characters';

describe('camp storage', () => {
  it('classifies items and respects what each box takes', () => {
    expect(sortClassOf('branch')).toBe('wood');
    expect(sortClassOf('ration')).toBe('food');
    expect(sortClassOf('hatchet')).toBe('tools');
    expect(sortClassOf('bandage')).toBe('medical');
    const g = newGame();
    const pile = g.index.addObject({ type: 'woodpile', x: 5, y: 5, inv: new Array(24).fill(null) });
    const crate = g.index.addObject({ type: 'storage_cache', x: 7, y: 5, inv: new Array(16).fill(null) });
    expect(boxAccepts(pile, 'branch')).toBe(true);
    expect(boxAccepts(pile, 'ration')).toBe(false);
    expect(boxAccepts(crate, 'ration')).toBe(true);
    crate.sort = 'food';
    expect(boxAccepts(crate, 'branch')).toBe(false);
    expect(bestBoxFor([crate, pile], makeStack('firewood', 3))).toBe(pile);
  });

  it('the group carries misplaced things to the box made for them', () => {
    const g = newGame(777);
    g.settings.godMode = true;
    const p = g.player;
    g.setHomePin(g.state.startPoint.x + 1, g.state.startPoint.y + 2);
    const h = g.home;
    const spot = (dx: number) => g.index.findTileNear(h.x + dx, h.y + 3, 6, (x, y) => g.index.isFree(x, y))!;
    const [ax, ay] = spot(-2);
    const crate = g.index.addObject({ type: 'storage_cache', x: ax, y: ay, inv: new Array(16).fill(null) });
    const [bx, by] = spot(3);
    const pile = g.index.addObject({ type: 'woodpile', x: bx, y: by, inv: new Array(24).fill(null) });
    crate.inv![0] = makeStack('firewood', 8);
    crate.inv![1] = makeStack('log', 3);
    expect(findMisplaced([crate, pile])).toBeTruthy();
    void p;
    // keep everyone fed and watered so tidying wins over survival
    for (let i = 0; i < 12 * 60; i += 30) {
      for (const c of g.livingCharacters()) Object.assign(c.needs, { satiety: 90, hydration: 90, energy: 90, bodyTemp: 37, bladder: 0 });
      g.state.time = Math.floor(g.state.time / 1440) * 1440 + 11 * 60; // stay in daylight
      g.advance(30);
      if (!crate.inv!.some((s) => s && sortClassOf(s.id) === 'wood')) break;
    }
    const woodInPile = pile.inv!.reduce((n, s) => n + (s && sortClassOf(s.id) === 'wood' ? 1 : 0), 0);
    expect(woodInPile).toBeGreaterThan(0);
    expect(crate.inv!.some((s) => s && sortClassOf(s.id) === 'wood')).toBe(false);
  }, 120000);
});
