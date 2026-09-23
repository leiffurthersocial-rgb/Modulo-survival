import { describe, expect, it } from 'vitest';
import { newGame } from './helpers';

describe('NPC autonomy', () => {
  it('the group keeps itself alive for several days and builds a basic camp', () => {
    const g = newGame(777);
    // take the idle player out of the equation
    g.player.needs.satiety = 100;
    g.settings.godMode = true;
    g.advance(60);
    g.setHomePin(g.state.startPoint.x + 1, g.state.startPoint.y + 2);
    g.advance(3 * 24 * 60);
    const npcs = Object.values(g.state.characters).filter((c) => c.id !== g.state.playerId);
    const alive = npcs.filter((c) => c.alive);
    expect(alive.length).toBeGreaterThanOrEqual(12);
    const near = (t: string) => !!g.index.nearestOfType(t, g.home.x, g.home.y, 30);
    expect(near('campfire') || near('fire_pit')).toBe(true);
    expect(near('lean_to')).toBe(true);
    // NPCs do different things, not all the same task
    expect(new Set(alive.map((c) => c.ai.task)).size).toBeGreaterThan(1);
  }, 120000);
});
