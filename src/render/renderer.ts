import type { Game } from '@/sim/game';
import type { Character, WorldObject } from '@/sim/types';
import { objectDef, isTree } from '@/content/objects';
import { itemDef } from '@/content/items';
import { isWater } from '@/content/terrain';
import { daylight, season, hourOf, sunTimes } from '@/sim/clock';
import { weatherGloom } from '@/sim/environment';
import { ACTIONS } from '@/sim/actions';
import { valueNoise } from '@/core/noise';
import { TerrainCache, TILE, CHUNK } from './terrain';
import { treeSprite } from './trees';
import { objectSprite } from './objects';
import { CH, CW, drawCharacterFrame, characterAtlas, type FrameName } from './characters';
import { animalSprite } from './animals';
import { buildingSprite } from './buildings';
import { h2 } from './pixel';

/** Objects that lie flat on the ground and are drawn beneath characters. */
const FLAT = new Set([
  'deadfall', 'rocks', 'flowers', 'mushrooms', 'wild_garlic', 'garden_plot', 'bough_bed', 'latrine', 'pile', 'carcass', 'corpse',
  'snare', 'plank_floor', 'foundation', 'fern', 'bilberry', 'bed', 'supply_bag', 'tall_grass', 'nettles', 'log_seat', 'bench',
]);

export interface Ghost {
  type: string;
  x: number;
  y: number;
  ok: boolean;
}

interface Drop {
  x: number;
  y: number;
  v: number;
}

export interface RenderOptions {
  reducedEffects: boolean;
  lowResolution: boolean;
  showNames: boolean;
}

export class Renderer {
  screen: HTMLCanvasElement;
  private sctx: CanvasRenderingContext2D;
  private buf: HTMLCanvasElement;
  private b: CanvasRenderingContext2D;
  private light: HTMLCanvasElement;
  private l: CanvasRenderingContext2D;
  private fogTex: HTMLCanvasElement;
  terrain: TerrainCache;
  scale = 3;
  cssScale = 3;
  bw = 320;
  bh = 180;
  camX = 0;
  camY = 0;
  private camInit = false;
  ghost?: Ghost;
  highlight?: { x: number; y: number; w: number; h: number };
  hoverChar?: string;
  opts: RenderOptions = { reducedEffects: false, lowResolution: false, showNames: true };
  private drops: Drop[] = [];
  private flash = 0;
  frameMs = 0;

  constructor(private game: Game, container: HTMLElement) {
    this.screen = document.createElement('canvas');
    this.screen.className = 'game-canvas';
    // always beneath any UI already present in the container
    container.prepend(this.screen);
    this.sctx = this.screen.getContext('2d')!;
    this.buf = document.createElement('canvas');
    this.b = this.buf.getContext('2d')!;
    this.light = document.createElement('canvas');
    this.l = this.light.getContext('2d')!;
    this.terrain = new TerrainCache(game.index, game.state.seed);
    this.fogTex = this.makeFog();
    game.bus.on('lightning', (e) => (this.flash = Math.max(this.flash, e.intensity)));
    this.resize();
  }

  private makeFog(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d')!;
    const img = g.createImageData(128, 128);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        // tileable noise by wrapping coordinates
        const n = (valueNoise(7, x / 16, y / 16) + valueNoise(7, (x - 128) / 16, y / 16) * 0) * 0.8 + valueNoise(9, x / 6, y / 6) * 0.2;
        const o = (y * 128 + x) * 4;
        img.data[o] = 220;
        img.data[o + 1] = 226;
        img.data[o + 2] = 230;
        img.data[o + 3] = Math.floor(n * 255);
      }
    g.putImageData(img, 0, 0);
    return c;
  }

  resize(): void {
    const parent = this.screen.parentElement;
    const cssW = parent?.clientWidth || window.innerWidth;
    const cssH = parent?.clientHeight || window.innerHeight;
    const dpr = this.opts.lowResolution ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.cssScale = Math.max(2, Math.min(6, Math.floor(cssH / (TILE * 15.5))));
    this.scale = Math.max(1, Math.round(this.cssScale * dpr));
    this.screen.width = Math.round(cssW * dpr);
    this.screen.height = Math.round(cssH * dpr);
    this.screen.style.width = `${cssW}px`;
    this.screen.style.height = `${cssH}px`;
    this.bw = Math.ceil(this.screen.width / this.scale);
    this.bh = Math.ceil(this.screen.height / this.scale);
    this.buf.width = this.bw;
    this.buf.height = this.bh;
    this.light.width = this.bw;
    this.light.height = this.bh;
    this.b.imageSmoothingEnabled = false;
    this.sctx.imageSmoothingEnabled = false;
    this.terrain.setBudget(Math.ceil(this.bw / (TILE * CHUNK) + 2) * Math.ceil(this.bh / (TILE * CHUNK) + 2) * 2 + 8);
  }

  setGame(game: Game): void {
    this.game = game;
    this.terrain = new TerrainCache(game.index, game.state.seed);
    this.camInit = false;
  }

  /** Screen (CSS px) to world tile coordinates. */
  screenToWorld(cssX: number, cssY: number): { x: number; y: number } {
    const dpr = this.screen.width / (this.screen.clientWidth || 1);
    const bx = (cssX * dpr) / this.scale;
    const by = (cssY * dpr) / this.scale;
    return { x: (bx + this.camX) / TILE, y: (by + this.camY) / TILE };
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    const dpr = this.screen.width / (this.screen.clientWidth || 1);
    return { x: ((x * TILE - this.camX) * this.scale) / dpr, y: ((y * TILE - this.camY) * this.scale) / dpr };
  }

  render(dtReal: number, now: number): void {
    const t0 = performance.now();
    const game = this.game;
    const s = game.state;
    const p = game.player;
    const b = this.b;
    const sea = season(s.time).id;
    const snow = s.weather.snowDepth > 3;

    // consume terrain changes
    if (game.index.dirtyTiles.length) {
      for (const i of game.index.dirtyTiles) this.terrain.invalidateTile(i);
      game.index.dirtyTiles.length = 0;
    }

    // camera follows the player smoothly and stays inside the world
    const worldW = s.width * TILE;
    const worldH = s.height * TILE;
    const tx = Math.max(0, Math.min(worldW - this.bw, p.x * TILE - this.bw / 2));
    const ty = Math.max(0, Math.min(worldH - this.bh, p.y * TILE - 8 - this.bh / 2));
    if (!this.camInit) {
      this.camX = tx;
      this.camY = ty;
      this.camInit = true;
    } else {
      const k = Math.min(1, dtReal * 10);
      this.camX += (tx - this.camX) * k;
      this.camY += (ty - this.camY) * k;
    }
    const cx = Math.round(this.camX);
    const cy = Math.round(this.camY);

    b.fillStyle = '#10140e';
    b.fillRect(0, 0, this.bw, this.bh);

    // terrain chunks
    const cpx = TILE * CHUNK;
    const c0x = Math.floor(cx / cpx);
    const c0y = Math.floor(cy / cpx);
    const c1x = Math.floor((cx + this.bw) / cpx);
    const c1y = Math.floor((cy + this.bh) / cpx);
    for (let yy = c0y; yy <= c1y; yy++)
      for (let xx = c0x; xx <= c1x; xx++) {
        if (xx < 0 || yy < 0 || xx * CHUNK >= s.width || yy * CHUNK >= s.height) continue;
        b.drawImage(this.terrain.get(xx, yy, sea, snow), xx * cpx - cx, yy * cpx - cy);
      }

    const t = now / 1000;
    const tx0 = Math.floor(cx / TILE) - 2;
    const ty0 = Math.floor(cy / TILE) - 1;
    const tx1 = Math.ceil((cx + this.bw) / TILE) + 2;
    const ty1 = Math.ceil((cy + this.bh) / TILE) + 4;

    // water shimmer
    if (!this.opts.reducedEffects) {
      b.fillStyle = 'rgba(210,235,240,0.55)';
      for (let yy = ty0; yy <= ty1; yy++)
        for (let xx = tx0; xx <= tx1; xx++) {
          if (!isWater(game.index.terrainAt(xx, yy))) continue;
          const r = h2(xx, yy, 99);
          const phase = (t * 0.6 + r * 10) % 3;
          if (phase < 0.8) {
            const px = xx * TILE + Math.floor(r * 12) + Math.floor(phase * 3) - cx;
            const py = yy * TILE + Math.floor(h2(xx, yy, 98) * 14) - cy;
            b.fillRect(px, py, 2 + (phase < 0.4 ? 1 : 0), 1);
          }
        }
    }

    // collect drawables
    type D = { y: number; flat: boolean; draw: () => void };
    const list: D[] = [];
    const seen = new Set<number>();
    const idx = game.index;
    const playerFeetY = p.y * TILE;
    const wind = s.weather.wind;
    const insideBuilding = idx.buildingAt(Math.floor(p.x), Math.floor(p.y));

    for (let yy = Math.max(0, ty0); yy <= Math.min(s.height - 1, ty1); yy++)
      for (let xx = Math.max(0, tx0); xx <= Math.min(s.width - 1, tx1); xx++) {
        const id = idx.tileObj[yy * s.width + xx];
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const o = s.objects[id];
        if (!o) continue;
        const d = objectDef(o.type);
        const bottom = (o.y + (d.h ?? 1)) * TILE;
        const flat = FLAT.has(o.type);
        list.push({ y: flat ? o.y * TILE : bottom - 2, flat, draw: () => this.drawObject(o, cx, cy, t, sea, snow, wind, playerFeetY) });
      }
    for (const c of Object.values(s.characters)) {
      if (!c.alive) continue;
      if (c.x < tx0 - 1 || c.x > tx1 + 1 || c.y < ty0 - 1 || c.y > ty1 + 2) continue;
      list.push({ y: c.y * TILE, flat: false, draw: () => this.drawCharacter(c, cx, cy, t) });
    }
    for (const a of Object.values(s.animals)) {
      if (a.x < tx0 || a.x > tx1 || a.y < ty0 || a.y > ty1) continue;
      list.push({
        y: a.y * TILE,
        flat: false,
        draw: () => {
          const frame = a.state === 'sleep' ? 3 : a.moving ? 1 + (Math.floor(t * (a.state === 'flee' ? 12 : 6) + a.id) % 2) : 0;
          const spr = animalSprite(a.species, frame);
          if (!spr) return;
          const x = Math.round(a.x * TILE - spr.w / 2 - cx);
          const y = Math.round(a.y * TILE - spr.h + 2 - cy);
          if (a.facing === 'right') {
            b.save();
            b.translate(x + spr.w, y);
            b.scale(-1, 1);
            b.drawImage(spr.img, 0, 0);
            b.restore();
          } else b.drawImage(spr.img, x, y);
        },
      });
    }
    for (const bl of s.buildings) {
      if (bl.x > tx1 || bl.x + bl.w < tx0 || bl.y - 1 > ty1 || bl.y + bl.h < ty0) continue;
      if (insideBuilding === bl) continue;
      list.push({
        y: (bl.y + bl.h) * TILE - 1,
        flat: false,
        draw: () => b.drawImage(buildingSprite(bl, snow), bl.x * TILE - 2 - cx, (bl.y - 1) * TILE - cy),
      });
    }
    list.sort((a, c) => (a.flat === c.flat ? a.y - c.y : a.flat ? -1 : 1));
    for (const d of list) d.draw();

    // construction ghost
    if (this.ghost) this.drawGhost(this.ghost, cx, cy, sea, snow);
    if (this.highlight) {
      const h = this.highlight;
      b.strokeStyle = 'rgba(255,240,200,0.8)';
      b.lineWidth = 1;
      const x = Math.round(h.x * TILE - cx) + 0.5;
      const y = Math.round(h.y * TILE - cy) + 0.5;
      const w = h.w * TILE - 1;
      const hh = h.h * TILE - 1;
      const k = 3;
      b.beginPath();
      for (const [ax, ay, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + hh, 1, -1], [x + w, y + hh, -1, -1]]) {
        b.moveTo(ax + dx * k, ay);
        b.lineTo(ax, ay);
        b.lineTo(ax, ay + dy * k);
      }
      b.stroke();
    }

    this.drawWeather(dtReal, t, cx, cy);
    this.drawLighting(t, cx, cy);

    // lightning flash
    if (this.flash > 0.01) {
      b.fillStyle = `rgba(230,236,255,${this.flash * 0.6})`;
      b.fillRect(0, 0, this.bw, this.bh);
      this.flash *= Math.pow(0.02, dtReal);
    }

    // blit
    const sc = this.sctx;
    sc.imageSmoothingEnabled = false;
    sc.drawImage(this.buf, 0, 0, this.bw * this.scale, this.bh * this.scale);
    this.drawScreenText(cx, cy);
    this.frameMs = this.frameMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  private drawObject(o: WorldObject, cx: number, cy: number, t: number, sea: ReturnType<typeof season>['id'], snow: boolean, wind: number, playerFeetY: number): void {
    const b = this.b;
    if (isTree(o.type)) {
      const spr = treeSprite(o.type, o.v ?? 0, sea, snow);
      const x = Math.round(o.x * TILE + 8 - spr.ax - cx);
      const y = Math.round(o.y * TILE + 14 - spr.ay - cy);
      const sway = this.opts.reducedEffects ? 0 : Math.round(Math.sin(t * 1.4 + o.id * 0.7) * Math.min(1.4, wind / 6));
      // fade trees that hide the player
      const p = this.game.player;
      const behind = playerFeetY < o.y * TILE + 12 && playerFeetY > o.y * TILE - 36 && Math.abs(p.x - (o.x + 0.5)) < 1.3;
      if (behind) b.globalAlpha = 0.5;
      b.drawImage(spr.img, 0, 0, spr.img.width, spr.split, x + sway, y, spr.img.width, spr.split);
      b.drawImage(spr.img, 0, spr.split, spr.img.width, spr.img.height - spr.split, x, y + spr.split, spr.img.width, spr.img.height - spr.split);
      b.globalAlpha = 1;
      if (o.burning) this.drawFlames(o.x * TILE + 8 - cx, o.y * TILE + 4 - cy, 1.6, t, o.id);
      return;
    }
    const spr = objectSprite(o, sea, snow);
    if (!spr) return;
    let x = o.x * TILE + spr.ox - cx;
    const y = o.y * TILE + spr.oy - cy;
    if ((o.type === 'tall_grass' || o.type === 'reeds') && !this.opts.reducedEffects) x += Math.round(Math.sin(t * 2 + o.id) * Math.min(1, wind / 7));
    if (o.build !== undefined) {
      b.globalAlpha = 0.35 + o.build * 0.4;
      b.drawImage(spr.img, x, y);
      b.globalAlpha = 1;
      const d = objectDef(o.type);
      const w = (d.w ?? 1) * TILE;
      b.fillStyle = '#1a1a1a';
      b.fillRect(o.x * TILE - cx + 1, o.y * TILE - cy - 3, w - 2, 3);
      b.fillStyle = '#d8b04a';
      b.fillRect(o.x * TILE - cx + 2, o.y * TILE - cy - 2, Math.round((w - 4) * o.build), 1);
      return;
    }
    b.drawImage(spr.img, x, y);
    if (o.lit) this.drawFlames(o.x * TILE + 8 - cx, o.y * TILE + (o.type === 'stove' ? 6 : 10) - cy, Math.min(1.3, 0.6 + (o.s ?? 0) / 200), t, o.id);
    else if ((o.embers ?? 0) > this.game.state.time && Math.floor(t * 3 + o.id) % 3 === 0) {
      b.fillStyle = '#e0602a';
      b.fillRect(o.x * TILE + 7 - cx, o.y * TILE + 10 - cy, 1, 1);
    }
    if (o.burning) this.drawFlames(o.x * TILE + 8 - cx, o.y * TILE + 8 - cy, 1.2, t, o.id);
  }

  private drawFlames(x: number, y: number, size: number, t: number, seed: number): void {
    const b = this.b;
    const cols = ['#fff3b0', '#ffd24a', '#ff9a2a', '#e0521e', '#a8321a'];
    const n = Math.round(6 * size);
    for (let i = 0; i < n; i++) {
      const ph = (t * 3.2 + i * 0.37 + seed * 0.13) % 1;
      const jx = Math.sin(t * 9 + i * 2.1 + seed) * 2.2 * size;
      const px = Math.round(x + jx * (1 - ph) + (i % 3) - 1);
      const py = Math.round(y - ph * 9 * size);
      const ci = Math.min(cols.length - 1, Math.floor(ph * cols.length));
      b.fillStyle = cols[ci];
      const w = ph < 0.4 ? 2 : 1;
      b.fillRect(px, py, w, w + (ph < 0.3 ? 1 : 0));
    }
    // smoke
    if (!this.opts.reducedEffects) {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.35 + i / 3 + seed * 0.07) % 1;
        b.fillStyle = `rgba(160,160,155,${0.35 * (1 - ph)})`;
        b.fillRect(Math.round(x + Math.sin(t + i * 2) * 3 + ph * this.game.state.weather.wind * 1.5), Math.round(y - 10 - ph * 22), 2, 2);
      }
    }
  }

  private drawCharacter(c: Character, cx: number, cy: number, t: number): void {
    const b = this.b;
    const x = c.x * TILE - CW / 2 - cx;
    const y = c.y * TILE - CH + 3 - cy;
    if (c.sleeping) {
      const atlas = characterAtlas(c);
      // slow breathing
      const breath = Math.floor(t * 0.7 + (c.x * 7.3) % 3) % 2 === 1;
      b.drawImage(breath ? atlas.sleep2 : atlas.sleep, Math.round(c.x * TILE - 12 - cx), Math.round(c.y * TILE - 10 - cy));
      if (Math.floor(t * 1.2 + c.x) % 3 === 0) {
        b.fillStyle = 'rgba(230,230,240,0.8)';
        b.fillRect(Math.round(c.x * TILE - 6 - cx), Math.round(c.y * TILE - 14 - cy - ((t * 4) % 4)), 2, 1);
      }
      return;
    }
    const anim = c.action ? ACTIONS[c.action.type]?.anim : undefined;
    // a per-character phase so a group never moves in lockstep
    const phase = ((c.x * 13.7 + c.y * 7.1) % 1) * 3;
    let frame: FrameName;
    if (anim === 'work') frame = Math.floor(t * 3.5 + phase) % 2 ? 'work1' : 'work2';
    else if (anim === 'chop') {
      // a slow wind-up, then a quick strike
      const k = (t * 1.6 + phase) % 1;
      frame = k < 0.62 ? 'chop1' : 'chop2';
    } else if (anim === 'crouch') frame = Math.floor(t * 2.2 + phase) % 2 ? 'crouch1' : 'crouch2';
    else if (anim === 'fish') frame = 'fish';
    else if (anim === 'eat') frame = Math.floor(t * 2) % 2 ? 'eat' : 'idle';
    else if (anim === 'sit') frame = Math.floor(t * 0.8 + phase) % 2 ? 'sit' : 'sit2';
    else if (c.moving) {
      const speed = c.sprinting ? 12 : 8;
      frame = (['walk1', 'walk2', 'walk3', 'walk4'] as const)[Math.floor(t * speed) % 4];
    } else {
      // idle: breathe, blink now and then, gesture while talking
      const talking = !!c.speech && c.speech.until > this.game.state.time && (c.speech.from ?? 0) <= this.game.state.time;
      const blinkNow = (t + phase * 1.7) % 3.6 < 0.14;
      if (blinkNow) frame = 'blink';
      else if (talking && Math.floor(t * 2.5 + phase) % 3 === 0) frame = 'talk';
      else frame = Math.floor(t * 0.9 + phase) % 2 ? 'idle' : 'idle2';
    }
    drawCharacterFrame(b, c, frame, x, y);
    // hand-held light
    const hand = c.equipment.hand;
    if (hand && hand.id === 'torch' && (hand.charge ?? 0) > 0) this.drawFlames(c.x * TILE + (c.facing === 'left' ? -5 : 5) - cx, y + 10, 0.5, t, 3);
  }

  private drawGhost(g: Ghost, cx: number, cy: number, sea: ReturnType<typeof season>['id'], snow: boolean): void {
    const b = this.b;
    const d = objectDef(g.type);
    const fake: WorldObject = { id: 0, type: g.type, x: g.x, y: g.y, v: 1 };
    const spr = objectSprite(fake, sea, snow);
    b.globalAlpha = 0.6;
    if (spr) b.drawImage(spr.img, g.x * TILE + spr.ox - cx, g.y * TILE + spr.oy - cy);
    b.globalAlpha = 1;
    b.fillStyle = g.ok ? 'rgba(120,220,120,0.28)' : 'rgba(230,80,60,0.35)';
    b.fillRect(g.x * TILE - cx, g.y * TILE - cy, (d.w ?? 1) * TILE, (d.h ?? 1) * TILE);
    b.strokeStyle = g.ok ? 'rgba(160,240,160,0.9)' : 'rgba(240,120,100,0.9)';
    b.strokeRect(g.x * TILE - cx + 0.5, g.y * TILE - cy + 0.5, (d.w ?? 1) * TILE - 1, (d.h ?? 1) * TILE - 1);
  }

  private drawWeather(dt: number, t: number, cx: number, cy: number): void {
    const s = this.game.state;
    const w = s.weather;
    const b = this.b;
    const snowing = w.current === 'snow';
    const want = Math.round(w.precipitation * (this.opts.reducedEffects ? 90 : 260) * (this.bw * this.bh) / (480 * 270));
    while (this.drops.length < want) this.drops.push({ x: Math.random() * this.bw, y: Math.random() * this.bh, v: Math.random() });
    if (this.drops.length > want) this.drops.length = want;
    const windX = Math.cos(w.windDir) * w.wind;
    if (this.drops.length) {
      b.fillStyle = snowing ? 'rgba(240,245,250,0.9)' : 'rgba(170,195,225,0.55)';
      for (const d of this.drops) {
        if (snowing) {
          d.y += (14 + d.v * 10) * dt;
          d.x += (Math.sin(t * 1.5 + d.v * 10) * 6 + windX * 2) * dt;
          b.fillRect(Math.round(d.x), Math.round(d.y), d.v > 0.7 ? 2 : 1, d.v > 0.7 ? 2 : 1);
        } else {
          d.y += (220 + d.v * 80) * dt;
          d.x += windX * 12 * dt;
          const len = 4 + Math.round(d.v * 3);
          for (let k = 0; k < len; k++) b.fillRect(Math.round(d.x - windX * 0.3 * k), Math.round(d.y - k), 1, 1);
        }
        if (d.y > this.bh || d.x < -10 || d.x > this.bw + 10) {
          if (!snowing && d.v > 0.6) {
            b.fillStyle = 'rgba(200,215,235,0.5)';
            b.fillRect(Math.round(d.x) - 1, this.bh - 2 - Math.floor(d.v * 60), 3, 1);
            b.fillStyle = 'rgba(170,195,225,0.55)';
          }
          d.y = -Math.random() * 20;
          d.x = Math.random() * (this.bw + 40) - 20;
        }
      }
    }
    // fog / mist
    const fog = w.current === 'fog' ? 0.55 : Math.max(0, (1 - w.visibility) * 0.35);
    if (fog > 0.02) {
      b.globalAlpha = fog;
      const ox = -((cx * 0.6 + t * 4 * (1 + w.wind)) % 128);
      const oy = -((cy * 0.6) % 128);
      for (let y = oy; y < this.bh; y += 128) for (let x = ox; x < this.bw; x += 128) b.drawImage(this.fogTex, Math.round(x), Math.round(y));
      b.globalAlpha = 1;
    }
  }

  private drawLighting(t: number, cx: number, cy: number): void {
    const game = this.game;
    const s = game.state;
    const dl = daylight(s.time);
    const gloom = weatherGloom(s);
    const dark = Math.min(0.9, (1 - dl) * 0.86 + gloom * 0.32);
    const b = this.b;
    // warm tint around sunrise/sunset
    const h = hourOf(s.time);
    const { rise, set } = sunTimes(s.time);
    const golden = Math.max(0, 1 - Math.min(Math.abs(h - rise), Math.abs(h - set)) / 1.2);
    if (golden > 0.02 && dl > 0.1) {
      b.fillStyle = `rgba(255,150,70,${golden * 0.12})`;
      b.fillRect(0, 0, this.bw, this.bh);
    }
    if (dark < 0.03) return;
    const l = this.l;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, this.bw, this.bh);
    l.fillStyle = `rgba(8,12,30,${dark})`;
    l.fillRect(0, 0, this.bw, this.bh);
    l.globalCompositeOperation = 'destination-out';
    const lights: { x: number; y: number; r: number; warm: boolean }[] = [];
    const idx = game.index;
    for (const type of ['campfire', 'fire_pit', 'stove']) {
      const set = idx.byType.get(type);
      if (!set) continue;
      for (const id of set) {
        const o = s.objects[id];
        if (!o?.lit) continue;
        const x = o.x * TILE + 8 - cx;
        const y = o.y * TILE + 8 - cy;
        if (x < -120 || y < -120 || x > this.bw + 120 || y > this.bh + 120) continue;
        const flick = 1 + Math.sin(t * 11 + id) * 0.04 + Math.sin(t * 7.3) * 0.03;
        lights.push({ x, y, r: (o.type === 'stove' ? 50 : 70 + Math.min(30, (o.s ?? 0) / 8)) * flick, warm: true });
      }
    }
    for (const id of game.burning) {
      const o = s.objects[id];
      if (o) lights.push({ x: o.x * TILE + 8 - cx, y: o.y * TILE - cy, r: 60, warm: true });
    }
    for (const c of Object.values(s.characters)) {
      if (!c.alive) continue;
      const hand = c.equipment.hand;
      const ld = hand ? itemDef(hand.id).light : undefined;
      if (!ld || (hand!.charge ?? 0) <= 0) continue;
      const fx = c.facing === 'left' ? -1 : c.facing === 'right' ? 1 : 0;
      const fy = c.facing === 'up' ? -1 : c.facing === 'down' ? 1 : 0;
      const off = hand!.id === 'flashlight' ? 36 : 0;
      lights.push({ x: c.x * TILE - cx + fx * off, y: c.y * TILE - 8 - cy + fy * off, r: ld.radius * TILE * (hand!.id === 'flashlight' ? 0.8 : 1), warm: hand!.id === 'torch' });
    }
    // the player always sees a little around themselves
    const p = game.player;
    lights.push({ x: p.x * TILE - cx, y: p.y * TILE - 8 - cy, r: 26, warm: false });
    for (const L of lights) {
      const g = l.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    l.globalCompositeOperation = 'source-over';
    b.drawImage(this.light, 0, 0);
    // warm glow
    b.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      if (!L.warm) continue;
      const g = b.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r * 0.7);
      g.addColorStop(0, `rgba(255,140,50,${0.22 * dark + 0.05})`);
      g.addColorStop(1, 'rgba(255,140,50,0)');
      b.fillStyle = g;
      b.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    b.globalCompositeOperation = 'source-over';
  }

  private drawScreenText(cx: number, cy: number): void {
    const s = this.game.state;
    const sc = this.sctx;
    const dpr = this.screen.width / (this.screen.clientWidth || 1);
    const fontPx = Math.round(15 * dpr);
    sc.font = `${fontPx}px VT323, monospace`;
    sc.textBaseline = 'middle';
    for (const c of Object.values(s.characters)) {
      if (!c.alive) continue;
      const sx = (c.x * TILE - cx) * this.scale;
      const sy = (c.y * TILE - CH - cy) * this.scale;
      if (sx < -200 || sx > this.screen.width + 200 || sy < -50 || sy > this.screen.height + 50) continue;
      const showName = this.opts.showNames && (this.hoverChar === c.id);
      const sp = c.speech && s.time <= c.speech.until && s.time >= (c.speech.from ?? 0) ? c.speech.text : undefined;
      if (sp) {
        const maxW = 220 * dpr;
        const words = sp.split(' ');
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
          const test = cur ? `${cur} ${w}` : w;
          if (sc.measureText(test).width > maxW && cur) {
            lines.push(cur);
            cur = w;
          } else cur = test;
        }
        if (cur) lines.push(cur);
        const lh = fontPx * 1.05;
        const w = Math.max(...lines.map((l) => sc.measureText(l).width)) + 12 * dpr;
        const h = lines.length * lh + 8 * dpr;
        const bx = Math.round(sx - w / 2);
        const by = Math.round(sy - h - 6 * dpr);
        sc.fillStyle = 'rgba(20,22,20,0.82)';
        sc.fillRect(bx, by, w, h);
        sc.fillStyle = 'rgba(20,22,20,0.82)';
        sc.fillRect(Math.round(sx - 3 * dpr), by + h, 6 * dpr, 4 * dpr);
        sc.fillStyle = '#e8e2d0';
        sc.textAlign = 'center';
        lines.forEach((l, i) => sc.fillText(l, sx, by + 4 * dpr + lh * (i + 0.5)));
      }
      if (showName) {
        sc.textAlign = 'center';
        const label = `${c.name}${c.id === s.playerId ? '' : ` - ${c.sleeping ? 'Sleeping' : c.ai.taskLabel}`}`;
        const w = sc.measureText(label).width + 10 * dpr;
        sc.fillStyle = 'rgba(10,12,10,0.75)';
        sc.fillRect(Math.round(sx - w / 2), Math.round(sy - (sp ? 60 : 16) * dpr), w, fontPx + 2 * dpr);
        sc.fillStyle = '#f0e6c8';
        sc.fillText(label, sx, sy - (sp ? 60 : 16) * dpr + fontPx / 2 + dpr);
      }
    }
  }

  destroy(): void {
    this.screen.remove();
  }
}
