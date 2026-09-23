import { describe, expect, it } from 'vitest';
import { newGame } from './helpers';
import { clothingDirt, clothingInsulation, updateBody } from '@/sim/body';
import { ACTIONS } from '@/sim/actions';
import { computeEnv } from '@/sim/environment';
import type { Game } from '@/sim/game';
import type { Character } from '@/sim/types';

function isolate(g: Game): Character {
  // keep NPCs out of the way for body tests
  g.settings.aiEnabled = false;
  const p = g.player;
  p.needs.satiety = 80;
  p.needs.hydration = 80;
  p.needs.energy = 90;
  p.needs.bodyTemp = 37;
  p.needs.wetness = 0;
  p.needs.bladder = 0;
  return p;
}

function tick(g: Game, c: Character, minutes: number, envPatch: Partial<ReturnType<typeof computeEnv>> = {}) {
  for (let i = 0; i < minutes; i++) updateBody(g, c, 1, { ...computeEnv(g.state, g.index, c.x, c.y), ...envPatch });
}

describe('survival needs', () => {
  it('hunger, thirst and fatigue build up over time', () => {
    const g = newGame();
    const p = isolate(g);
    tick(g, p, 300, { airTemp: 18, rain: 0, wind: 0, fireHeat: 0 });
    expect(p.needs.bladder).toBeGreaterThan(40);
    tick(g, p, 300, { airTemp: 18, rain: 0, wind: 0, fireHeat: 0 });
    expect(p.needs.satiety).toBeLessThan(80 - 15);
    expect(p.needs.hydration).toBeLessThan(80 - 20);
    expect(p.needs.energy).toBeLessThan(90 - 30);
  });

  it('an empty stomach draws on reserves instead of killing quickly', () => {
    const g = newGame();
    const p = isolate(g);
    p.needs.satiety = 0;
    const r0 = p.needs.reserves;
    const hp0 = p.health.hp;
    tick(g, p, 24 * 60, { airTemp: 18, rain: 0, wind: 0 });
    expect(p.needs.reserves).toBeLessThan(r0);
    expect(p.needs.reserves).toBeGreaterThan(r0 - 20);
    expect(p.health.hp).toBeGreaterThan(hp0 - 30);
  });

  it('sleep restores energy, better in good conditions', () => {
    const g = newGame();
    const p = isolate(g);
    p.needs.energy = 20;
    p.sleeping = true;
    p.sleepQuality = 0.9;
    tick(g, p, 8 * 60, { airTemp: 16, rain: 0, wind: 0 });
    const good = p.needs.energy;
    p.needs.energy = 20;
    p.sleepQuality = 0.2;
    tick(g, p, 8 * 60, { airTemp: 16, rain: 0, wind: 0 });
    expect(good).toBeGreaterThan(80);
    expect(p.needs.energy).toBeLessThan(good);
  });

  it('cold rain soaks clothes and drives body temperature down; fire reverses it', () => {
    const g = newGame();
    const p = isolate(g);
    p.equipment.outer = null;
    tick(g, p, 180, { airTemp: 3, rain: 0.85, wind: 6, fireHeat: 0, shelter: undefined, indoor: false });
    expect(p.needs.wetness).toBeGreaterThan(80);
    const cold = p.needs.bodyTemp;
    expect(cold).toBeLessThan(36.5);
    tick(g, p, 180, { airTemp: 3, rain: 0, wind: 0, fireHeat: 14 });
    expect(p.needs.wetness).toBeLessThan(40);
    expect(p.needs.bodyTemp).toBeGreaterThan(cold);
  });

  it('bleeding wounds cost health and bandaging stops the bleeding', () => {
    const g = newGame();
    const p = isolate(g);
    g.injure(p, 'cut', 0.7, 'test');
    const inj = p.health.injuries[0];
    expect(inj.bleeding).toBeGreaterThan(0);
    const hp = p.health.hp;
    tick(g, p, 30, { airTemp: 18 });
    expect(p.health.hp).toBeLessThan(hp);
    inj.bandaged = true;
    const hp2 = p.health.hp;
    tick(g, p, 30, { airTemp: 18 });
    expect(hp2 - p.health.hp).toBeLessThan(hp - hp2);
  });

  it('clothes get dirty, insulate worse, and washing cleans them but leaves them wet', () => {
    const g = newGame();
    const p = isolate(g);
    const warm0 = clothingInsulation(p).warmth;
    p.exertion = 2;
    tick(g, p, 60 * 24 * 3, { airTemp: 16, rain: 0, wind: 0, fireHeat: 0 });
    p.exertion = 1;
    expect(clothingDirt(p)).toBeGreaterThan(0.6);
    p.needs.wetness = 0;
    expect(clothingInsulation(p).warmth).toBeLessThan(warm0);
    ACTIONS.washClothes.complete!(g, p, { type: 'washClothes', t: 0, dur: 20 } as never);
    expect(clothingDirt(p)).toBeLessThan(0.2);
    expect(p.needs.wetness).toBeGreaterThanOrEqual(55);
  });
});

describe('eating and drinking from the inventory', () => {
  it('is instant, like using an item in the bag', async () => {
    const { consumeNow } = await import('@/sim/interactions');
    const g = newGame();
    const p = isolate(g);
    p.needs.hydration = 40;
    p.needs.satiety = 20;
    const bottle = p.inventory.findIndex((s) => s?.id === 'water_bottle');
    p.inventory[bottle]!.liquid = { ml: 1000, contam: 0 };
    expect(consumeNow(g, p, bottle)).toBe(true);
    expect(p.needs.hydration).toBeGreaterThan(55);
    expect(p.action).toBeUndefined();
    const ration = p.inventory.findIndex((s) => s?.id === 'ration');
    const before = p.inventory[ration]!.qty;
    expect(consumeNow(g, p, ration)).toBe(true);
    expect(p.needs.satiety).toBeGreaterThan(20);
    expect(p.inventory[ration]?.qty ?? 0).toBe(before - 1);
    expect(p.action).toBeUndefined();
  });
});

describe('player sleep', () => {
  it('refuses a daytime nap unless tired, and sleeps the whole night through', async () => {
    const { hourOf, sunTimes } = await import('@/sim/clock');
    const g = newGame();
    const p = isolate(g);
    p.needs.hydration = 100;
    p.needs.satiety = 100;
    // midday, not tired: refused
    g.state.time = Math.floor(g.state.time / 1440) * 1440 + 12 * 60;
    p.needs.energy = 70;
    expect(g.startSleep(p)).toBe(false);
    // midday, exhausted: a nap is fine and ends once rested
    p.needs.energy = 30;
    expect(g.startSleep(p)).toBe(true);
    g.wake(p, 'test');

    // 21:00, fairly fresh: bed is fine at night, and it lasts until first light
    g.state.time = Math.floor(g.state.time / 1440) * 1440 + 21 * 60;
    p.needs.energy = 80;
    p.needs.bodyTemp = 37;
    g.settings.godMode = true;
    expect(g.startSleep(p)).toBe(true);
    let wokeAt = -1;
    for (let i = 0; i < 16 * 60 && wokeAt < 0; i++) {
      g.advance(1);
      if (!p.sleeping) wokeAt = g.state.time;
    }
    const { rise } = sunTimes(wokeAt);
    expect(hourOf(wokeAt)).toBeGreaterThanOrEqual(rise - 0.6);
    expect(hourOf(wokeAt)).toBeLessThan(rise + 3.1);
  });
});
