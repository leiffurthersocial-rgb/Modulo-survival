import { useEffect, useState } from 'react';
import type { GameSession } from '../session';
import { Panel, useSession } from '../common';
import { formatClock, season, dayInSeason, dayOf, sunTimes, year } from '@/sim/clock';
import { SEASON_DAYS } from '@/content/seasons';
import { docById } from '@/sim/loot';
import { objectDef } from '@/content/objects';
import { itemDef } from '@/content/items';
import type { JournalEntry } from '@/sim/types';
import { listSaves, loadGame, exportSave, SLOTS, type SlotId } from '@/save/storage';
import type { SaveMeta } from '@/save/serialize';
import { SettingsForm } from '../SettingsForm';
import type { Settings } from '../settings';
import { WEATHER } from '@/content/weather';

const KIND_CLASS: Record<JournalEntry['kind'], string> = {
  event: 'muted',
  discovery: 'info',
  social: 'muted',
  death: 'bad',
  camp: 'good',
  expedition: 'info',
  danger: 'warn',
  lore: 'warn',
};

export function JournalPanel({ session }: { session: GameSession }) {
  useSession(session);
  const g = session.game;
  const s = g.state;
  const [tab, setTab] = useState<'log' | 'evidence' | 'calendar'>('log');
  const [filter, setFilter] = useState<'all' | JournalEntry['kind']>('all');
  const entries = [...s.journal].reverse().filter((e) => filter === 'all' || e.kind === filter);
  const sun = sunTimes(s.time);
  return (
    <Panel title="Journal" onClose={() => session.openPanel(null)} width={720}>
      <div className="tabs" style={{ marginBottom: 8 }}>
        <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>
          Log
        </button>
        <button className={tab === 'evidence' ? 'on' : ''} onClick={() => setTab('evidence')}>
          Found papers ({s.lore.found.length})
        </button>
        <button className={tab === 'calendar' ? 'on' : ''} onClick={() => setTab('calendar')}>
          Calendar
        </button>
      </div>
      {tab === 'log' && (
        <>
          <div className="tabs" style={{ marginBottom: 6 }}>
            {(['all', 'camp', 'expedition', 'social', 'danger', 'discovery', 'death'] as const).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)} style={{ minHeight: 28, fontSize: '0.85em' }}>
                {f}
              </button>
            ))}
          </div>
          <div className="col" style={{ gap: 2, maxHeight: '60vh', overflow: 'auto' }}>
            {entries.length === 0 && <span className="faint">Nothing written yet.</span>}
            {entries.map((e, i) => (
              <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
                <span className="faint" style={{ width: 92, flexShrink: 0 }}>
                  Day {e.day - dayOf(s.startTime ?? 0) + 1} {formatClock(e.t)}
                </span>
                <span className={KIND_CLASS[e.kind]}>{e.text}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'evidence' && (
        <div className="col">
          {s.lore.found.length === 0 && <span className="faint">You have not found anything that explains what happened. Search abandoned buildings.</span>}
          {s.lore.found.map((id) => {
            const d = docById(g, id);
            if (!d) return null;
            return (
              <button key={id} style={{ textAlign: 'left' }} onClick={() => ((session.ui.doc = id), session.bump())}>
                {d.title}
              </button>
            );
          })}
        </div>
      )}
      {tab === 'calendar' && (
        <div className="col">
          <span>
            Year {year(s.time)}, {season(s.time).name}, day {dayInSeason(s.time)} of {SEASON_DAYS}
          </span>
          <span className="muted">
            Sunrise {formatClock(sun.rise * 60)}, sunset {formatClock(sun.set * 60)}
          </span>
          <span className="muted">
            Now: {WEATHER[s.weather.current].name}, {s.weather.temp.toFixed(0)} °C, wind {s.weather.wind.toFixed(0)} m/s
            {s.weather.snowDepth > 1 ? `, snow ${s.weather.snowDepth.toFixed(0)} cm` : ''}
          </span>
          <span className="muted">Ground: {s.weather.dryness > 0.7 ? 'very dry (fire danger)' : s.weather.dryness > 0.45 ? 'dry' : 'damp'}</span>
          <span className="faint">Days in the forest: {s.stats.daysSurvived + 1}. Structures built: {s.stats.structuresBuilt}. Deaths: {s.stats.deaths}.</span>
        </div>
      )}
    </Panel>
  );
}

export function CampPanel({ session }: { session: GameSession }) {
  useSession(session);
  const g = session.game;
  const h = g.home;
  const s = g.state;
  const structs: Record<string, number> = {};
  const sites: string[] = [];
  let latrineFill = 0;
  g.index.objectsNear(h.x, h.y, 22, (o) => {
    const d = objectDef(o.type);
    if (!d.build) return;
    if (o.build !== undefined) sites.push(`${d.name} (${Math.round(o.build * 100)}%)`);
    else structs[d.name] = (structs[d.name] ?? 0) + 1;
    if (o.type === 'latrine') latrineFill = Math.max(latrineFill, o.s ?? 0);
  });
  const stores: Record<string, number> = {};
  g.index.objectsNear(h.x, h.y, 22, (o) => {
    if (!o.inv || o.type === 'corpse') return;
    for (const st of o.inv) if (st) stores[st.id] = (stores[st.id] ?? 0) + st.qty;
  });
  const living = g.livingCharacters();
  const atCamp = living.filter((c) => Math.hypot(c.x - h.x, c.y - h.y) < 24);
  const avg = (f: (c: (typeof living)[number]) => number) => Math.round(living.reduce((a, c) => a + f(c), 0) / Math.max(1, living.length));
  const contam = g.index.contamAt(h.x, h.y);
  return (
    <Panel title={s.homePin ? 'Camp' : 'Camp (no Home Pin set)'} onClose={() => session.openPanel(null)} width={760}>
      {!s.homePin && <p className="warn">Press H where you want to make camp. The group will gather there and start building.</p>}
      <div className="row" style={{ alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
        <div className="col" style={{ width: 230 }}>
          <h3>People</h3>
          <span>
            {living.length} alive, {atCamp.length} at camp
          </span>
          <span className="muted">Average morale {avg((c) => c.needs.morale)}</span>
          <span className="muted">Average health {avg((c) => c.health.hp)}</span>
          <span className="muted">Food stored: {g.campFoodDays().toFixed(1)} days</span>
          <span className="muted">Clean water: {g.campWaterLitres().toFixed(1)} L</span>
          <span className={contam > 0.3 ? 'bad' : contam > 0.1 ? 'warn' : 'good'}>
            Sanitation: {contam > 0.3 ? 'poor' : contam > 0.1 ? 'worrying' : 'good'}
          </span>
          {latrineFill > 50 && <span className="warn">The latrine is filling up.</span>}
        </div>
        <div className="col" style={{ width: 220 }}>
          <h3>Structures</h3>
          {Object.keys(structs).length === 0 && <span className="faint">Nothing built yet.</span>}
          {Object.entries(structs).map(([n, k]) => (
            <span key={n}>
              {n} {k > 1 ? `x${k}` : ''}
            </span>
          ))}
          {sites.length > 0 && <h3 style={{ marginTop: 6 }}>Under construction</h3>}
          {sites.map((x, i) => (
            <span key={i} className="muted">
              {x}
            </span>
          ))}
        </div>
        <div className="col" style={{ width: 220 }}>
          <h3>Stores</h3>
          {Object.keys(stores).length === 0 && <span className="faint">No shared storage near camp.</span>}
          {Object.entries(stores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 18)
            .map(([id, n]) => (
              <span key={id} className="muted">
                {itemDef(id).name} x{n}
              </span>
            ))}
        </div>
      </div>
    </Panel>
  );
}

export function DocReader({ session }: { session: GameSession }) {
  useSession(session);
  const d = session.ui.doc ? docById(session.game, session.ui.doc) : undefined;
  if (!d) return null;
  return (
    <div className="modal-wrap" style={{ pointerEvents: 'auto' }} onClick={() => ((session.ui.doc = undefined), session.bump())}>
      <div className="doc">
        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{d.title}</div>
        {d.text}
        <div style={{ marginTop: 12, fontSize: '0.8em', opacity: 0.6 }}>Click to put it away.</div>
      </div>
    </div>
  );
}

export function MenuPanel(props: { session: GameSession; settings: Settings; onSettings: (s: Settings) => void; onQuit: () => void; onLoad: (slot: SlotId) => void }) {
  const { session } = props;
  useSession(session);
  const [tab, setTab] = useState<'main' | 'save' | 'settings'>('main');
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const refresh = () => void listSaves().then(setSaves);
  useEffect(refresh, []);
  const doExport = () => {
    const blob = exportSave(session.game.state);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `modulo-${session.game.state.worldName.replace(/\s+/g, '-').toLowerCase()}-day${session.game.state.stats.daysSurvived + 1}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <Panel title="Paused" onClose={() => session.openPanel(null)} width={560}>
      <div className="tabs" style={{ marginBottom: 10 }}>
        <button className={tab === 'main' ? 'on' : ''} onClick={() => setTab('main')}>
          Game
        </button>
        <button className={tab === 'save' ? 'on' : ''} onClick={() => (setTab('save'), refresh())}>
          Save / Load
        </button>
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
          Settings
        </button>
      </div>
      {tab === 'main' && (
        <div className="col" style={{ width: 260 }}>
          <button className="primary" onClick={() => session.openPanel(null)}>
            Resume
          </button>
          <button onClick={() => session.openPanel('help')}>How to play</button>
          <button onClick={() => (setTab('save'), refresh())}>Save or load</button>
          <button onClick={doExport}>Export save file</button>
          <button className="danger" onClick={() => void session.save('auto').then(props.onQuit)}>
            Save and quit to title
          </button>
          <p className="faint" style={{ fontSize: '0.85em' }}>
            Keys: WASD move, Shift sprint, E use what is in front of you, F strike, I inventory, K craft, B build, M map, G group, O camp, C character, J journal, Z sleep, T toilet, H set Home Pin, L light, P pause or close, ? how to play.
          </p>
        </div>
      )}
      {tab === 'save' && (
        <div className="col">
          {SLOTS.map((slot) => {
            const m = saves.find((x) => x.slot === slot);
            return (
              <div key={slot} className="list-row">
                <div className="col" style={{ gap: 0 }}>
                  <span>{slot === 'auto' ? 'Autosave' : `Slot ${slot.slice(-1)}`}</span>
                  <span className="faint" style={{ fontSize: '0.85em' }}>
                    {m ? `${m.worldName}, ${m.playerName}, ${m.season} day ${m.day}, ${m.clock} - ${new Date(m.savedAt).toLocaleString()}` : 'Empty'}
                  </span>
                </div>
                <div className="row">
                  {slot !== 'auto' && <button onClick={() => void session.save(slot).then(refresh)}>Save</button>}
                  <button disabled={!m} onClick={() => props.onLoad(slot)}>
                    Load
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === 'settings' && <SettingsForm settings={props.settings} onChange={props.onSettings} />}
    </Panel>
  );
}

export async function tryLoad(slot: SlotId) {
  return loadGame(slot);
}
