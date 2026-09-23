import { useEffect, useRef, useState } from 'react';
import type { GameSession } from '../session';
import { Panel, useSession } from '../common';
import { T } from '@/content/terrain';
import { isTree } from '@/content/objects';
import type { MarkerKind } from '@/sim/types';
import { h2, hexToRgb } from '@/render/pixel';

const SCALE = 2;
const MARKERS: { kind: MarkerKind; label: string; color: string; glyph: string }[] = [
  { kind: 'home', label: 'Home', color: '#c0302a', glyph: 'H' },
  { kind: 'water', label: 'Water', color: '#2a6aa8', glyph: 'W' },
  { kind: 'food', label: 'Food', color: '#3a8a2a', glyph: 'F' },
  { kind: 'danger', label: 'Danger', color: '#b02a1a', glyph: '!' },
  { kind: 'loot', label: 'Loot', color: '#b8862a', glyph: '$' },
  { kind: 'hunting', label: 'Hunting', color: '#6a4a2a', glyph: 'A' },
  { kind: 'interesting', label: 'Interesting', color: '#7a3a9a', glyph: '?' },
  { kind: 'unknown', label: 'Unknown', color: '#4a4a4a', glyph: 'o' },
];

const COL: Record<number, string> = {
  [T.DEEP]: '#4a7ea4',
  [T.SHALLOW]: '#6e9ebc',
  [T.STREAM]: '#5a8eb4',
  [T.GRASS]: '#c8c48e',
  [T.FOREST]: '#98a676',
  [T.PATH]: '#a8865a',
  [T.ROAD]: '#6e6a62',
  [T.MUD]: '#8a7a5a',
  [T.GRAVEL]: '#b0a890',
  [T.FIELD]: '#c8b27a',
  [T.FLOOR]: '#5a4630',
  [T.WALL]: '#3a2e22',
  [T.CONCRETE]: '#7a7a74',
  [T.ROCK]: '#a09a88',
};

export function MapPanel({ session }: { session: GameSession }) {
  useSession(session);
  const g = session.game;
  const s = g.state;
  const ref = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<MarkerKind | 'remove' | null>(null);
  const [showPeople, setShowPeople] = useState(true);
  const W = s.width * SCALE;
  const H = s.height * SCALE;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const c = cv.getContext('2d')!;
    const img = c.createImageData(W, H);
    const d = img.data;
    const fog = session.ui.debug ? false : g.settings.fogOfWar;
    const paper = hexToRgb('#cdbb90');
    const cols: Record<number, [number, number, number]> = {};
    for (const k in COL) cols[k] = hexToRgb(COL[k]);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const tx = Math.floor(x / SCALE);
        const ty = Math.floor(y / SCALE);
        const i = ty * s.width + tx;
        const o = (y * W + x) * 4;
        const n = h2(x, y, 4);
        let rgb: [number, number, number];
        const explored = !fog || s.explored[i];
        if (!explored) {
          const hatch = (x + y) % 6 === 0 ? 0.9 : 1;
          rgb = [paper[0] * 0.82 * hatch, paper[1] * 0.8 * hatch, paper[2] * 0.72 * hatch];
        } else {
          rgb = cols[s.terrain[i]] ?? paper;
          const oid = g.index.tileObj[i];
          const obj = oid ? s.objects[oid] : undefined;
          if (obj && isTree(obj.type) && n < 0.55) rgb = [rgb[0] * 0.72, rgb[1] * 0.8, rgb[2] * 0.7];
          // soft edge where exploration ends
          let edge = 0;
          if (fog) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!s.explored[(ty + dy) * s.width + tx + dx]) edge++;
          if (edge) rgb = [rgb[0] * 0.9 + paper[0] * 0.1, rgb[1] * 0.9 + paper[1] * 0.1, rgb[2] * 0.9 + paper[2] * 0.1];
        }
        const grain = 0.94 + n * 0.08;
        d[o] = rgb[0] * grain;
        d[o + 1] = rgb[1] * grain;
        d[o + 2] = rgb[2] * grain;
        d[o + 3] = 255;
      }
    c.putImageData(img, 0, 0);
    // grid lines like a hiking map
    c.strokeStyle = 'rgba(90,70,40,0.18)';
    c.lineWidth = 1;
    for (let k = 0; k <= s.width; k += 32) {
      c.beginPath();
      c.moveTo(k * SCALE + 0.5, 0);
      c.lineTo(k * SCALE + 0.5, H);
      c.moveTo(0, k * SCALE + 0.5);
      c.lineTo(W, k * SCALE + 0.5);
      c.stroke();
    }
    c.font = '14px VT323, monospace';
    c.textAlign = 'center';
    for (const b of s.buildings) {
      if (!b.discovered && fog) continue;
      c.fillStyle = '#3a2e22';
      c.fillRect(b.x * SCALE, b.y * SCALE, b.w * SCALE, b.h * SCALE);
      c.fillStyle = '#2a2418';
      c.fillText(b.name, (b.x + b.w / 2) * SCALE, b.y * SCALE - 4);
    }
    // markers
    for (const m of s.markers) {
      const def = MARKERS.find((x) => x.kind === m.kind) ?? MARKERS[7];
      const x = m.x * SCALE;
      const y = m.y * SCALE;
      c.fillStyle = '#f0e6c8';
      c.fillRect(x - 6, y - 6, 12, 12);
      c.fillStyle = def.color;
      c.fillRect(x - 5, y - 5, 10, 10);
      c.fillStyle = '#f0e6c8';
      c.fillText(def.glyph, x, y + 4);
    }
    // people: the player, and classmates where they were last seen
    if (showPeople) {
      for (const ch of Object.values(s.characters)) {
        if (!ch.alive || ch.id === s.playerId) continue;
        const pos = ch.lastSeen ?? { x: ch.x, y: ch.y };
        if (!ch.lastSeen && fog) continue;
        c.fillStyle = ch.ai.expeditionId !== undefined ? '#b8862a' : '#2a4a2a';
        c.fillRect(pos.x * SCALE - 2, pos.y * SCALE - 2, 4, 4);
      }
    }
    const p = g.player;
    c.fillStyle = '#c0302a';
    c.beginPath();
    c.moveTo(p.x * SCALE, p.y * SCALE - 7);
    c.lineTo(p.x * SCALE + 6, p.y * SCALE + 5);
    c.lineTo(p.x * SCALE - 6, p.y * SCALE + 5);
    c.fill();
    c.strokeStyle = '#f0e6c8';
    c.stroke();
    // compass rose
    c.fillStyle = 'rgba(60,45,25,0.8)';
    c.fillText('N', W - 24, 20);
    c.fillRect(W - 25, 24, 2, 18);
    // redraw only when something on the map changed
  }, [s.markers.length, showPeople, s.homePin?.x, s.homePin?.y, session.ui.debug, Math.floor(g.player.x), Math.floor(g.player.y)]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = ref.current!;
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * s.width;
    const y = ((e.clientY - r.top) / r.height) * s.height;
    if (session.ui.debug && e.shiftKey) {
      const p = g.player;
      p.x = x;
      p.y = y;
      g.revealAround(x, y, 10);
      session.bump();
      return;
    }
    if (!mode) return;
    if (mode === 'remove') {
      s.markers = s.markers.filter((m) => Math.hypot(m.x - x, m.y - y) > 4 || m.kind === 'home');
    } else if (mode === 'home') {
      g.setHomePin(x, y);
    } else {
      s.markers.push({ id: s.nextId++, kind: mode, x, y, label: MARKERS.find((m) => m.kind === mode)!.label });
    }
    session.bump();
  };

  return (
    <Panel title="Hardwald - Hiking Map 1:25 000" onClose={() => session.openPanel(null)}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ maxHeight: '72vh', maxWidth: '72vw', overflow: 'auto', background: '#7a6a4a' }}>
          <canvas ref={ref} width={W} height={H} className="map-canvas" onClick={onClick} style={{ width: W, height: H }} />
        </div>
        <div className="col" style={{ width: 180 }}>
          <span className="muted">Mark the map</span>
          {MARKERS.map((m) => (
            <button key={m.kind} className={mode === m.kind ? 'primary' : ''} onClick={() => setMode(mode === m.kind ? null : m.kind)} style={{ textAlign: 'left' }}>
              <span style={{ color: m.color, marginRight: 6 }}>{m.glyph}</span>
              {m.label}
            </button>
          ))}
          <button className={mode === 'remove' ? 'primary' : ''} onClick={() => setMode(mode === 'remove' ? null : 'remove')}>
            Erase marker
          </button>
          <label className="row">
            <input type="checkbox" checked={showPeople} onChange={(e) => setShowPeople(e.target.checked)} /> Last seen positions
          </label>
          <span className="faint" style={{ fontSize: '0.8em' }}>
            Only places you or your classmates have seen are drawn. Classmates share what they saw when they return to camp.
          </span>
        </div>
      </div>
    </Panel>
  );
}
