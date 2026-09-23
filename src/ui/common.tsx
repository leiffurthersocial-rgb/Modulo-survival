import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { Character, ItemStack } from '@/sim/types';
import { itemDef } from '@/content/items';
import { iconUrl } from '@/render/icons';
import { portrait } from '@/render/characters';
import { describeStack } from '@/sim/inventory';
import type { GameSession } from './session';

/** Re-render the calling component whenever the session publishes an update. */
export function useSession(s: GameSession): number {
  return useSyncExternalStore(s.subscribe, s.getVersion);
}

export function Panel(props: { title: string; onClose?: () => void; children: ReactNode; width?: number | string; actions?: ReactNode }) {
  return (
    <div className="panel" style={{ width: props.width ?? 'auto' }}>
      <div className="panel-title">
        <h2>{props.title}</h2>
        <div className="row">
          {props.actions}
          {props.onClose && (
            <button className="ghost" onClick={props.onClose} aria-label="Close">
              X
            </button>
          )}
        </div>
      </div>
      <div className="panel-body">{props.children}</div>
    </div>
  );
}

export function ItemSlot(props: { stack: ItemStack | null | undefined; selected?: boolean; label?: string; onClick?: () => void; onDoubleClick?: () => void; title?: string }) {
  const s = props.stack;
  const d = s ? itemDef(s.id) : undefined;
  let bar: { v: number; c: string } | undefined;
  if (s?.liquid && d?.liquidCapacity) bar = { v: s.liquid.ml / d.liquidCapacity, c: s.liquid.contam > 0.1 ? '#a88a4a' : '#6aa0c8' };
  else if (s?.q !== undefined) bar = { v: s.q, c: s.q > 0.5 ? '#8fcf7a' : s.q > 0.2 ? '#e0b35a' : '#e0705a' };
  else if (s?.charge !== undefined && d?.charges) bar = { v: s.charge / d.charges, c: '#d6b25e' };
  return (
    <div
      className={`slot ${props.selected ? 'sel' : ''}`}
      onClick={props.onClick}
      onDoubleClick={props.onDoubleClick}
      title={props.title ?? (s && d ? `${d.name}${describeStack(s) ? ` (${describeStack(s)})` : ''}` : props.label)}
    >
      {props.label && !s && <span className="lbl">{props.label}</span>}
      {s && <img src={iconUrl(s.id)} alt={d?.name} draggable={false} />}
      {s && s.qty > 1 && <span className="qty">{s.qty}</span>}
      {bar && (
        <div className="bar">
          <div style={{ width: `${Math.max(0, Math.min(1, bar.v)) * 100}%`, background: bar.c }} />
        </div>
      )}
    </div>
  );
}

export function Portrait({ c, scale = 3 }: { c: Character; scale?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    const cv = portrait(c, scale);
    cv.className = 'portrait';
    el.appendChild(cv);
  }, [c, c.equipment.outer?.id, c.equipment.head?.id, c.equipment.back?.id, scale]);
  return <div ref={ref} style={{ width: 16 * scale, height: 24 * scale }} />;
}

export function Bar({ v, color, max = 100 }: { v: number; color: string; max?: number }) {
  return (
    <div className="need-bar">
      <div style={{ width: `${Math.max(0, Math.min(1, v / max)) * 100}%`, background: color }} />
    </div>
  );
}

export function Pips({ n, max = 10 }: { n: number; max?: number }) {
  return (
    <div className="pips">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < Math.floor(n) ? 'on' : ''} />
      ))}
    </div>
  );
}

export function needColor(v: number, inverse = false): string {
  const x = inverse ? 100 - v : v;
  return x > 60 ? '#8fb36a' : x > 30 ? '#d6b25e' : '#d0604a';
}

export function Key({ k }: { k: string }) {
  return <span className="key">{k}</span>;
}
