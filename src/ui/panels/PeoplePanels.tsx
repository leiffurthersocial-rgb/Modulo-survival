import { useState } from 'react';
import type { GameSession } from '../session';
import { Bar, ItemSlot, Panel, Pips, Portrait, needColor, useSession } from '../common';
import type { Character, OrderId } from '@/sim/types';
import { ATTRIBUTES, SKILLS, TRAITS } from '@/content/skills';
import { statusById } from '@/content/statuses';
import { formatClock, dayOf } from '@/sim/clock';
import { maxHp, clothingInsulation } from '@/sim/body';
import { compassName } from '@/sim/npc';

const ORDERS: [OrderId, string][] = [
  ['none', 'Decide for themselves'],
  ['follow', 'Follow me'],
  ['stay', 'Stay here'],
  ['gatherWood', 'Gather wood'],
  ['gatherFood', 'Gather food'],
  ['gatherWater', 'Gather water'],
  ['build', 'Help with construction'],
  ['cook', 'Cook'],
  ['fish', 'Fish'],
  ['hunt', 'Hunt'],
  ['explore', 'Explore'],
  ['watchCamp', 'Watch camp'],
  ['rest', 'Rest'],
  ['returnCamp', 'Return to camp'],
];

function relationWord(a: number): string {
  if (a > 60) return 'Close friend';
  if (a > 30) return 'Friend';
  if (a > 5) return 'Friendly';
  if (a > -15) return 'Neutral';
  if (a > -40) return 'Tense';
  return 'Hostile';
}

export function CharacterSheet({ session, c }: { session: GameSession; c: Character }) {
  const g = session.game;
  const n = c.needs;
  const statuses = c.statuses.map((s) => statusById(s)).filter(Boolean);
  const ins = clothingInsulation(c);
  const rels = Object.values(g.state.characters)
    .filter((o) => o.id !== c.id)
    .map((o) => ({ o, r: g.social.get(c.id, o.id) }))
    .sort((a, b) => b.r.affinity - a.r.affinity);
  const isPlayer = c.id === g.state.playerId;
  const eqSlots = ['head', 'outer', 'torso', 'legs', 'feet', 'hands', 'back', 'hand'] as const;
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
      <div className="col" style={{ width: 230 }}>
        <div className="row">
          <Portrait c={c} scale={4} />
          <div className="col" style={{ gap: 0 }}>
            <h3 style={{ color: 'var(--accent)' }}>{c.name}</h3>
            <span className="muted">Age {c.age}</span>
            <span className={c.alive ? 'good' : 'bad'}>{c.alive ? (c.sleeping ? 'Sleeping' : isPlayer ? 'You' : c.ai.taskLabel) : `Died day ${c.death?.day}: ${c.death?.cause}`}</span>
          </div>
        </div>
        <span className="muted" style={{ fontSize: '0.9em' }}>{c.appearance.description}</span>
        <span style={{ fontSize: '0.9em' }}>{c.personalitySummary}</span>
        <span className="faint" style={{ fontSize: '0.85em' }}>{c.background}</span>
        <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
          {c.traits.map((t) => (
            <span key={t} className="chip" title={TRAITS[t].desc}>
              {TRAITS[t].name}
            </span>
          ))}
        </div>
        <div className="slots" style={{ gridTemplateColumns: 'repeat(4, 58px)' }}>
          {eqSlots.map((s) => (
            <ItemSlot key={s} stack={c.equipment[s]} label={s} />
          ))}
        </div>
        <span className="faint" style={{ fontSize: '0.85em' }}>
          Clothing warmth {ins.warmth.toFixed(1)}, rain protection {Math.round(ins.waterproof * 100)}%
        </span>
      </div>

      <div className="col" style={{ width: 290 }}>
        <h3>Condition</h3>
        <div className="bars2">
          {(
            [
              ['Health', c.health.hp, maxHp(c), false],
              ['Food', n.satiety, 100, false],
              ['Reserves', n.reserves, 100, false],
              ['Water', n.hydration, 100, false],
              ['Rest', n.energy, 100, false],
              ['Hygiene', n.hygiene, 100, false],
              ['Toilet', n.bladder, 100, true],
              ['Wetness', n.wetness, 100, true],
              ['Stress', n.stress, 100, true],
              ['Morale', n.morale, 100, false],
            ] as [string, number, number, boolean][]
          ).map(([l, v, m, inv]) => (
            <div key={l} style={{ display: 'contents' }}>
              <span className="muted">{l}</span>
              <Bar v={v} max={m} color={needColor((v / m) * 100, inv)} />
              <span className="faint">{Math.round(v)}</span>
            </div>
          ))}
          <span className="muted">Body temp.</span>
          <span className={n.bodyTemp < 35.5 ? 'bad' : n.bodyTemp < 36.4 ? 'warn' : 'good'}>{n.bodyTemp.toFixed(1)} °C</span>
          <span />
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
          {statuses.map((s) => (
            <span key={s!.id} className={`chip ${s!.tone}`} title={s!.desc}>
              {s!.name}
            </span>
          ))}
        </div>
        {c.health.injuries.length > 0 && (
          <div className="col" style={{ gap: 0 }}>
            {c.health.injuries.map((i) => (
              <span key={i.id} className={i.bleeding > 0.05 && !i.bandaged ? 'bad' : 'warn'} style={{ fontSize: '0.9em' }}>
                {i.severity > 0.5 ? 'Bad' : i.severity > 0.25 ? 'Moderate' : 'Minor'} {i.type === 'animalWound' ? 'animal wound' : i.type}
                {i.bandaged ? ', bandaged' : i.bleeding > 0.05 ? ', bleeding' : ''}
                {i.infection > 0.3 ? ', infected' : ''}
              </span>
            ))}
          </div>
        )}
        {c.health.illnesses.map((i) => (
          <span key={i.type} className="bad" style={{ fontSize: '0.9em' }}>
            {{ stomachBug: 'Stomach illness', foodPoisoning: 'Food poisoning', cold: 'Head cold', hypothermia: 'Hypothermia', infectionFever: 'Fever' }[i.type]} ({Math.round(i.severity * 100)}%)
          </span>
        ))}
      </div>

      <div className="col" style={{ width: 290 }}>
        <h3>Attributes</h3>
        <div className="stat-grid">
          {ATTRIBUTES.map((a) => (
            <div key={a.id} style={{ display: 'contents' }} title={a.desc}>
              <span className="muted">{a.name}</span>
              <Pips n={c.attributes[a.id]} />
              <span>{c.attributes[a.id]}</span>
            </div>
          ))}
        </div>
        <h3 style={{ marginTop: 6 }}>Skills</h3>
        <div className="stat-grid">
          {SKILLS.map((s) => (
            <div key={s.id} style={{ display: 'contents' }} title={s.desc}>
              <span className="muted">{s.name}</span>
              <Pips n={c.skills[s.id]} />
              <span>{c.skills[s.id].toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      {!isPlayer && (
        <div className="col" style={{ width: 250 }}>
          <h3>Relationships</h3>
          <div className="col" style={{ gap: 0, maxHeight: 300, overflow: 'auto' }}>
            {rels.map(({ o, r }) => (
              <div key={o.id} className="spread" style={{ fontSize: '0.9em' }}>
                <span className={o.alive ? '' : 'faint'}>
                  {o.name}
                  {o.id === g.state.playerId ? ' (you)' : ''}
                </span>
                <span className={r.partners ? 'good' : r.rivals ? 'bad' : 'muted'}>{r.partners ? 'Partner' : r.rivals ? 'Rival' : relationWord(r.affinity)}</span>
              </div>
            ))}
          </div>
          <h3 style={{ marginTop: 6 }}>Remembers</h3>
          <div className="col" style={{ gap: 0, fontSize: '0.85em' }}>
            {c.memories.slice(-6).reverse().map((m, i) => (
              <span key={i} className={m.weight < 0 ? 'warn' : 'muted'}>
                Day {m.day}: {m.text}
              </span>
            ))}
            {c.memories.length === 0 && <span className="faint">Nothing notable yet.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function CharacterPanel({ session }: { session: GameSession }) {
  useSession(session);
  return (
    <Panel title="Character" onClose={() => session.openPanel(null)}>
      <CharacterSheet session={session} c={session.game.player} />
    </Panel>
  );
}

export function GroupPanel({ session }: { session: GameSession }) {
  useSession(session);
  const g = session.game;
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<'people' | 'expeditions'>('people');
  const npcs = Object.values(g.state.characters).filter((c) => c.id !== g.state.playerId);
  const selected = sel ? g.state.characters[sel] : undefined;
  const p = g.player;
  const where = (c: Character) => {
    if (!c.alive) return 'Dead';
    const d = Math.hypot(c.x - g.home.x, c.y - g.home.y);
    if (d < 24) return 'At camp';
    const seen = c.lastSeen;
    if (!seen) return 'Away (not seen)';
    const hrs = (g.state.time - seen.t) / 60;
    return `Away, last seen ${hrs < 1 ? 'recently' : `${Math.floor(hrs)} h ago`} to the ${compassName(Math.atan2(seen.y - g.home.y, seen.x - g.home.x))}`;
  };
  if (selected) {
    return (
      <Panel title={selected.name} onClose={() => setSel(null)} actions={<button onClick={() => setSel(null)}>Back</button>}>
        <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
          <span className="muted">Order:</span>
          <select value={selected.ai.order} onChange={(e) => (g.setOrder([selected.id], e.target.value as OrderId), session.bump())} disabled={!selected.alive}>
            {ORDERS.map(([id, l]) => (
              <option key={id} value={id}>
                {l}
              </option>
            ))}
          </select>
          <span className="faint">{where(selected)}</span>
        </div>
        <CharacterSheet session={session} c={selected} />
      </Panel>
    );
  }
  const exps = [...g.state.expeditions].reverse();
  return (
    <Panel title="The Group" onClose={() => session.openPanel(null)} width={920}>
      <div className="spread" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <div className="tabs">
          <button className={tab === 'people' ? 'on' : ''} onClick={() => setTab('people')}>
            Classmates
          </button>
          <button className={tab === 'expeditions' ? 'on' : ''} onClick={() => setTab('expeditions')}>
            Expeditions
          </button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
          <span className="muted">Everyone at camp:</span>
          {(['none', 'follow', 'gatherWood', 'gatherFood', 'gatherWater', 'build', 'rest', 'returnCamp'] as OrderId[]).map((o) => (
            <button
              key={o}
              onClick={() => {
                const near = npcs.filter((c) => c.alive && (o === 'returnCamp' || Math.hypot(c.x - p.x, c.y - p.y) < 30 || Math.hypot(c.x - g.home.x, c.y - g.home.y) < 30));
                g.setOrder(near.map((c) => c.id), o);
                session.toast(`Order given: ${ORDERS.find((x) => x[0] === o)![1]}.`, 'info');
              }}
            >
              {ORDERS.find((x) => x[0] === o)![1]}
            </button>
          ))}
        </div>
      </div>
      {tab === 'people' ? (
        <div className="col" style={{ gap: 0 }}>
          {npcs.map((c) => (
            <div key={c.id} className="list-row" onClick={() => setSel(c.id)} style={{ cursor: 'pointer', opacity: c.alive ? 1 : 0.5 }}>
              <div className="row" style={{ width: 200 }}>
                <Portrait c={c} scale={2} />
                <div className="col" style={{ gap: 0 }}>
                  <span>{c.name}</span>
                  <span className="faint" style={{ fontSize: '0.8em' }}>
                    {c.alive ? (c.sleeping ? 'Sleeping' : c.ai.taskLabel) : 'Dead'}
                  </span>
                </div>
              </div>
              <span className="muted" style={{ width: 250, fontSize: '0.85em' }}>{where(c)}</span>
              <div className="row" style={{ width: 300, gap: 6 }}>
                {(
                  [
                    ['HP', c.health.hp],
                    ['Food', c.needs.satiety],
                    ['Water', c.needs.hydration],
                    ['Rest', c.needs.energy],
                    ['Mood', c.needs.morale],
                  ] as [string, number][]
                ).map(([l, v]) => (
                  <div key={l} className="col" style={{ gap: 0, width: 52 }}>
                    <span className="faint" style={{ fontSize: '0.7em' }}>{l}</span>
                    <Bar v={v} color={needColor(v)} />
                  </div>
                ))}
              </div>
              <span className="muted" style={{ fontSize: '0.85em', width: 110 }}>
                {ORDERS.find((o) => o[0] === c.ai.order)?.[1]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="col" style={{ gap: 0 }}>
          {exps.length === 0 && <span className="faint">No expeditions yet. Order curious classmates to explore, or they will go on their own once camp is established.</span>}
          {exps.map((e) => (
            <div key={e.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div className="col" style={{ gap: 0 }}>
                <span>{e.members.map((m) => g.state.characters[m]?.name).join(', ')}</span>
                <span className="muted" style={{ fontSize: '0.85em' }}>{e.objective}</span>
                {e.log.filter((l) => l !== 'overdue').slice(-3).map((l, i) => (
                  <span key={i} className="faint" style={{ fontSize: '0.8em' }}>
                    {l}
                  </span>
                ))}
              </div>
              <div className="col" style={{ gap: 0, alignItems: 'flex-end' }}>
                <span className={e.status === 'returned' ? 'good' : e.status === 'lost' ? 'bad' : e.status === 'sheltering' ? 'warn' : 'info'}>{e.status}</span>
                <span className="faint" style={{ fontSize: '0.8em' }}>
                  Left day {dayOf(e.departed)} {formatClock(e.departed)}
                </span>
                {e.status !== 'returned' && e.status !== 'lost' && (
                  <span className={g.state.time > e.expectedReturn ? 'warn' : 'muted'} style={{ fontSize: '0.8em' }}>
                    Expected back {formatClock(e.expectedReturn)}
                    {dayOf(e.expectedReturn) !== dayOf(g.state.time) ? ` (day ${dayOf(e.expectedReturn)})` : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
