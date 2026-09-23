import { useEffect, useRef } from 'react';
import type { GameSession } from './session';
import { Bar, Key, needColor, useSession } from './common';
import { formatClock, formatDate, dayOf, daylight } from '@/sim/clock';
import { WEATHER } from '@/content/weather';
import { statusById } from '@/content/statuses';
import { ACTIONS } from '@/sim/actions';
import { KEY_LABELS } from '@/input/input';
import { compassName } from '@/sim/npc';
import { skillLevel } from '@/sim/actions';
import { hash3 } from '@/core/rng';

function Compass({ session }: { session: GameSession }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const g = session.game;
  const home = g.state.homePin;
  const p = g.player;
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !home) return;
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, 36, 36);
    c.fillStyle = '#121612';
    c.beginPath();
    c.arc(18, 18, 16, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#5e6d55';
    c.lineWidth = 2;
    c.stroke();
    // bearing is only as accurate as the navigator's sense of direction
    const nav = skillLevel(p, 'navigation');
    const wobble = ((hash3(g.state.seed, Math.floor(g.state.time / 30), 5) / 4294967296) - 0.5) * Math.max(0, 0.9 - nav * 0.08);
    const a = Math.atan2(home.y - p.y, home.x - p.x) + wobble;
    c.fillStyle = '#d6b25e';
    c.beginPath();
    c.moveTo(18 + Math.cos(a) * 13, 18 + Math.sin(a) * 13);
    c.lineTo(18 + Math.cos(a + 2.5) * 7, 18 + Math.sin(a + 2.5) * 7);
    c.lineTo(18 + Math.cos(a - 2.5) * 7, 18 + Math.sin(a - 2.5) * 7);
    c.fill();
    c.fillStyle = '#a9a58f';
    c.fillRect(17, 1, 2, 3);
  });
  if (!home) return null;
  const dist = Math.hypot(home.x - p.x, home.y - p.y) * 1.5;
  // rounded like a rough estimate, not a GPS readout
  const approx = dist < 15 ? 'here' : dist < 100 ? `about ${Math.round(dist / 10) * 10} m` : `about ${Math.round(dist / 50) * 50} m`;
  const dir = compassName(Math.atan2(home.y - p.y, home.x - p.x));
  return (
    <div className="panel compass" title="Home Pin bearing">
      <canvas ref={ref} width={36} height={36} />
      <div className="col" style={{ gap: 0 }}>
        <span className="muted" style={{ fontSize: '0.8em' }}>
          CAMP
        </span>
        <span>{dist < 15 ? 'You are at camp' : `${approx} ${dir}`}</span>
      </div>
    </div>
  );
}

const TOOLBAR: [string, keyof typeof KEY_LABELS, string][] = [
  ['Bag', 'inventory', 'inventory'],
  ['Craft', 'craft', 'craft'],
  ['Build', 'build', 'build'],
  ['Map', 'map', 'map'],
  ['Group', 'group', 'group'],
  ['Camp', 'camp', 'camp'],
  ['Self', 'character', 'character'],
  ['Log', 'journal', 'journal'],
];

export function Hud({ session }: { session: GameSession }) {
  useSession(session);
  const g = session.game;
  const p = g.player;
  const s = g.state;
  const n = p.needs;
  const w = WEATHER[s.weather.current];
  const act = p.action && p.action.type !== 'sleep' ? p.action : undefined;
  const statuses = p.statuses.map((id) => statusById(id)).filter(Boolean);
  const temp = Math.round(s.weather.temp);
  const dl = daylight(s.time);
  const needs: [string, number, boolean][] = [
    ['Food', n.satiety, false],
    ['Water', n.hydration, false],
    ['Rest', n.energy, false],
    ['Stamina', n.stamina, false],
    ['Warmth', ((n.bodyTemp - 33) / 4.2) * 100, false],
    ['Clean', n.hygiene, false],
    ['Toilet', n.bladder, true],
    ['Health', p.health.hp, false],
  ];
  return (
    <div className="hud">
      <div className="panel hud-clock">
        <div className="spread">
          <span className="time">{formatClock(s.time)}</span>
          <span className="muted">{dl < 0.3 ? 'Night' : dl < 0.95 ? 'Twilight' : 'Day'}</span>
        </div>
        <div className="date">{formatDate(s.time)}</div>
        <div className="muted">
          {w.name}, {temp}°C{s.weather.wind > 6 ? ', windy' : ''}
        </div>
        <div className="faint" style={{ fontSize: '0.8em' }}>
          Day {dayOf(s.time) - dayOf(s.startTime ?? 0) + 1} in the forest{session.game.timeScale > 1.5 ? `  >> x${Math.round(session.game.timeScale)}` : ''}
        </div>
      </div>

      <div className="hud-right">
        <Compass session={session} />
      </div>

      {session.ui.hint && (
        <div className="panel hud-hint" onClick={() => (session.ui.hint = undefined)}>
          <div className="h">NOTE</div>
          <div>{session.ui.hint.text}</div>
        </div>
      )}

      <div className="hud-status">
        {statuses.slice(0, 7).map((st) => (
          <span key={st!.id} className={`chip ${st!.tone}`} title={st!.desc}>
            {st!.name}
          </span>
        ))}
      </div>

      <div className="panel hud-needs">
        {needs.map(([label, v, inv]) => (
          <div key={label} style={{ display: 'contents' }}>
            <span className="need-label">{label}</span>
            <Bar v={v} color={needColor(v, inv)} />
          </div>
        ))}
      </div>

      {act && (
        <div className="hud-action panel" style={{ padding: '4px 8px' }}>
          <span>{ACTIONS[act.type]?.label ?? act.type}...</span>
          {Number.isFinite(act.duration) && (
            <div className="progress">
              <div style={{ width: `${Math.min(100, (act.elapsed / act.duration) * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      {session.ui.prompt && !session.ui.menu && !session.ui.panel && (session.ui.prompt.label || session.ui.prompt.name) && (
        <div className="hud-prompt">
          {session.ui.prompt.label && <Key k={session.ui.buildType ? 'E' : p.sleeping ? 'E' : 'E'} />}
          {session.ui.prompt.label}
          {session.ui.prompt.name && <span className="muted"> {session.ui.buildType ? session.ui.prompt.name : `- ${session.ui.prompt.name}`}</span>}
        </div>
      )}

      {session.ui.menu && <ContextMenuView session={session} />}

      <div className="panel toolbar">
        {TOOLBAR.map(([label, key, panel]) => (
          <button key={label} className={session.ui.panel === panel ? 'primary' : ''} onClick={() => session.openPanel(panel as never)} title={`${label} (${KEY_LABELS[key]})`}>
            <span>{label}</span>
            <span className="k">{KEY_LABELS[key]}</span>
          </button>
        ))}
      </div>

      <div className="hud-toasts">
        {session.toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function ContextMenuView({ session }: { session: GameSession }) {
  const m = session.ui.menu!;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = Number(e.key);
      if (d >= 1 && d <= 9) {
        session.runMenuItem(d - 1);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session]);
  return (
    <div className="panel ctx-menu">
      <div className="panel-title">
        <h2>{m.title}</h2>
        <button className="ghost" onClick={() => ((session.ui.menu = undefined), session.bump())}>
          X
        </button>
      </div>
      <div className="panel-body col" style={{ gap: 3 }}>
        {m.items.map((it, i) => (
          <button key={it.id + i} disabled={!it.enabled} onClick={() => session.runMenuItem(i)} title={it.reason}>
            <span>
              <span className="key">{i + 1}</span>
              {it.label}
            </span>
            {!it.enabled && it.reason && <span className="faint">{it.reason}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
