import { useState } from 'react';
import type { GameSession } from './session';
import { Panel, useSession } from './common';
import { formatClock, dayOf, season } from '@/sim/clock';
import { setWeather } from '@/sim/weather';
import { ITEMS } from '@/content/items';
import { makeStack } from '@/gen/characters';
import { addItem } from '@/sim/inventory';
import { pathStats } from '@/sim/pathfinding';
import { log } from '@/core/logger';
import type { WeatherId } from '@/sim/types';
import { maxHp } from '@/sim/body';

/** Developer tools. Only reachable with ?debug in the URL or in dev builds. */
export function DebugPanel({ session }: { session: GameSession }) {
  useSession(session);
  const g = session.game;
  const s = g.state;
  const p = g.player;
  const [item, setItem] = useState('hatchet');
  const [inspect, setInspect] = useState<string>('');
  const advance = (min: number) => {
    g.advance(min);
    session.bump();
  };
  const npc = inspect ? s.characters[inspect] : undefined;
  return (
    <div className="debug">
      <Panel title="Debug" onClose={() => ((session.ui.debug = false), session.bump())}>
        <div className="col" style={{ gap: 4 }}>
          <span>
            FPS {session.fps.toFixed(0)} | sim {g.perf.simMs.toFixed(2)} ms | render {session.renderer.frameMs.toFixed(2)} ms
          </span>
          <span>
            Ticks {g.perf.ticks} | NPC near {g.perf.nearNpcs} far {g.perf.farNpcs} | speed x{g.timeScale.toFixed(0)}
          </span>
          <span>
            Paths {pathStats.requests} (failed {pathStats.failures}) | errors {log.errorCount()}
          </span>
          <span>
            Day {dayOf(s.time)} {formatClock(s.time)} {season(s.time).name} | {s.weather.current} {s.weather.temp.toFixed(1)}C wind {s.weather.wind.toFixed(1)} dry {s.weather.dryness.toFixed(2)}
          </span>
          <span>
            Pos {p.x.toFixed(1)},{p.y.toFixed(1)} | objects {Object.keys(s.objects).length} | animals {Object.keys(s.animals).length} | burning {g.burning.size}
          </span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 3 }}>
            <button onClick={() => advance(60)}>+1h</button>
            <button onClick={() => advance(360)}>+6h</button>
            <button onClick={() => (g.settings.speed = g.settings.speed === 1 ? 10 : 1)}>Speed x{g.settings.speed === 1 ? 10 : 1}</button>
            <button onClick={() => (g.settings.aiEnabled = !g.settings.aiEnabled)}>AI {g.settings.aiEnabled ? 'on' : 'off'}</button>
            <button onClick={() => (g.settings.fogOfWar = !g.settings.fogOfWar)}>Fog {g.settings.fogOfWar ? 'on' : 'off'}</button>
            <button onClick={() => (g.settings.godMode = !g.settings.godMode)}>God {g.settings.godMode ? 'on' : 'off'}</button>
            <button
              onClick={() => {
                const n = p.needs;
                Object.assign(n, { satiety: 100, hydration: 100, energy: 100, stamina: 100, bladder: 0, hygiene: 100, bodyTemp: 37, wetness: 0, stress: 0 });
                p.health.hp = maxHp(p);
                p.health.injuries = [];
                p.health.illnesses = [];
              }}
            >
              Heal
            </button>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 3 }}>
            {(['clear', 'cloudy', 'lightRain', 'heavyRain', 'fog', 'snow', 'thunderstorm'] as WeatherId[]).map((w) => (
              <button key={w} onClick={() => setWeather(g, w)} style={{ fontSize: '0.8em', minHeight: 26 }}>
                {w}
              </button>
            ))}
          </div>
          <div className="row">
            <select value={item} onChange={(e) => setItem(e.target.value)}>
              {Object.keys(ITEMS).map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
            <button onClick={() => addItem(p.inventory, makeStack(item, 1))}>Add item</button>
          </div>
          <span className="faint">Shift-click on the map to teleport.</span>
          <select value={inspect} onChange={(e) => setInspect(e.target.value)}>
            <option value="">Inspect entity...</option>
            {Object.values(s.characters).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {npc && (
            <pre style={{ fontSize: '0.75em', whiteSpace: 'pre-wrap', margin: 0 }}>
              {JSON.stringify({ task: npc.ai.task, order: npc.ai.order, action: npc.action?.type, pos: [npc.x.toFixed(1), npc.y.toFixed(1)], target: [npc.ai.targetX?.toFixed(1), npc.ai.targetY?.toFixed(1)], needs: Object.fromEntries(Object.entries(npc.needs).map(([k, v]) => [k, Math.round(v * 10) / 10])), hp: Math.round(npc.health.hp), blocked: npc.ai.blocked }, null, 1)}
            </pre>
          )}
          <div className="col" style={{ gap: 0, maxHeight: 120, overflow: 'auto' }}>
            {log
              .records()
              .slice(-8)
              .map((r, i) => (
                <span key={i} className={r.level === 'error' ? 'bad' : r.level === 'warn' ? 'warn' : 'faint'} style={{ fontSize: '0.75em' }}>
                  [{r.scope}] {r.message}
                </span>
              ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
