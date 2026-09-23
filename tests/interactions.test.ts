import { describe, expect, it } from 'vitest';
import { newGame } from './helpers';
import { getInteractions, itemActions, findTarget } from '@/sim/interactions';
import { log } from '@/core/logger';
import { makeStack } from '@/gen/characters';
import { ITEMS } from '@/content/items';
import { isWater } from '@/content/terrain';

describe('interactions', () => {
  it('every interaction on every kind of object runs without errors', () => {
    const g = newGame(31337);
    g.settings.aiEnabled = false;
    g.settings.godMode = true;
    const p = g.player;
    const errorsBefore = log.errorCount();
    // a well-equipped player so most options are enabled
    p.inventory = new Array(40).fill(null);
    for (const id of ['hatchet', 'pocket_knife', 'folding_shovel', 'hammer', 'lighter', 'cooking_pot', 'fishing_rod', 'bandage', 'branch', 'firewood', 'fiber', 'cordage', 'stone', 'seed_potatoes', 'purify_tablets'])
      p.inventory.push(makeStack(id, 5));
    p.inventory.push(makeStack('water_bottle', 1, { liquid: { ml: 1000, contam: 0.3 } }));
    const seen = new Set<string>();
    for (const o of Object.values(g.state.objects)) {
      if (seen.has(o.type)) continue;
      seen.add(o.type);
      p.x = o.x + 0.5;
      p.y = o.y + 1.5;
      p.action = undefined;
      p.sleeping = false;
      for (const it of getInteractions(g, p, { kind: 'object', obj: o })) {
        if (!it.enabled) continue;
        it.run();
        const act = p.action as { duration: number } | undefined;
        g.advance(act && Number.isFinite(act.duration) ? Math.min(90, act.duration + 1) : 1);
        if (p.sleeping) g.wake(p, 'test');
      }
    }
    // water
    const w = g.index.findTileNear(p.x, p.y, 200, (x, y) => isWater(g.index.terrainAt(x, y)))!;
    for (const it of getInteractions(g, p, { kind: 'water', x: w[0], y: w[1] })) if (it.enabled) (it.run(), g.advance(5));
    // characters
    const npc = g.npcs()[0];
    for (const it of getInteractions(g, p, { kind: 'character', char: npc })) {
      for (const x of [it, ...(it.children ?? [])]) if (x.enabled) (x.run(), g.advance(5));
    }
    // item actions for every item
    for (const id of Object.keys(ITEMS)) {
      p.inventory[0] = makeStack(id, 2);
      for (const a of itemActions(g, p, 0)) if (a.enabled !== false && a.id !== 'drop') (a.run(), g.advance(2));
    }
    expect(seen.size).toBeGreaterThan(25);
    expect(log.errorCount()).toBe(errorsBefore);
    expect(findTarget(g, p)).toBeDefined;
  }, 60000);
});
