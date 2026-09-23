import { it } from 'vitest';
import { generateWorld } from '@/gen/world';
import { Game } from '@/sim/game';
import { formatClock } from '@/sim/clock';

it('trace', () => {
  const state = generateWorld({ seed: 12345, mode: 'normal', playerId: 'leif' });
  const game = new Game(state);
  const ids = ['robin', 'jovan', 'erim'];
  const tasks: Record<string, number> = {};
  let last = performance.now();
  for (let i = 0; i < 60 * 60 * 20 / 6; i++) {
    game.update(0.1);
    if (i === 2000) game.setHomePin(state.startPoint.x + 2, state.startPoint.y + 2);
    for (const c of Object.values(state.characters)) tasks[c.ai.task] = (tasks[c.ai.task] ?? 0) + 1;
    if (i % 600 === 0) {
      const now = performance.now();
      console.log('--', formatClock(state.time), 'ms', (now - last).toFixed(0), state.weather.current, state.weather.temp.toFixed(1), JSON.stringify(tasks));
      last = now;
      for (const k in tasks) delete tasks[k];
      for (const id of ids) {
        const c = state.characters[id];
        console.log(c.name, c.ai.task, c.action?.type ?? '-', 'pos', c.x.toFixed(1), c.y.toFixed(1), 'tgt', c.ai.targetX?.toFixed(1), c.ai.targetY?.toFixed(1), 'hyd', c.needs.hydration.toFixed(0), 'sat', c.needs.satiety.toFixed(0), 'en', c.needs.energy.toFixed(0), 'T', c.needs.bodyTemp.toFixed(2), 'wet', c.needs.wetness.toFixed(0), 'sleep', c.sleeping, 'inv', c.inventory.filter(Boolean).map((s) => s!.id + (s!.liquid ? '(' + s!.liquid.ml.toFixed(0) + '/' + s!.liquid.contam.toFixed(2) + ')' : '') + 'x' + s!.qty).join(' '));
      }
    }
  }
  const fires = [...(game.index.byType.get('campfire') ?? [])].map((id) => state.objects[id]);
  console.log('fires', JSON.stringify(fires));
}, 120000);
