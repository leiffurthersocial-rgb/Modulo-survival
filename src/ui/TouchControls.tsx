import { useRef } from 'react';
import type { GameSession } from './session';

/** Virtual joystick and action buttons. Only rendered when enabled in settings. */
export function TouchControls({ session }: { session: GameSession }) {
  const knob = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const move = (x: number, y: number) => {
    const o = origin.current;
    if (!o) return;
    let dx = x - o.x;
    let dy = y - o.y;
    const len = Math.hypot(dx, dy);
    const max = 50;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    const dead = 10;
    session.input.touch.dx = Math.abs(dx) > dead ? dx / max : 0;
    session.input.touch.dy = Math.abs(dy) > dead ? dy / max : 0;
    session.input.touch.sprint = len > max * 0.95;
  };
  const end = () => {
    origin.current = null;
    session.input.touch.dx = 0;
    session.input.touch.dy = 0;
    session.input.touch.sprint = false;
    if (knob.current) knob.current.style.transform = '';
  };
  const btn = (label: string, fn: () => void) => (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        fn();
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="touch">
      <div
        className="stick"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => move(e.clientX, e.clientY)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="knob" ref={knob} />
      </div>
      <div className="btns">
        {btn('Use', () => session.interact())}
        {btn('Bag', () => session.openPanel('inventory'))}
        {btn('Sleep', () => {
          const p = session.game.player;
          if (p.sleeping) session.game.wake(p, 'You get up.');
          else session.game.startSleep(p);
        })}
        {btn('Light', () => session.toggleLight())}
      </div>
    </div>
  );
}
