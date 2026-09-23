import { describe, expect, it } from 'vitest';
import { newGame } from './helpers';
import { makeStack } from '@/gen/characters';
import { addItem, countItem } from '@/sim/inventory';
import { updateSpoilage } from '@/sim/ecology';
import { startAction, craftComplete } from '@/sim/actions';
import { itemActions } from '@/sim/interactions';
import { checkPlacement, placeStructure } from '@/sim/building';
import { isWater } from '@/content/terrain';
import { dayOf, season, seasonIndex } from '@/sim/clock';
import { SEASON_DAYS } from '@/content/seasons';
import type { Game } from '@/sim/game';

function runAction(g: Game) {
  const p = g.player;
  let guard = 0;
  while (p.action && guard++ < 10000) g.advance(0.25);
}

describe('food, water, crafting, building', () => {
  it('food spoils, faster in warm weather', () => {
    const g = newGame();
    g.settings.aiEnabled = false;
    const p = g.player;
    p.inventory[10] = makeStack('raw_meat', 1);
    g.state.weather.temp = 20;
    updateSpoilage(g, 1440);
    const warm = p.inventory[10]!.q!;
    p.inventory[10] = makeStack('raw_meat', 1);
    g.state.weather.temp = 0;
    updateSpoilage(g, 1440);
    const cold = p.inventory[10]!.q!;
    expect(warm).toBeLessThan(1);
    expect(cold).toBeGreaterThan(warm);
  });

  it('boiling water at a lit fire removes contamination', () => {
    const g = newGame();
    g.settings.aiEnabled = false;
    const p = g.player;
    p.inventory[10] = makeStack('water_bottle', 1, { liquid: { ml: 800, contam: 0.4 } });
    p.inventory[11] = makeStack('cooking_pot', 1);
    const spot = g.index.findTileNear(p.x, p.y, 6, (x, y) => g.index.isFree(x, y))!;
    const fire = g.index.addObject({ type: 'fire_pit', x: spot[0], y: spot[1], s: 200, lit: true });
    startAction(g, p, 'boilWater', 15, { targetId: fire.id });
    runAction(g);
    expect(p.inventory[10]!.liquid!.contam).toBeLessThan(0.02);
  });

  it('purification tablets treat a container', () => {
    const g = newGame();
    const p = g.player;
    p.inventory[10] = makeStack('water_bottle', 1, { liquid: { ml: 800, contam: 0.5 } });
    p.inventory[11] = makeStack('purify_tablets', 2);
    itemActions(g, p, 10).find((a) => a.id === 'purify')!.run();
    expect(p.inventory[10]!.liquid!.contam).toBeLessThanOrEqual(0.01);
    expect(countItem(p.inventory, 'purify_tablets')).toBe(1);
  });

  it('crafting consumes inputs and produces outputs', () => {
    const g = newGame();
    const p = g.player;
    p.inventory = new Array(16).fill(null);
    addItem(p.inventory, makeStack('fiber', 7));
    expect(craftComplete(g, p, 'cordage')).toBe(true);
    expect(countItem(p.inventory, 'fiber')).toBe(4);
    expect(countItem(p.inventory, 'cordage')).toBe(1);
    p.inventory = new Array(16).fill(null);
    expect(craftComplete(g, p, 'cordage')).toBe(false);
  });

  it('construction validates terrain and materials, then completes with work', () => {
    const g = newGame();
    g.settings.aiEnabled = false;
    const p = g.player;
    p.inventory = new Array(16).fill(null);
    const water = g.index.findTileNear(p.x, p.y, 120, (x, y) => isWater(g.index.terrainAt(x, y)))!;
    p.x = water[0] + 0.5;
    p.y = water[1] + 0.5;
    expect(checkPlacement(g, p, 'campfire', water[0], water[1]).ok).toBe(false);
    const free = g.index.findTileNear(p.x, p.y, 10, (x, y) => g.index.isFree(x, y) && !isWater(g.index.terrainAt(x, y)) && Math.hypot(x - p.x, y - p.y) > 1.5)!;
    expect(checkPlacement(g, p, 'campfire', free[0], free[1]).reason).toMatch(/Missing/);
    addItem(p.inventory, makeStack('branch', 6));
    const site = placeStructure(g, p, 'campfire', free[0], free[1])!;
    expect(site).toBeTruthy();
    expect(countItem(p.inventory, 'branch')).toBe(2);
    expect(site.build).toBe(0);
    startAction(g, p, 'build', 60, { targetId: site.id });
    runAction(g);
    expect(site.build).toBeUndefined();
  });

  it('seasons advance after a fixed number of days and change the climate', () => {
    const g = newGame();
    const t0 = g.state.time;
    expect(season(t0).id).toBe('spring');
    const summer = (SEASON_DAYS - dayOf(t0) + 2) * 1440 + t0;
    expect(seasonIndex(summer)).toBe(1);
    expect(season(summer + SEASON_DAYS * 2 * 1440).id).toBe('winter');
  });
});
