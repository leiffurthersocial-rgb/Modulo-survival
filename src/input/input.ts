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
  | 'camp'
  | 'help';

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
  // P pauses and closes windows: the iPad keyboard has no Esc or F-keys
  KeyP: 'menu',
  Escape: 'menu',
  Backquote: 'debug',
  F3: 'debug',
  KeyL: 'light',
  KeyO: 'camp',
  F1: 'help',
  Slash: 'help',
};

/**
 * Letter keys match the character printed on the key (e.key), so they stay
 * right on QWERTZ and other layouts; movement uses physical positions.
 */
const CHAR_BINDINGS: Record<string, ActionKey> = { ' ': 'interact', '?': 'help', '/': 'help' };
for (const [code, a] of Object.entries(BINDINGS)) if (/^Key[A-Z]$/.test(code)) CHAR_BINDINGS[code.slice(3).toLowerCase()] = a;

function bindingFor(e: KeyboardEvent): ActionKey | undefined {
  if (e.key.length === 1 && /[a-z ?/]/i.test(e.key)) return CHAR_BINDINGS[e.key.toLowerCase()];
  return /^Key[A-Z]$/.test(e.code) ? undefined : BINDINGS[e.code];
}

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
  menu: 'P',
  debug: 'F3',
  light: 'L',
  camp: 'O',
  help: '?',
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
    // leave system shortcuts (Cmd+Tab, Cmd+R...) to the browser and the iPad
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const a = bindingFor(e);
    if (a && !e.repeat) {
      if (e.code === 'Tab' || e.code === 'Space' || e.code === 'F1' || a === 'help') e.preventDefault();
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
