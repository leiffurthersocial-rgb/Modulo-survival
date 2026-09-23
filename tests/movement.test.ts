import { describe, expect, it } from 'vitest';
import { newGame } from './helpers';

function openArea(g: ReturnType<typeof newGame>, w: number, h: number): [number, number] {
  const p = g.player;
  return g.index.findTileNear(p.x, p.y, 40, (x, y) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (!g.index.isFree(x + dx, y + dy) || g.index.objAt(x + dx, y + dy)) return false;
    return true;
  })!;
}

describe('movement never leaves you stuck', () => {
  it('walks out of something solid it overlaps', () => {
    const g = newGame();
    g.settings.aiEnabled = false;
    const p = g.player;
    const [x, y] = openArea(g, 5, 5);
    p.x = x + 2.5;
    p.y = y + 2.5;
    // a boulder appears right where the player's hitbox reaches
    g.index.addObject({ type: 'boulder', x: x + 3, y: y + 2 });
    p.x = x + 2.8;
    expect(g.collides(p.x, p.y, 0.28)).toBe(true);
    const before = p.x;
    for (let i = 0; i < 20; i++) g.moveCharacter(p, -1, 0, 0.05);
    expect(p.x).toBeLessThan(before - 0.2);
    expect(g.collides(p.x, p.y, 0.28)).toBe(false);
  });

  it('slides around the corner of an obstacle instead of stopping', () => {
    const g = newGame();
    g.settings.aiEnabled = false;
    const p = g.player;
    const [x, y] = openArea(g, 6, 5);
    g.index.addObject({ type: 'boulder', x: x + 3, y: y + 2 });
    // walking right, a little too low: the hitbox clips the boulder's bottom corner
    p.x = x + 2.2;
    p.y = y + 3.05;
    for (let i = 0; i < 60; i++) g.moveCharacter(p, 1, 0, 0.05);
    expect(p.x).toBeGreaterThan(x + 4.2);
  });

  it('frees a character completely boxed in', () => {
    const g = newGame();
    const p = g.player;
    const [x, y] = openArea(g, 5, 5);
    for (const [dx, dy] of [[1, 2], [3, 2], [2, 1], [2, 3], [2, 2]]) g.index.addObject({ type: 'boulder', x: x + dx, y: y + dy });
    p.x = x + 2.5;
    p.y = y + 2.5;
    expect(g.freeCharacter(p)).toBe(true);
    expect(g.collides(p.x, p.y, 0.28)).toBe(false);
  });
});
