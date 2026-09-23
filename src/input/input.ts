/**
 * Input: keyboard state for movement plus a key-binding table for actions.
 * Touch controls feed the same virtual state (see TouchControls UI).
 */
export type ActionKey =
  | 'interact'
  | 'attack'
  | 'inventory'
  | 'craft'
  | 'build'
  | 'map'
  | 'group'
  | 'character'
  | 'journal'
  | 'sleep'
  | 'toilet'
  | 'home'
  | 'menu'
  | 'debug'
  | 'light'
  | 'camp';

export const BINDINGS: Record<string, ActionKey> = {
  KeyE: 'interact',
  Space: 'interact',
  KeyF: 'attack',
  KeyI: 'inventory',
  Tab: 'inventory',
  KeyK: 'craft',
  KeyB: 'build',
  KeyM: 'map',
  KeyG: 'group',
  KeyC: 'character',
  KeyJ: 'journal',
  KeyZ: 'sleep',
  KeyT: 'toilet',
  KeyH: 'home',
  Escape: 'menu',
  Backquote: 'debug',
  F3: 'debug',
  KeyL: 'light',
  KeyP: 'camp',
};

export const KEY_LABELS: Record<ActionKey, string> = {
  interact: 'E',
  attack: 'F',
  inventory: 'I',
  craft: 'K',
  build: 'B',
  map: 'M',
  group: 'G',
  character: 'C',
  journal: 'J',
  sleep: 'Z',
  toilet: 'T',
  home: 'H',
  menu: 'Esc',
  debug: 'F3',
  light: 'L',
  camp: 'P',
};

export class Input {
  private down = new Set<string>();
  touch = { dx: 0, dy: 0, sprint: false };
  private listeners: ((a: ActionKey, e: KeyboardEvent) => void)[] = [];
  enabled = true;

  constructor() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  private onDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
    this.down.add(e.code);
    const a = BINDINGS[e.code];
    if (a && !e.repeat) {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      for (const l of this.listeners) l(a, e);
    }
    if (e.code.startsWith('Arrow')) e.preventDefault();
  };
  private onUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };
  private onBlur = () => this.down.clear();

  onAction(fn: (a: ActionKey, e: KeyboardEvent) => void): () => void {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  movement(): { dx: number; dy: number; sprint: boolean } {
    if (!this.enabled) return { dx: 0, dy: 0, sprint: false };
    let dx = 0;
    let dy = 0;
    if (this.down.has('KeyW') || this.down.has('ArrowUp')) dy -= 1;
    if (this.down.has('KeyS') || this.down.has('ArrowDown')) dy += 1;
    if (this.down.has('KeyA') || this.down.has('ArrowLeft')) dx -= 1;
    if (this.down.has('KeyD') || this.down.has('ArrowRight')) dx += 1;
    const sprint = this.down.has('ShiftLeft') || this.down.has('ShiftRight') || this.touch.sprint;
    if (dx === 0 && dy === 0) return { dx: this.touch.dx, dy: this.touch.dy, sprint };
    return { dx, dy, sprint };
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
