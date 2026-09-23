import { describe, expect, it } from 'vitest';
import { newGame } from './helpers';
import { findTarget } from '@/sim/interactions';

describe('interaction targeting', () => {
  it('only picks what is directly in front of the character, within reach', () => {
    const g = newGame();
    g.settings.aiEnabled = false;
    const p = g.player;
    // find an open patch and put a stone right next to the player
    const spot = g.index.findTileNear(p.x, p.y, 20, (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [3, 0]].every(([dx, dy]) => g.index.isFree(x + dx, y + dy) && !g.index.objAt(x + dx, y + dy)));
    expect(spot).toBeTruthy();
    const [sx, sy] = spot!;
    for (const c of g.livingCharacters()) if (c !== p) c.x = sx + 40;
    p.x = sx + 0.5;
    p.y = sy + 0.6;
    const stone = g.index.addObject({ type: 'boulder', x: sx + 1, y: sy });

    p.facing = 'right';
    const t = findTarget(g, p);
    expect(t?.kind === 'object' && t.obj.id).toBe(stone.id);

    // beside or behind: nothing
    p.facing = 'left';
    expect(findTarget(g, p)).toBeUndefined();
    p.facing = 'up';
    expect(findTarget(g, p)).toBeUndefined();

    // out of reach in front: nothing
    g.index.removeObject(stone.id);
    const far = g.index.addObject({ type: 'boulder', x: sx + 3, y: sy });
    p.facing = 'right';
    expect(findTarget(g, p)).toBeUndefined();
    void far;
  });
});
