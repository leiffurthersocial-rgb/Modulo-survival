import { it } from 'vitest';
import { newGame } from './helpers';
import { log } from '@/core/logger';
import { formatClock } from '@/sim/clock';
it('long', () => {
  const seed = Number(process.env.SEED ?? 2024);
  const g = newGame(seed);
  g.settings.godMode = true;
  g.advance(60);
  g.setHomePin(g.state.startPoint.x + 1, g.state.startPoint.y + 2);
  const hist: Record<string, string[]> = {};
  g.bus.on('journal', (e) => {
    if (e.kind !== 'death') return;
    const c = Object.values(g.state.characters).find((x) => e.text.startsWith(x.name));
    if (c) console.log('DEATH', e.text, JSON.stringify(Object.fromEntries(Object.entries(c.needs).map(([k, v]) => [k, Math.round(v * 10) / 10]))), 'last tasks', hist[c.id]?.slice(-12).join(' > '), 'pos-home', Math.hypot(c.x - g.home.x, c.y - g.home.y).toFixed(0), 'weather', g.state.weather.current, g.state.weather.temp.toFixed(1));
  });
  for (let d = 0; d < 10; d++) {
    for (let i = 0; i < 24 * 12; i++) {
      g.player.needs.satiety = 80; g.player.needs.hydration = 80; g.player.needs.energy = 80;
      g.advance(5);
      if (i % 3 === 0) for (const c of g.npcs()) { const h = (hist[c.id] ??= []); const tag = `${formatClock(g.state.time)}:${c.ai.task}${c.sleeping ? '(z)' : ''}`; if (!h.length || !h[h.length - 1].endsWith(c.ai.task + (c.sleeping ? '(z)' : ''))) h.push(tag); if (h.length > 40) h.shift(); }
    }
    const n = g.npcs();
    console.log(`day ${d + 1}: alive ${n.length}`, ['satiety', 'reserves', 'hydration', 'energy', 'bodyTemp', 'morale', 'hygiene'].map((k) => k.slice(0, 4) + ' ' + (n.reduce((a, c) => a + (c.needs as any)[k], 0) / Math.max(1, n.length)).toFixed(1)).join(' '), 'hp', (n.reduce((a, c) => a + c.health.hp, 0) / n.length).toFixed(0), 'foodDays', g.campFoodDays().toFixed(2), 'weather', g.state.weather.current, g.state.weather.temp.toFixed(0));
  }
  console.log('errors', log.errorCount());
  console.log(g.state.journal.filter((e) => ['expedition', 'camp', 'death', 'danger'].includes(e.kind) || e.text.includes('killed')).map((e) => `D${e.day} ${formatClock(e.t)} ${e.text}`).join('\n'));
}, 600000);
