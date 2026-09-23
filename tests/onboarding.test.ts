import { describe, expect, it } from 'vitest';
import { newGame } from './helpers';
import { checkObjectives, objectiveDone, OBJECTIVES } from '@/sim/objectives';
import { startAction } from '@/sim/actions';

describe('first steps checklist', () => {
  it('ticks steps off from what actually happens, and they stay ticked', () => {
    const g = newGame();
    g.settings.aiEnabled = false;
    checkObjectives(g);
    expect(OBJECTIVES.some((o) => objectiveDone(g, o.id))).toBe(false);

    // drinking from the bottle completes "drink"
    const p = g.player;
    const slot = p.inventory.findIndex((s) => s?.id === 'water_bottle');
    startAction(g, p, 'drinkItem', 1, { data: { slot, ml: 200 } });
    g.advance(2);
    checkObjectives(g);
    expect(objectiveDone(g, 'drink')).toBe(true);

    // setting the Home Pin completes "home"
    g.setHomePin(p.x, p.y);
    checkObjectives(g);
    expect(objectiveDone(g, 'home')).toBe(true);

    // a finished, lit fire at camp completes "fire" and "light"
    const fire = g.index.addObject({ type: 'campfire', x: Math.floor(p.x) + 2, y: Math.floor(p.y), s: 50, lit: true });
    checkObjectives(g);
    expect(objectiveDone(g, 'fire')).toBe(true);
    expect(objectiveDone(g, 'light')).toBe(true);

    // it stays ticked after the fire goes out
    fire.lit = false;
    checkObjectives(g);
    expect(objectiveDone(g, 'light')).toBe(true);
  });

  it('old games skip the checklist', () => {
    const g = newGame();
    g.state.time = (g.state.startTime ?? 0) + 5 * 1440;
    checkObjectives(g);
    expect(g.state.hints).toContain('goals_done');
  });
});
