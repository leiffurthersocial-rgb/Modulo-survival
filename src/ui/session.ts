import { Game, type Tone } from '@/sim/game';
import type { GameState } from '@/sim/types';
import { Renderer } from '@/render/renderer';
import { Input, type ActionKey } from '@/input/input';
import { audio } from '@/audio/audio';
import { log } from '@/core/logger';
import { objectDef } from '@/content/objects';
import { itemDef } from '@/content/items';
import { findTarget, getInteractions, targetName, type Interaction, type Target } from '@/sim/interactions';
import { checkPlacement, placeStructure } from '@/sim/building';
import { startAction } from '@/sim/actions';
import { attackAnimal } from '@/sim/wildlife';
import { daylight } from '@/sim/clock';
import { addItem } from '@/sim/inventory';
import { saveGame, type SlotId } from '@/save/storage';
import type { Settings } from './settings';
import { debugAllowed } from './settings';

export type PanelId = 'inventory' | 'craft' | 'build' | 'map' | 'group' | 'character' | 'journal' | 'camp' | 'menu';

export interface Toast {
  id: number;
  text: string;
  tone: Tone;
  at: number;
}

export interface ContextMenu {
  title: string;
  items: Interaction[];
  x?: number;
  y?: number;
}

export interface UIState {
  panel: PanelId | null;
  container?: number;
  buildType?: string;
  doc?: string;
  debug: boolean;
  menu?: ContextMenu;
  prompt?: { label: string; name: string };
  hint?: { id: string; text: string; at: number };
  dead?: { name: string; cause: string };
  saving?: string;
}

/**
 * Owns one running world: the simulation, the renderer and the input, and the
 * per-frame loop. React subscribes to a version counter that increases at a
 * modest fixed rate so UI updates never drive the simulation.
 */
export class GameSession {
  game: Game;
  renderer: Renderer;
  input: Input;
  ui: UIState = { panel: null, debug: false };
  toasts: Toast[] = [];
  private listeners = new Set<() => void>();
  version = 0;
  private raf = 0;
  private last = 0;
  private uiAcc = 0;
  private autosaveAcc = 0;
  private running = false;
  private toastId = 1;
  mouse = { x: 0, y: 0, inside: false };
  target?: Target;
  settings: Settings;
  private unsubs: (() => void)[] = [];
  fps = 60;

  constructor(state: GameState, container: HTMLElement, settings: Settings) {
    this.settings = settings;
    this.game = new Game(state);
    this.renderer = new Renderer(this.game, container);
    this.input = new Input();
    this.applySettings(settings);
    this.wire(container);
  }

  applySettings(s: Settings): void {
    this.settings = s;
    this.renderer.opts = { reducedEffects: s.reducedEffects, lowResolution: s.lowResolution, showNames: s.showNames };
    this.renderer.resize();
    audio.settings = { master: s.master, music: s.music, sfx: s.sfx, ambience: s.ambience };
    audio.applyVolumes();
  }

  private wire(container: HTMLElement): void {
    const g = this.game;
    this.unsubs.push(
      g.bus.on('message', (m) => this.toast(m.text, m.tone)),
      g.bus.on('hint', (h) => {
        this.ui.hint = { ...h, at: performance.now() };
        audio.play('hint');
      }),
      g.bus.on('sound', (s) => audio.play(s.id, Math.hypot(s.x - g.player.x, s.y - g.player.y))),
      g.bus.on('lightning', () => setTimeout(() => audio.play('thunder'), 400 + Math.random() * 1500)),
      g.bus.on('openContainer', (e) => this.openPanel('inventory', e.id)),
      g.bus.on('openPanel', (p) => this.openPanel(p as PanelId)),
      g.bus.on('readDoc', (d) => {
        this.ui.doc = d;
        this.bump();
      }),
      g.bus.on('playerDied', (e) => {
        this.ui.dead = { name: g.state.characters[e.id]?.name ?? '', cause: e.cause };
        this.ui.panel = null;
        void this.save('auto');
        this.bump();
      }),
      g.bus.on('requestAutosave', () => void this.save('auto')),
      g.bus.on('discovered', (d) => this.toast(`Discovered: ${d.name}`, 'good')),
      this.input.onAction((a, e) => this.onAction(a, e)),
    );
    const canvas = this.renderer.screen;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
    };
    const onDown = (e: PointerEvent) => {
      audio.unlock();
      const r = canvas.getBoundingClientRect();
      this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
      if (e.button === 2) {
        if (this.ui.buildType) this.cancelBuild();
        return;
      }
      this.clickWorld();
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    const onResize = () => this.renderer.resize();
    window.addEventListener('resize', onResize);
    const onVis = () => {
      if (document.hidden) {
        void this.save('auto');
        audio.suspend();
      } else {
        audio.resume();
        this.last = performance.now();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    this.unsubs.push(
      () => canvas.removeEventListener('pointermove', onMove),
      () => canvas.removeEventListener('pointerdown', onDown),
      () => window.removeEventListener('resize', onResize),
      () => document.removeEventListener('visibilitychange', onVis),
    );
    void container;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = (): number => this.version;

  bump(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  toast(text: string, tone: Tone = 'info'): void {
    this.toasts.push({ id: this.toastId++, text, tone, at: performance.now() });
    if (this.toasts.length > 6) this.toasts.shift();
    this.bump();
  }

  start(): void {
    this.running = true;
    this.last = performance.now();
    const loop = (ts: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frame(ts);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  get paused(): boolean {
    return this.ui.panel === 'menu' || this.ui.panel === 'map' || !!this.ui.dead || !!this.ui.doc;
  }

  private frame(ts: number): void {
    const dt = Math.min(0.1, (ts - this.last) / 1000);
    this.last = ts;
    this.fps = this.fps * 0.95 + (1 / Math.max(0.001, dt)) * 0.05;
    const g = this.game;
    try {
      if (!this.paused) {
        const mv = this.ui.menu ? { dx: 0, dy: 0, sprint: false } : this.input.movement();
        g.input = mv;
        if ((mv.dx || mv.dy) && this.ui.menu) this.ui.menu = undefined;
        g.update(dt);
        this.autosaveAcc += dt;
        if (this.autosaveAcc > this.settings.autosaveMinutes * 60) {
          this.autosaveAcc = 0;
          void this.save('auto');
        }
      }
      this.updateTarget();
      this.renderer.render(this.paused ? 0 : dt, ts);
      const p = g.player;
      const env = g.envAt(p.x, p.y);
      audio.updateAmbience(dt, {
        rain: env.rain,
        wind: g.state.weather.wind,
        fireDist: env.fireDist,
        daylight: daylight(g.state.time),
        indoor: env.indoor,
        sleeping: p.sleeping,
      });
    } catch (e) {
      log.error('loop', `frame failed: ${(e as Error).message}`, e);
    }
    this.uiAcc += dt;
    if (this.uiAcc > 0.15) {
      this.uiAcc = 0;
      const now = performance.now();
      this.toasts = this.toasts.filter((t) => now - t.at < 6000);
      if (this.ui.hint && now - this.ui.hint.at > 16000) this.ui.hint = undefined;
      this.bump();
    }
  }

  // --- targeting & interaction -----------------------------------------------

  private updateTarget(): void {
    const g = this.game;
    const p = g.player;
    const r = this.renderer;
    r.highlight = undefined;
    r.hoverChar = undefined;
    if (!p.alive) return;
    if (this.ui.buildType) {
      const def = objectDef(this.ui.buildType);
      let tx: number;
      let ty: number;
      if (this.mouse.inside && !this.settings.touchControls) {
        const w = r.screenToWorld(this.mouse.x, this.mouse.y);
        tx = Math.floor(w.x - ((def.w ?? 1) - 1) / 2);
        ty = Math.floor(w.y - ((def.h ?? 1) - 1) / 2);
      } else {
        const fx = p.facing === 'left' ? -1 : p.facing === 'right' ? 1 : 0;
        const fy = p.facing === 'up' ? -1 : p.facing === 'down' ? 1 : 0;
        tx = Math.floor(p.x + fx * 1.6 - ((def.w ?? 1) - 1) / 2);
        ty = Math.floor(p.y + fy * 1.6 - ((def.h ?? 1) - 1) / 2);
      }
      const chk = checkPlacement(g, p, this.ui.buildType, tx, ty);
      r.ghost = { type: this.ui.buildType, x: tx, y: ty, ok: chk.ok };
      this.ui.prompt = { label: chk.ok ? `Place ${def.name}` : chk.reason ?? 'Cannot build here', name: chk.warn ?? '' };
      return;
    }
    r.ghost = undefined;
    // hovered character name
    if (this.mouse.inside) {
      const w = r.screenToWorld(this.mouse.x, this.mouse.y);
      for (const c of g.livingCharacters()) if (Math.abs(c.x - w.x) < 0.6 && w.y < c.y + 0.3 && w.y > c.y - 1.5) r.hoverChar = c.id;
    }
    if (p.sleeping) {
      this.target = undefined;
      this.ui.prompt = { label: 'Wake up', name: 'Sleeping' };
      return;
    }
    this.target = findTarget(g, p);
    if (!this.target) {
      this.ui.prompt = undefined;
      return;
    }
    const t = this.target;
    if (t.kind === 'object') {
      const d = objectDef(t.obj.type);
      r.highlight = { x: t.obj.x, y: t.obj.y, w: d.w ?? 1, h: d.h ?? 1 };
    } else if (t.kind === 'water') r.highlight = { x: t.x, y: t.y, w: 1, h: 1 };
    else if (t.kind === 'character') r.highlight = { x: t.char.x - 0.5, y: t.char.y - 1.2, w: 1, h: 1.4 };
    else r.highlight = { x: t.animal.x - 0.6, y: t.animal.y - 0.8, w: 1.2, h: 1 };
    const all = getInteractions(g, p, t);
    const opts = all.filter((o) => o.enabled);
    const label = opts.length === 1 && all.length === 1 ? opts[0].label : opts.length ? 'Interact' : all.length ? (all[0].reason ?? all[0].label) : '';
    this.ui.prompt = { name: targetName(g, t), label };
  }

  interact(): void {
    const g = this.game;
    const p = g.player;
    if (!p.alive) return;
    if (this.ui.buildType) return this.confirmBuild();
    if (p.sleeping) {
      g.wake(p, 'You get up.');
      return;
    }
    if (!this.target) return;
    this.openInteractions(this.target);
  }

  private openInteractions(t: Target): void {
    const g = this.game;
    const items = getInteractions(g, g.player, t);
    const enabled = items.filter((i) => i.enabled);
    if (enabled.length === 1 && items.length === 1) {
      enabled[0].run();
      audio.play('ui');
      return;
    }
    if (!items.length) return;
    if (!enabled.length) {
      this.toast(items[0].reason ?? `${items[0].label}.`, 'warn');
      return;
    }
    this.ui.menu = { title: targetName(g, t), items };
    audio.play('uiOpen');
    this.bump();
  }

  runMenuItem(i: number): void {
    const m = this.ui.menu;
    if (!m) return;
    const it = m.items[i];
    if (!it || !it.enabled) return;
    this.ui.menu = undefined;
    it.run();
    audio.play('ui');
    this.bump();
  }

  private clickWorld(): void {
    const g = this.game;
    const p = g.player;
    if (this.ui.buildType) return this.confirmBuild();
    if (this.ui.menu) {
      this.ui.menu = undefined;
      this.bump();
      return;
    }
    const w = this.renderer.screenToWorld(this.mouse.x, this.mouse.y);
    const dist = Math.hypot(w.x - p.x, w.y - (p.y - 0.3));
    if (dist > 2.6) return;
    // characters and animals near the click first
    let t: Target | undefined;
    for (const c of g.livingCharacters()) if (c !== p && Math.abs(c.x - w.x) < 0.6 && w.y < c.y + 0.3 && w.y > c.y - 1.5) t = { kind: 'character', char: c };
    if (!t) for (const a of Object.values(g.state.animals)) if (Math.hypot(a.x - w.x, a.y - 0.4 - w.y) < 0.8) t = { kind: 'animal', animal: a };
    if (!t) t = findTarget(g, p, w.x, w.y);
    if (!t) return;
    // face the target
    const tx = t.kind === 'object' ? t.obj.x + 0.5 : t.kind === 'water' ? t.x + 0.5 : t.kind === 'character' ? t.char.x : t.animal.x;
    const ty = t.kind === 'object' ? t.obj.y + 0.5 : t.kind === 'water' ? t.y + 0.5 : t.kind === 'character' ? t.char.y : t.animal.y;
    const dx = tx - p.x;
    const dy = ty - p.y;
    p.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.openInteractions(t);
  }

  // --- building -----------------------------------------------------------------

  beginBuild(type: string): void {
    this.ui.buildType = type;
    this.ui.panel = null;
    this.toast(`Placing ${objectDef(type).name}. ${this.settings.touchControls ? 'Face a spot and press Use.' : 'Click or press E to place, right-click or Esc to cancel.'}`, 'info');
    this.bump();
  }

  cancelBuild(): void {
    this.ui.buildType = undefined;
    this.renderer.ghost = undefined;
    this.bump();
  }

  private confirmBuild(): void {
    const gh = this.renderer.ghost;
    if (!gh || !this.ui.buildType) return;
    const o = placeStructure(this.game, this.game.player, this.ui.buildType, gh.x, gh.y);
    if (o) {
      audio.play('build');
      this.ui.buildType = undefined;
      this.renderer.ghost = undefined;
      // start working on it right away
      startAction(this.game, this.game.player, 'build', 30, { targetId: o.id });
    }
    this.bump();
  }

  // --- keyboard actions -------------------------------------------------------------

  openPanel(p: PanelId | null, container?: number): void {
    this.ui.panel = this.ui.panel === p && container === undefined ? null : p;
    this.ui.container = container;
    this.ui.menu = undefined;
    if (p) audio.play('uiOpen');
    this.bump();
  }

  private onAction(a: ActionKey, e: KeyboardEvent): void {
    audio.unlock();
    const g = this.game;
    const p = g.player;
    if (this.ui.dead) return;
    if (this.ui.doc && a === 'menu') {
      this.ui.doc = undefined;
      this.bump();
      return;
    }
    // number keys pick from an open interaction menu
    if (this.ui.menu) {
      if (a === 'menu') {
        this.ui.menu = undefined;
        this.bump();
        return;
      }
      if (a === 'interact') {
        const first = this.ui.menu.items.findIndex((i) => i.enabled);
        if (first >= 0) this.runMenuItem(first);
        return;
      }
    }
    switch (a) {
      case 'interact':
        if (this.ui.panel && this.ui.panel !== 'menu') return;
        this.interact();
        break;
      case 'attack': {
        if (!p.alive || p.sleeping) return;
        let best;
        let bd = 2.4;
        for (const an of Object.values(g.state.animals)) {
          const d = Math.hypot(an.x - p.x, an.y - p.y);
          if (d < bd) {
            bd = d;
            best = an;
          }
        }
        if (best) attackAnimal(g, p, best);
        else this.toast('Nothing to strike at.', 'info');
        break;
      }
      case 'menu':
        if (this.ui.buildType) return this.cancelBuild();
        this.openPanel(this.ui.panel ? null : 'menu');
        break;
      case 'debug':
        if (debugAllowed()) {
          this.ui.debug = !this.ui.debug;
          this.bump();
        }
        break;
      case 'sleep':
        if (!p.alive) return;
        if (p.sleeping) g.wake(p, 'You get up.');
        else g.startSleep(p);
        break;
      case 'toilet': {
        if (!p.alive || p.sleeping) return;
        if (p.needs.bladder < 15) {
          this.toast('You do not need to go.', 'info');
          return;
        }
        const lat = g.index.nearestOfType('latrine', p.x, p.y, 2.5, (o) => o.build === undefined);
        startAction(g, p, 'relieve', 3, lat ? { targetId: lat.id } : {});
        break;
      }
      case 'home':
        if (!p.alive) return;
        g.setHomePin(p.x, p.y);
        this.toast('Home Pin set here. The group will make camp at this spot.', 'good');
        void this.save('auto');
        break;
      case 'light':
        this.toggleLight();
        break;
      case 'inventory':
      case 'craft':
      case 'build':
      case 'map':
      case 'group':
      case 'character':
      case 'journal':
      case 'camp':
        this.openPanel(a === 'camp' ? 'camp' : a);
        break;
    }
    void e;
    this.bump();
  }

  toggleLight(): void {
    const p = this.game.player;
    const hand = p.equipment.hand;
    if (hand && itemDef(hand.id).light) {
      const left = addItem(p.inventory, hand);
      if (!left) p.equipment.hand = null;
      this.toast('You put the light away.', 'info');
      return;
    }
    const i = p.inventory.findIndex((s) => s && itemDef(s.id).light && (s.charge ?? 0) > 0);
    if (i < 0) {
      this.toast('You have no working light. A torch can be made from a branch and cloth.', 'warn');
      return;
    }
    const s = p.inventory[i]!;
    p.inventory[i] = hand ?? null;
    p.equipment.hand = s;
    this.toast(s.id === 'torch' ? 'You light the torch.' : 'You switch on the flashlight.', 'info');
  }

  async save(slot: SlotId): Promise<boolean> {
    try {
      this.ui.saving = slot;
      this.bump();
      await saveGame(this.game.state, slot);
      if (slot !== 'auto') this.toast('Game saved.', 'good');
      return true;
    } catch (e) {
      log.error('save', 'saving failed', e);
      this.toast('Saving failed. See the console for details.', 'bad');
      return false;
    } finally {
      this.ui.saving = undefined;
      this.bump();
    }
  }

  continueAs(id: string): void {
    if (this.game.switchPlayer(id)) {
      this.ui.dead = undefined;
      this.bump();
    }
  }

  destroy(): void {
    this.stop();
    for (const u of this.unsubs) u();
    this.input.destroy();
    this.renderer.destroy();
    this.game.bus.clear();
  }
}
