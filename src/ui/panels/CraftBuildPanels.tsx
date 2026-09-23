import { useState } from 'react';
import type { GameSession } from '../session';
import { Panel, useSession } from '../common';
import { allRecipeStatus, startCraft } from '@/sim/crafting';
import { itemDef } from '@/content/items';
import { iconUrl } from '@/render/icons';
import { BUILDABLE, type BuildCategory } from '@/content/objects';
import { missingMaterials, availableMaterial } from '@/sim/building';
import { bestTool } from '@/sim/inventory';
import { skillName } from '@/content/skills';

export function CraftPanel({ session }: { session: GameSession }) {
  useSession(session);
  const g = session.game;
  const p = g.player;
  const list = allRecipeStatus(g, p);
  const [filter, setFilter] = useState<'all' | 'fire' | 'can'>('all');
  const shown = list.filter((r) => (filter === 'fire' ? r.recipe.station === 'fire' : filter === 'can' ? r.can : true));
  return (
    <Panel title="Crafting" onClose={() => session.openPanel(null)} width={620}>
      <div className="tabs" style={{ marginBottom: 8 }}>
        {(['all', 'can', 'fire'] as const).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'can' ? 'Can make now' : 'Cooking'}
          </button>
        ))}
      </div>
      <div className="col" style={{ gap: 0 }}>
        {shown.map((st) => {
          const r = st.recipe;
          const out = Object.entries(r.outputs)[0];
          return (
            <div key={r.id} className="list-row">
              <div className="row">
                <img src={iconUrl(out[0])} width={32} height={32} style={{ imageRendering: 'pixelated' }} alt="" />
                <div className="col" style={{ gap: 0 }}>
                  <span>
                    {r.name} <span className="faint">-&gt; {out[1]} {itemDef(out[0]).name}</span>
                  </span>
                  <span className="muted" style={{ fontSize: '0.85em' }}>
                    {Object.entries(r.inputs)
                      .map(([id, n]) => `${n} ${itemDef(id).name}`)
                      .join(', ')}
                    {r.tool ? ` | tool: ${r.tool === 'cut' ? 'knife' : r.tool === 'boil' ? 'pot' : r.tool}` : ''}
                    {r.station ? ` | at a ${r.station === 'fire' ? 'lit fire' : 'workbench'}` : ''}
                  </span>
                  {!st.can && <span className="bad" style={{ fontSize: '0.8em' }}>{st.missing.join(', ')}</span>}
                </div>
              </div>
              <div className="row">
                <span className="faint" style={{ fontSize: '0.8em' }}>
                  {Math.round(st.minutes)} min | {skillName(r.skill)}
                </span>
                <button className="primary" disabled={!st.can} onClick={() => startCraft(g, p, r.id) && session.openPanel(null)}>
                  Make
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

const CATS: [BuildCategory, string][] = [
  ['fire', 'Fire'],
  ['shelter', 'Shelter'],
  ['sanitation', 'Sanitation'],
  ['storage', 'Storage'],
  ['water', 'Water'],
  ['food', 'Food'],
  ['work', 'Work'],
  ['construction', 'Construction'],
];

export function BuildPanel({ session }: { session: GameSession }) {
  useSession(session);
  const g = session.game;
  const p = g.player;
  const [cat, setCat] = useState<BuildCategory>('fire');
  const items = BUILDABLE.filter((d) => d.build!.category === cat);
  return (
    <Panel title="Build" onClose={() => session.openPanel(null)} width={640}>
      <div className="tabs" style={{ marginBottom: 8 }}>
        {CATS.map(([c, label]) => (
          <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
            {label}
          </button>
        ))}
      </div>
      <p className="faint" style={{ margin: '0 0 6px' }}>
        Materials can come from your inventory or storage within a few steps. Placing commits the materials; the site then needs work.
      </p>
      <div className="col" style={{ gap: 0 }}>
        {items.map((d) => {
          const b = d.build!;
          const missing = missingMaterials(g, p, d.id);
          const toolOk = !b.tool || !!bestTool(p, b.tool);
          return (
            <div key={d.id} className="list-row">
              <div className="col" style={{ gap: 0 }}>
                <span>
                  {d.name} <span className="faint">({d.w ?? 1}x{d.h ?? 1})</span>
                </span>
                <span className="muted" style={{ fontSize: '0.85em' }}>
                  {b.desc}
                </span>
                <span style={{ fontSize: '0.85em' }}>
                  {Object.entries(b.materials).length === 0 && <span className="faint">No materials </span>}
                  {Object.entries(b.materials).map(([id, n]) => {
                    const have = availableMaterial(g, p, id);
                    return (
                      <span key={id} className={have >= n ? 'good' : 'bad'} style={{ marginRight: 10 }}>
                        {itemDef(id).name} {Math.min(have, n)}/{n}
                      </span>
                    );
                  })}
                  {b.tool && <span className={toolOk ? 'good' : 'warn'}>needs {b.tool === 'dig' ? 'a shovel or digging stick' : b.tool}</span>}
                </span>
              </div>
              <div className="row">
                <span className="faint" style={{ fontSize: '0.8em' }}>
                  ~{b.minutes} min
                </span>
                <button className="primary" disabled={missing.length > 0} onClick={() => session.beginBuild(d.id)}>
                  Place
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
