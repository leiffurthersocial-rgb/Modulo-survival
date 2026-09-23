import { useEffect, useMemo, useRef, useState } from 'react';
import { generateRoster } from '@/gen/characters';
import type { Character, GameMode } from '@/sim/types';
import { ATTRIBUTES, SKILLS, TRAITS } from '@/content/skills';
import { Pips, Portrait } from './common';
import { listSaves, importSave, deleteSave, SLOTS, type SlotId } from '@/save/storage';
import type { SaveMeta } from '@/save/serialize';
import type { GameState } from '@/sim/types';
import { SettingsForm } from './SettingsForm';
import type { Settings } from './settings';
import { makeCanvas, PixelPainter } from '@/render/pixel';
import { treeSprite } from '@/render/trees';

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** A strip of forest drawn with the in-game tree sprites for the title screen. */
function ForestBanner() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const W = 320;
    const H = 70;
    const { c, g } = makeCanvas(W, H);
    const p = new PixelPainter(g);
    p.rect(0, 0, W, H, '#0e110f');
    const types = ['spruce', 'spruce', 'pine', 'beech', 'spruce', 'birch', 'spruce'];
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 16; i++) {
        const t = treeSprite(types[(i * 3 + row) % types.length], i + row * 5, 'autumn', false);
        g.globalAlpha = 0.45 + row * 0.25;
        g.drawImage(t.img, i * 22 - 10 + (row % 2) * 11, 10 + row * 8);
      }
    g.globalAlpha = 1;
    c.style.width = '100%';
    c.style.imageRendering = 'pixelated';
    el.innerHTML = '';
    el.appendChild(c);
  }, []);
  return <div ref={ref} style={{ width: 'min(900px, 92vw)', opacity: 0.9 }} />;
}

export function TitleScreen(props: { onNew: () => void; onContinue?: () => void; onLoad: () => void; onSettings: () => void; hasSave: boolean }) {
  return (
    <div className="screen">
      <div className="title-screen">
        <ForestBanner />
        <div className="title-logo">
          MODULO
          <small>SURVIVAL</small>
        </div>
        <p className="muted" style={{ maxWidth: 520, textAlign: 'center', margin: 0 }}>
          Sixteen classmates. A forest near Bülach. Whatever happened out there, nobody is coming.
        </p>
        <div className="title-menu">
          {props.hasSave && props.onContinue && (
            <button className="primary" onClick={props.onContinue}>
              Continue
            </button>
          )}
          <button className={props.hasSave ? '' : 'primary'} onClick={props.onNew}>
            New Game
          </button>
          <button onClick={props.onLoad}>Load Game</button>
          <button onClick={props.onSettings}>Settings</button>
        </div>
        <span className="faint" style={{ fontSize: '0.8em' }}>
          v0.1 - saves stay in this browser. Export them from the pause menu.
        </span>
      </div>
    </div>
  );
}

export function SettingsScreen(props: { settings: Settings; onChange: (s: Settings) => void; onBack: () => void }) {
  return (
    <div className="screen">
      <div className="title-screen">
        <div className="panel" style={{ width: 460 }}>
          <div className="panel-title">
            <h2>Settings</h2>
            <button onClick={props.onBack}>Back</button>
          </div>
          <div className="panel-body">
            <SettingsForm settings={props.settings} onChange={props.onChange} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoadScreen(props: { onBack: () => void; onLoad: (slot: SlotId) => void; onImported: (s: GameState) => void }) {
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [err, setErr] = useState('');
  const refresh = () => void listSaves().then(setSaves);
  useEffect(refresh, []);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="screen">
      <div className="title-screen">
        <div className="panel" style={{ width: 640, maxWidth: '96vw' }}>
          <div className="panel-title">
            <h2>Load Game</h2>
            <button onClick={props.onBack}>Back</button>
          </div>
          <div className="panel-body col">
            {SLOTS.map((slot) => {
              const m = saves.find((x) => x.slot === slot);
              return (
                <div key={slot} className="list-row">
                  <div className="col" style={{ gap: 0 }}>
                    <span>{slot === 'auto' ? 'Autosave' : `Slot ${slot.slice(-1)}`}</span>
                    <span className="faint" style={{ fontSize: '0.85em' }}>
                      {m ? `${m.worldName} - ${m.playerName}, ${m.season} day ${m.day} ${m.clock}, ${m.living} alive, ${m.mode}` : 'Empty'}
                    </span>
                    {m && <span className="faint" style={{ fontSize: '0.75em' }}>{new Date(m.savedAt).toLocaleString()}</span>}
                  </div>
                  <div className="row">
                    <button className="primary" disabled={!m} onClick={() => props.onLoad(slot)}>
                      Load
                    </button>
                    <button className="danger" disabled={!m} onClick={() => void deleteSave(slot).then(refresh)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="row" style={{ marginTop: 8 }}>
              <button onClick={() => fileRef.current?.click()}>Import save file</button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    props.onImported(await importSave(f));
                  } catch (x) {
                    setErr((x as Error).message);
                  }
                }}
              />
              {err && <span className="bad">{err}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CharacterDetail({ c }: { c: Character }) {
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row">
        <Portrait c={c} scale={5} />
        <div className="col" style={{ gap: 2 }}>
          <h2 style={{ color: 'var(--accent)' }}>{c.name}</h2>
          <span className="muted">18 years old</span>
          <span style={{ fontSize: '0.9em' }}>{c.appearance.description}</span>
        </div>
      </div>
      <span>{c.personalitySummary}</span>
      <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
        {c.traits.map((t) => (
          <span key={t} className="chip" title={TRAITS[t].desc}>
            {TRAITS[t].name}
          </span>
        ))}
      </div>
      <span className="faint">{c.background}</span>
      <div className="stat-grid">
        {ATTRIBUTES.map((a) => (
          <div key={a.id} style={{ display: 'contents' }} title={a.desc}>
            <span className="muted">{a.name}</span>
            <Pips n={c.attributes[a.id]} />
            <span>{c.attributes[a.id]}</span>
          </div>
        ))}
      </div>
      <div className="stat-grid">
        {SKILLS.filter((s) => c.skills[s.id] >= 3).map((s) => (
          <div key={s.id} style={{ display: 'contents' }} title={s.desc}>
            <span className="muted">{s.name}</span>
            <Pips n={c.skills[s.id]} />
            <span>{c.skills[s.id]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NewGameScreen(props: { onBack: () => void; onStart: (seed: number, mode: GameMode, playerId: string, name: string) => void }) {
  const [seed, setSeed] = useState(randomSeed);
  const [mode, setMode] = useState<GameMode>('normal');
  const roster = useMemo(() => generateRoster(seed, mode), [seed, mode]);
  const [sel, setSel] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const chosen = roster.find((c) => c.id === sel);
  return (
    <div className="screen">
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1200, margin: '0 auto' }}>
        <div className="spread" style={{ flexWrap: 'wrap' }}>
          <h1 style={{ color: 'var(--accent)' }}>Choose who you are</h1>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="muted">World seed</span>
            <input type="number" value={seed} onChange={(e) => (setSeed(Number(e.target.value) || 0), setSel(''))} style={{ width: 140 }} />
            <button onClick={() => (setSeed(randomSeed()), setSel(''))}>New world</button>
            <select value={mode} onChange={(e) => setMode(e.target.value as GameMode)}>
              <option value="normal">Normal</option>
              <option value="hardcore">Hardcore</option>
            </select>
            <button onClick={props.onBack}>Back</button>
          </div>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {mode === 'hardcore'
            ? 'Hardcore: harsher needs, worse injuries, scarcer loot and supplies. Death is permanent; you continue as another survivor.'
            : 'Normal: death is permanent for each character, but you can continue as another survivor. Saving is always available.'}{' '}
          The eight girls in the class are different in every world.
        </p>
        <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div className="char-grid grow" style={{ minWidth: 300 }}>
            {roster.map((c) => (
              <div key={c.id} className={`char-card ${sel === c.id ? 'sel' : ''}`} onClick={() => setSel(c.id)}>
                <Portrait c={c} scale={3} />
                <span>{c.name}</span>
                <span className="faint" style={{ fontSize: '0.75em', textAlign: 'center' }}>
                  {c.traits.map((t) => TRAITS[t].name).join(', ')}
                </span>
              </div>
            ))}
          </div>
          <div className="panel" style={{ width: 380, maxWidth: '100%' }}>
            <div className="panel-body">
              {chosen ? (
                <>
                  <CharacterDetail c={chosen} />
                  <button
                    className="primary"
                    style={{ width: '100%', marginTop: 12, minHeight: 44 }}
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      setTimeout(() => props.onStart(seed, mode, chosen.id, ''), 20);
                    }}
                  >
                    {busy ? 'Generating the forest...' : `Play as ${chosen.name}`}
                  </button>
                </>
              ) : (
                <span className="muted">Select a classmate to see who they are. The other fifteen will live their own lives in the world.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeathScreen(props: { name: string; cause: string; survivors: Character[]; onContinue: (id: string) => void; onQuit: () => void }) {
  const [sel, setSel] = useState('');
  return (
    <div className="modal-wrap" style={{ pointerEvents: 'auto', background: 'rgba(5,6,5,0.8)' }}>
      <div className="panel" style={{ width: 720 }}>
        <div className="panel-title">
          <h2>{props.name} is dead</h2>
        </div>
        <div className="panel-body col">
          <span className="muted">Cause: {props.cause}. Their body and belongings remain where they fell.</span>
          {props.survivors.length ? (
            <>
              <span>The others are still out there. Continue as:</span>
              <div className="char-grid">
                {props.survivors.map((c) => (
                  <div key={c.id} className={`char-card ${sel === c.id ? 'sel' : ''}`} onClick={() => setSel(c.id)}>
                    <Portrait c={c} scale={2} />
                    <span>{c.name}</span>
                  </div>
                ))}
              </div>
              <div className="row">
                <button className="primary" disabled={!sel} onClick={() => props.onContinue(sel)}>
                  Continue
                </button>
                <button onClick={props.onQuit}>Quit to title</button>
              </div>
            </>
          ) : (
            <>
              <span className="bad">Nobody from the class is left.</span>
              <button onClick={props.onQuit}>Quit to title</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
