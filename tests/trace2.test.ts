import { it } from 'vitest';
import { generateWorld } from '@/gen/world';
import { Game } from '@/sim/game';
import { formatClock, dayOf } from '@/sim/clock';

function countItemAll(game: Game, id: string): number {
  let n = 0;
  for (const c of Object.values(game.state.characters)) for (const s of c.inventory) if (s?.id === id) n += s.qty;
  for (const o of Object.values(game.state.objects)) if (o.inv) for (const s of o.inv) if (s?.id === id) n += s.qty;
  return n;
}
function countIgn(game: Game): string {
  let m = 0;
  let l = 0;
  for (const c of Object.values(game.state.characters)) for (const s of c.inventory) { if (s?.id === 'matches') m += s.charge ?? 0; if (s?.id === 'lighter') l += s.charge ?? 0; }
  for (const o of Object.values(game.state.objects)) if (o.inv) for (const s of o.inv) { if (s?.id === 'matches') m += s.charge ?? 0; if (s?.id === 'lighter') l += s.charge ?? 0; }
  return `m${m}/l${l}`;
}
it('trace2', () => {
  const state = generateWorld({ seed: 12345, mode: 'normal', playerId: 'leif' });
  const game = new Game(state);
  const p = state.characters['leif'];
  p.alive = false; // take the idle player out of the picture
  state.playerId = 'robin';
  game.switchPlayer('robin');
  state.characters['robin'].alive = true;
  const tasks: Record<string, number> = {};
  for (let i = 0; i < 60 * 60 * 24 * 5 / 6; i++) {
    game.update(0.1);
    if (i === 1000) game.setHomePin(state.startPoint.x + 2, state.startPoint.y + 2);
    for (const c of game.npcs()) tasks[c.ai.task] = (tasks[c.ai.task] ?? 0) + 1;
    if (i % 1200 === 0) {
      const fires = [...(game.index.byType.get('campfire') ?? [])].map((id) => state.objects[id]).filter((o) => Math.hypot(o.x - game.home.x, o.y - game.home.y) < 25);
      const shelters = ['lean_to', 'latrine'].map((t) => [...(game.index.byType.get(t) ?? [])].map((id) => state.objects[id]).map((o) => `${t}:${o.build === undefined ? 'done' : o.build.toFixed(2)}`).join(','));
      const npcs = game.npcs();
      const avgT = npcs.reduce((a, c) => a + c.needs.bodyTemp, 0) / npcs.length;
      const avgWet = npcs.reduce((a, c) => a + c.needs.wetness, 0) / npcs.length;
      const avgE = npcs.reduce((a, c) => a + c.needs.energy, 0) / npcs.length;
      const avgH = npcs.reduce((a, c) => a + c.needs.hydration, 0) / npcs.length;
      const avgR = npcs.reduce((a, c) => a + c.needs.reserves, 0) / npcs.length;
      const top = Object.entries(tasks).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}:${Math.round(v / 12)}`).join(' ');
      console.log(`D${dayOf(state.time)} ${formatClock(state.time)} ${state.weather.current} ${state.weather.temp.toFixed(1)}C alive ${npcs.length} T ${avgT.toFixed(2)} wet ${avgWet.toFixed(0)} E ${avgE.toFixed(0)} H ${avgH.toFixed(0)} R ${avgR.toFixed(0)} fires ${fires.map((f) => `${f.lit ? 'LIT' : 'out'}:${(f.s ?? 0).toFixed(0)}${f.build !== undefined ? 'site' : ''}`).join(',')} ${shelters.join(' ')} | ${top} | ign ${countIgn(game)} fish ${countItemAll(game,'raw_fish')+countItemAll(game,'cooked_fish')} rods ${countItemAll(game,'fishing_rod')} spears ${countItemAll(game,'spear')} water ${game.campWaterLitres().toFixed(1)} food ${game.campFoodDays().toFixed(2)}`);
      for (const k in tasks) delete tasks[k];
    }
  }
}, 300000);
