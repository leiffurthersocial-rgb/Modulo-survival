import { useState } from 'react';
import type { GameSession } from './session';
import { useSession } from './common';
import { OBJECTIVES, objectiveDone } from '@/sim/objectives';

/** The card a brand-new world opens with: who you are, what to do first. */
export function WelcomeCard({ session }: { session: GameSession }) {
  const g = session.game;
  const p = g.player;
  const close = (help: boolean) => {
    if (!g.state.hints.includes('welcome')) g.state.hints.push('welcome');
    session.openPanel(help ? 'help' : null);
  };
  return (
    <div className="panel welcome-card">
      <div className="panel-title">
        <h2>Day 1, early morning</h2>
      </div>
      <div className="panel-body col" style={{ gap: 10 }}>
        <p style={{ margin: 0 }}>
          You are <b>{p.name}</b>. Yesterday the city went dark and silent. Sixteen of you from the class walked out into the forest near Bülach with a single
          supply bag. Nobody knows what happened, and nobody is coming.
        </p>
        <p style={{ margin: 0 }}>
          The others will look after themselves as best they can. Your job is to stay alive and help the group through the first night.
        </p>
        <div className="welcome-keys">
          <span><span className="key">W</span><span className="key">A</span><span className="key">S</span><span className="key">D</span> walk</span>
          <span><span className="key">E</span> use what is in front of you</span>
          <span><span className="key">I</span> your bag</span>
          <span><span className="key">B</span> build</span>
          <span><span className="key">Z</span> sleep</span>
          <span><span className="key">P</span> pause</span>
          <span><span className="key">?</span> how to play</span>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          The <b>First steps</b> list on the right tells you what to do next and ticks itself off. The supply bag is right beside you: start there.
        </p>
        <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={() => close(true)}>Read how to play</button>
          <button className="primary" onClick={() => close(false)}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

/** "First steps" checklist on the HUD; disappears once everything is done. */
export function FirstSteps({ session }: { session: GameSession }) {
  useSession(session);
  const g = session.game;
  const h = g.state.hints;
  const [open, setOpen] = useState(!h.includes('goals_hidden'));
  if (h.includes('goals_done') || !g.player.alive) return null;
  const next = OBJECTIVES.find((o) => !objectiveDone(g, o.id));
  const count = OBJECTIVES.filter((o) => objectiveDone(g, o.id)).length;
  const toggle = () => {
    const v = !open;
    setOpen(v);
    const i = h.indexOf('goals_hidden');
    if (!v && i < 0) h.push('goals_hidden');
    if (v && i >= 0) h.splice(i, 1);
  };
  return (
    <div className="panel first-steps">
      <button className="ghost first-steps-head" onClick={toggle} title={open ? 'Hide' : 'Show'}>
        <span>First steps</span>
        <span className="muted">
          {count}/{OBJECTIVES.length} {open ? 'hide' : 'show'}
        </span>
      </button>
      {open && (
        <div className="col" style={{ gap: 3 }}>
          {OBJECTIVES.map((o) => {
            const done = objectiveDone(g, o.id);
            const isNext = o === next;
            return (
              <div key={o.id} className={`step ${done ? 'done' : ''} ${isNext ? 'next' : ''}`}>
                <span className="box">{done ? 'x' : ''}</span>
                <div className="col" style={{ gap: 1 }}>
                  <span>{o.title}</span>
                  {isNext && <span className="how">{o.how}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!open && next && <div className="how">Next: {next.title}</div>}
    </div>
  );
}
