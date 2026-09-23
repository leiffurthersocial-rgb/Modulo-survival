import { describe, it, expect } from 'vitest';
import { generateWorld } from '@/gen/world';
import { Game } from '@/sim/game';
import { formatClock, dayOf } from '@/sim/clock';

describe('smoke', () => {
  it('runs a few days headless', () => {
    const t0 = performance.now();
    const state = generateWorld({ seed: 12345, mode: 'normal', playerId: 'leif' });
    const t1 = performance.now();
    console.log('gen ms', (t1 - t0).toFixed(0), 'objects', Object.keys(state.objects).length, 'animals', Object.keys(state.animals).length);
    const game = new Game(state);
    const msgs: string[] = [];
    game.bus.on('journal', (e) => msgs.push(`D${e.day} ${formatClock(e.t)} ${e.text}`));
    // player sets home pin near stream after a bit: simulate by setting near start
    const t2 = performance.now();
    let steps = 0;
    for (let i = 0; i < 60 * 60 * 24 * 4 / 6; i++) {
      game.update(0.1); // 0.1 real s = 0.1 game min at 1x
      steps++;
      if (i === 2000) game.setHomePin(state.startPoint.x + 2, state.startPoint.y + 2);
    }
    const t3 = performance.now();
    console.log('sim ms', (t3 - t2).toFixed(0), 'steps', steps, 'game time', dayOf(state.time), formatClock(state.time));
    for (const c of Object.values(state.characters)) {
      console.log(c.name.padEnd(9), c.alive ? '' : 'DEAD', 'task', c.ai.task.padEnd(11), 'sat', c.needs.satiety.toFixed(0), 'hyd', c.needs.hydration.toFixed(0), 'en', c.needs.energy.toFixed(0), 'T', c.needs.bodyTemp.toFixed(1), 'hp', c.health.hp.toFixed(0), 'mor', c.needs.morale.toFixed(0), c.statuses.join(','));
    }
    console.log(msgs.slice(-40).join('\n'));
    expect(Object.values(state.characters).some((c) => c.alive)).toBe(true);
  }, 120000);
});
