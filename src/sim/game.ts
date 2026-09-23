import { EventBus } from '@/core/events';
import { Rng } from '@/core/rng';
import { clamp } from '@/core/math';
import { log } from '@/core/logger';
import { objectDef } from '@/content/objects';
import { terrainDef, T } from '@/content/terrain';
import { itemDef } from '@/content/items';
import type {
  Character,
  Dir,
  GameState,
  Illness,
  Injury,
  JournalEntry,
  OrderId,
  WorldObject,
} from './types';
import { WorldIndex } from './world';
import { computeEnv, type LocalEnv } from './environment';
import { addInjury, perceivedTemp, statusMods, updateBody, hasSleepingBag } from './body';
import { ACTIONS, startAction } from './actions';
import { dayOf, daylight, hourOf, sunTimes, MIN_PER_DAY, season } from './clock';
import { updateWeather } from './weather';
import { updateFires } from './fire';
import { loadRatio, totalKcal, liquidTotal } from './inventory';
import { Social } from './social';
import { updateNpc, npcThink, onNpcArrivedHome } from './npc';
import { updateWildlife } from './wildlife';
import { updateEcology, updateSpoilage } from './ecology';
import { checkHints } from './hints';
import { checkObjectives, notePlayerDid } from './objectives';
import { finalizeTerrainStructure } from './building';
import { moveAnimals } from './wildlife';

export type Tone = 'info' | 'good' | 'warn' | 'bad';

export interface GameEvents extends Record<string, unknown> {
  message: { text: string; tone: Tone };
  journal: JournalEntry;
  sound: { id: string; x: number; y: number };
  lightning: { intensity: number };
  weatherChanged: { from: string; to: string };
  fireOut: { id: number };
  openContainer: { id: number };
  playerDied: { id: string; cause: string };
  hint: { id: string; text: string };
  requestAutosave: { reason: string };
  speech: { id: string; text: string };
  discovered: { name: string };
  openPanel: string;
  readDoc: string;
}

export interface SimSettings {
  aiEnabled: boolean;
  fogOfWar: boolean;
  godMode: boolean;
  speed: number;
}

export interface PlayerInput {
  dx: number;
  dy: number;
  sprint: boolean;
}

/** Real seconds -> game minutes at 1x speed. */
export const MINUTES_PER_SECOND = 1;
export const WALK_SPEED = 4.2; // tiles per game minute
const NEAR_RADIUS = 42;

export class Game {
  state: GameState;
  index: WorldIndex;
  bus = new EventBus<GameEvents>();
  rng: Rng;
  social: Social;
  burning = new Set<number>();
  settings: SimSettings = { aiEnabled: true, fogOfWar: true, godMode: false, speed: 1 };
  input: PlayerInput = { dx: 0, dy: 0, sprint: false };
  /** runtime perf counters */
  perf = { simMs: 0, ticks: 0, nearNpcs: 0, farNpcs: 0 };
  timeScale = 1;
  private needsAcc = 0;
  private farAcc = 0;
  private lowAcc = 0;
  private hourAcc = 0;
  private lastDay: number;
  private lastPlayerTile = -1;
  private envCache = new Map<string, { t: number; env: LocalEnv }>();

  constructor(state: GameState) {
    this.state = state;
    this.index = new WorldIndex(state);
    this.rng = new Rng((state.seed ^ Math.floor(state.time * 7919)) >>> 0);
    this.social = new Social(this);
    for (const k in state.objects) if (state.objects[k].burning) this.burning.add(state.objects[k].id);
    this.lastDay = dayOf(state.time);
    if (Object.keys(state.relationships).length === 0) this.social.initialise();
    this.revealAround(this.player.x, this.player.y, 10);
  }

  get player(): Character {
    return this.state.characters[this.state.playerId];
  }

  isPlayer(c: Character): boolean {
    return c.id === this.state.playerId;
  }

  livingCharacters(): Character[] {
    return Object.values(this.state.characters).filter((c) => c.alive);
  }

  npcs(): Character[] {
    return Object.values(this.state.characters).filter((c) => c.alive && c.id !== this.state.playerId);
  }

  get home(): { x: number; y: number } {
    return this.state.homePin ?? this.state.startPoint;
  }

  // --- messaging ------------------------------------------------------------

  warn(scope: string, msg: string): void {
    log.warn(scope, msg);
  }

  journal(text: string, kind: JournalEntry['kind']): void {
    const e: JournalEntry = { t: this.state.time, day: dayOf(this.state.time), text, kind };
    this.state.journal.push(e);
    if (this.state.journal.length > 400) this.state.journal.splice(0, this.state.journal.length - 400);
    this.bus.emit('journal', e);
  }

  message(text: string, tone: Tone = 'info'): void {
    this.bus.emit('message', { text, tone });
  }

  charMessage(c: Character, text: string, tone: Tone = 'info'): void {
    if (this.isPlayer(c)) this.message(text, tone);
  }

  nearbyMessage(x: number, y: number, text: string, tone: Tone = 'info'): void {
    const p = this.player;
    if (p && Math.hypot(p.x - x, p.y - y) < 14) this.message(text, tone);
  }

  say(c: Character, text: string, minutes = 6, delay = 0): void {
    if (!c.alive) return;
    c.speech = { text, from: this.state.time + delay, until: this.state.time + delay + minutes };
    c.ai.lastSpeech = this.state.time;
    this.bus.emit('speech', { id: c.id, text });
  }

  // --- environment ----------------------------------------------------------

  /** Environment lookups are cached per tile for a game minute. */
  envAt(x: number, y: number): LocalEnv {
    const key = `${Math.floor(x * 2)},${Math.floor(y * 2)}`;
    const hit = this.envCache.get(key);
    if (hit && this.state.time - hit.t < 1) return hit.env;
    const env = computeEnv(this.state, this.index, x, y);
    this.envCache.set(key, { t: this.state.time, env });
    if (this.envCache.size > 400) this.envCache.clear();
    return env;
  }

  // --- main update ----------------------------------------------------------

  /** Advance the simulation by a real-time delta (seconds). */
  update(realDt: number): void {
    const t0 = performance.now();
    realDt = Math.min(realDt, 0.1);
    const p = this.player;
    let scale = this.settings.speed;
    if (p?.alive && p.sleeping) scale *= 60;
    else if (p?.alive && p.action && ACTIONS[p.action.type]?.fastForward && p.action.duration >= 6) scale *= 10;
    this.timeScale = scale;
    let remaining = realDt * MINUTES_PER_SECOND * scale;
    // sub-steps keep movement and collision stable at high speeds
    let guard = 0;
    while (remaining > 1e-6 && guard++ < 400) {
      const step = Math.min(remaining, 0.25);
      this.step(step);
      remaining -= step;
    }
    this.perf.simMs = this.perf.simMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  /** Run the simulation forward by game minutes (debug, tests). */
  advance(minutes: number): void {
    let remaining = minutes;
    while (remaining > 1e-6) {
      const st = Math.min(remaining, 0.25);
      this.step(st);
      remaining -= st;
    }
  }

  private step(dt: number): void {
    const s = this.state;
    s.time += dt;
    this.perf.ticks++;
    const p = this.player;

    // player movement
    if (p?.alive) this.updatePlayer(p, dt);

    moveAnimals(this, dt);

    // actions progress for everyone
    for (const c of this.livingCharacters()) this.progressAction(c, dt);

    // NPC movement/behaviour: near NPCs every step, far ones in cheaper batches
    let near = 0;
    let far = 0;
    for (const c of this.npcs()) {
      const d = p ? Math.hypot(c.x - p.x, c.y - p.y) : 0;
      const isNear = d < NEAR_RADIUS;
      if (isNear) near++;
      else far++;
      this.safe(c, () => {
        if (this.settings.aiEnabled && s.time >= c.ai.nextThink && !c.sleeping) npcThink(this, c);
        updateNpc(this, c, dt, isNear);
      });
    }
    this.perf.nearNpcs = near;
    this.perf.farNpcs = far;

    // bodies: near characters every game minute, far every 5
    this.needsAcc += dt;
    this.farAcc += dt;
    if (this.needsAcc >= 1) {
      const step = this.needsAcc;
      this.needsAcc = 0;
      for (const c of this.livingCharacters()) {
        const d = p ? Math.hypot(c.x - p.x, c.y - p.y) : 0;
        if (d < NEAR_RADIUS || this.isPlayer(c)) this.safe(c, () => this.updateCharacterBody(c, step));
      }
      updateFires(this, step);
      updateWildlife(this, step, true);
      // the beginner checklist reacts within a game minute
      if (p?.alive) checkObjectives(this);
    }
    if (this.farAcc >= 5) {
      const step = this.farAcc;
      this.farAcc = 0;
      for (const c of this.livingCharacters()) {
        const d = p ? Math.hypot(c.x - p.x, c.y - p.y) : 0;
        if (d >= NEAR_RADIUS && !this.isPlayer(c)) this.safe(c, () => this.updateCharacterBody(c, step));
      }
      updateWeather(this, step);
      updateWildlife(this, step, false);
      if (p?.alive) checkHints(this);
    }
    this.lowAcc += dt;
    if (this.lowAcc >= 30) {
      const step = this.lowAcc;
      this.lowAcc = 0;
      updateSpoilage(this, step);
      this.social.update(step);
    }
    this.hourAcc += dt;
    if (this.hourAcc >= 60) {
      const step = this.hourAcc;
      this.hourAcc = 0;
      updateEcology(this, step);
      this.decayContamination(step);
    }
    const day = dayOf(s.time);
    if (day !== this.lastDay) {
      this.lastDay = day;
      this.onNewDay(day);
    }
  }

  private safe(c: Character, fn: () => void): void {
    try {
      fn();
    } catch (e) {
      c.ai.errors = (c.ai.errors ?? 0) + 1;
      log.error('sim', `entity ${c.id} failed: ${(e as Error).message}`, e);
      // isolate a repeatedly failing entity rather than crashing the world
      c.action = undefined;
      c.ai.path = undefined;
      c.ai.task = 'idle';
      c.ai.nextThink = this.state.time + 5;
    }
  }

  private updateCharacterBody(c: Character, dt: number): void {
    const env = { ...this.envAt(c.x, c.y), huddle: this.huddleWarmth(c) };
    const act = c.action ? ACTIONS[c.action.type] : undefined;
    c.exertion = c.sleeping ? 0.75 : act ? act.exertion : c.moving ? (c.sprinting ? 2.6 : 1.6) * Math.max(1, loadRatio(c) * 0.9) : 1;
    if (this.settings.godMode && this.isPlayer(c)) {
      c.health.hp = 100;
    }
    updateBody(this, c, dt, env);
    if (!c.alive) return;
    // track light sources: flashlight / torch drain while it is dark
    const light = c.equipment.hand;
    if (light && itemDef(light.id).light && daylight(this.state.time) < 0.4 && light.charge !== undefined) {
      light.charge = Math.max(0, light.charge - (itemDef(light.id).light!.drainPerHour / 60) * dt);
      if (light.charge <= 0 && light.id === 'torch') {
        c.equipment.hand = null;
        this.charMessage(c, 'The torch has burned out.', 'warn');
      }
    }
  }

  private progressAction(c: Character, dt: number): void {
    const a = c.action;
    if (!a) return;
    const def = ACTIONS[a.type];
    if (!def) {
      c.action = undefined;
      return;
    }
    a.elapsed += dt;
    if (def.tick) {
      const ok = def.tick(this, c, a, dt);
      if (ok === false) {
        if (c.action === a) {
          c.action = undefined;
          if (a.type === 'build') def.complete(this, c, a);
        }
        return;
      }
    }
    if (a.elapsed >= a.duration && c.action === a) {
      c.action = undefined;
      try {
        def.complete(this, c, a);
        if (this.isPlayer(c)) notePlayerDid(this, a.type);
      } catch (e) {
        log.error('actions', `action ${a.type} failed for ${c.id}`, e);
      }
    }
  }

  /** Resting or sleeping close to others shares body heat. */
  huddleWarmth(c: Character): number {
    if (!c.sleeping && c.action?.type !== 'rest') return 0;
    let n = 0;
    for (const o of this.livingCharacters()) {
      if (o === c || (!o.sleeping && o.action?.type !== 'rest')) continue;
      if (Math.abs(o.x - c.x) < 1.6 && Math.abs(o.y - c.y) < 1.6) n++;
    }
    return Math.min(2, n) * 2;
  }

  // --- movement --------------------------------------------------------------

  moveSpeed(c: Character): number {
    const terr = terrainDef(this.index.terrainAt(c.x, c.y));
    const obj = this.index.objAt(c.x, c.y);
    const slow = obj ? (objectDef(obj.type).slow ?? 1) : 1;
    const load = loadRatio(c);
    const loadMul = load <= 1 ? 1 : load < 1.5 ? 1 - (load - 1) * 1.2 : 0.35;
    const snow = this.state.weather.snowDepth > 5 ? Math.max(0.6, 1 - this.state.weather.snowDepth / 80) : 1;
    const agi = 0.9 + c.attributes.agility * 0.02;
    const stam = c.needs.stamina < 5 ? 0.8 : 1;
    return WALK_SPEED * terr.speed * slow * loadMul * snow * agi * stam * statusMods(c).speed * (c.sprinting ? 1.55 : 1);
  }

  /** Move with axis-separated collision. Returns true if any movement happened. */
  moveCharacter(c: Character, dx: number, dy: number, dt: number, maxDist = Infinity): boolean {
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) {
      c.moving = false;
      return false;
    }
    dx /= len;
    dy /= len;
    const speed = this.moveSpeed(c);
    // never overshoot a waypoint
    const dist = Math.min(speed * dt, maxDist);
    const r = 0.28;
    let moved = false;
    const nx = c.x + dx * dist;
    if (!this.collides(nx, c.y, r)) {
      c.x = nx;
      moved = true;
    }
    const ny = c.y + dy * dist;
    if (!this.collides(c.x, ny, r)) {
      c.y = ny;
      moved = true;
    }
    c.facing = faceDir(dx, dy, c.facing);
    c.moving = moved;
    if (moved) {
      const t = this.index.terrainAt(c.x, c.y);
      if (t === T.MUD) c.needs.hygiene = Math.max(0, c.needs.hygiene - 0.05 * dt);
    }
    return moved;
  }

  collides(x: number, y: number, r: number): boolean {
    return (
      this.index.isSolid(x - r, y - r * 0.6) ||
      this.index.isSolid(x + r, y - r * 0.6) ||
      this.index.isSolid(x - r, y + r * 0.6) ||
      this.index.isSolid(x + r, y + r * 0.6)
    );
  }

  private updatePlayer(p: Character, dt: number): void {
    const { dx, dy, sprint } = this.input;
    const wants = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
    if (wants && p.sleeping) {
      this.wake(p, 'You get up.');
    }
    if (wants && p.action && p.action.type !== 'sleep') {
      p.action = undefined;
    }
    if (p.sleeping || p.action) {
      p.moving = false;
      return;
    }
    p.sprinting = sprint && p.needs.stamina > 3;
    this.moveCharacter(p, dx, dy, dt);
    const tile = Math.floor(p.y) * this.state.width + Math.floor(p.x);
    if (tile !== this.lastPlayerTile) {
      this.lastPlayerTile = tile;
      this.revealAround(p.x, p.y, this.sightRadius());
      p.lastSeen = { x: p.x, y: p.y, t: this.state.time };
    }
    if (p.moving && Math.floor(this.state.time * 3) !== Math.floor((this.state.time - dt) * 3)) {
      this.bus.emit('sound', { id: 'step', x: p.x, y: p.y });
    }
  }

  sightRadius(): number {
    const light = daylight(this.state.time);
    const w = this.state.weather;
    const lamp = this.player.equipment.hand && itemDef(this.player.equipment.hand.id).light && (this.player.equipment.hand.charge ?? 0) > 0 ? 3 : 0;
    return Math.round(clamp(4 + light * 8 * w.visibility + lamp, 4, 12));
  }

  revealAround(x: number, y: number, r: number): void {
    const s = this.state;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const r2 = r * r;
    for (let ty = cy - r; ty <= cy + r; ty++) {
      if (ty < 0 || ty >= s.height) continue;
      for (let tx = cx - r; tx <= cx + r; tx++) {
        if (tx < 0 || tx >= s.width) continue;
        if ((tx - cx) ** 2 + (ty - cy) ** 2 <= r2) s.explored[ty * s.width + tx] = 1;
      }
    }
    for (const b of s.buildings) {
      if (b.discovered) continue;
      const bx = b.x + b.w / 2;
      const by = b.y + b.h / 2;
      if (Math.hypot(bx - x, by - y) < r + 2) {
        b.discovered = true;
        this.journal(`Discovered: ${b.name}.`, 'discovery');
        this.bus.emit('discovered', { name: b.name });
      }
    }
  }

  // --- sleep -----------------------------------------------------------------

  sleepQuality(c: Character): number {
    const env = this.envAt(c.x, c.y);
    let q = 0.45;
    if (env.shelter) q += env.shelter.sleep;
    if (hasSleepingBag(c)) q += 0.2;
    q -= (c.needs.wetness / 100) * 0.3;
    const p = perceivedTemp({ ...c, sleeping: true } as Character, env);
    if (p < 14) q -= (14 - p) * 0.025;
    if (p > 30) q -= (p - 30) * 0.03;
    if (c.needs.satiety < 15) q -= 0.12;
    if (c.health.pain > 30) q -= c.health.pain * 0.003;
    if (env.rain > 0.2) q -= env.rain * 0.3;
    if (env.fireHeat > 2) q += 0.05;
    return clamp(q, 0.12, 1);
  }

  startSleep(c: Character): boolean {
    if (c.sleeping) return true;
    if (c.needs.energy > 85 && this.isPlayer(c)) {
      this.message('You are not tired enough to sleep.', 'info');
      return false;
    }
    c.sleeping = true;
    c.sleepStart = this.state.time;
    c.sleepQuality = this.sleepQuality(c);
    startAction(this, c, 'sleep', Infinity);
    if (this.isPlayer(c)) {
      const q = c.sleepQuality;
      this.message(q > 0.7 ? 'You settle in. This should be a decent night.' : q > 0.45 ? 'You lie down. Not comfortable, but it will do.' : 'You lie down. It is cold and hard; sleep will be poor.', 'info');
    }
    return true;
  }

  forceSleep(c: Character, reason: string): void {
    if (c.sleeping) return;
    c.action = undefined;
    c.sleeping = true;
    c.sleepStart = this.state.time;
    c.sleepQuality = this.sleepQuality(c) * 0.8;
    startAction(this, c, 'sleep', Infinity);
    if (this.isPlayer(c)) this.message(`You ${reason}.`, 'bad');
    else this.journal(`${c.name} ${reason}.`, 'event');
  }

  /** Called while sleeping: update quality and decide whether to wake. */
  updateSleep(c: Character): void {
    const n = c.needs;
    const t = this.state.time;
    if (Math.floor(t) % 20 === 0) c.sleepQuality = c.sleepQuality * 0.8 + this.sleepQuality(c) * 0.2;
    const h = hourOf(t);
    const { rise } = sunTimes(t);
    const slept = t - (c.sleepStart ?? t);
    let reason = '';
    if (n.energy >= 99) reason = 'You wake up fully rested.';
    else if (h >= rise - 0.5 && h < rise + 3 && n.energy >= 62 && slept > 180) reason = 'You wake with the first light.';
    // too exhausted to be woken by discomfort
    else if (n.hydration < 8 && n.energy > 20) reason = 'You wake up parched.';
    else if (n.bodyTemp < (this.isPlayer(c) ? 35.4 : 36) && n.energy > 15) reason = 'You wake up shivering. It is too cold to sleep.';
    else if (n.bladder > 96 && n.energy > 15) reason = 'You wake up needing the toilet.';
    else if (c.health.injuries.some((i) => i.bleeding > 0.25 && !i.bandaged)) reason = 'You wake to pain. The wound is bleeding.';
    else if (this.envAt(c.x, c.y).rain > 0.4 && n.wetness > 70 && n.energy > 25) reason = 'The rain soaks you awake.';
    else if (this.envAt(c.x, c.y).fireHeat > 20) reason = 'You wake up choking on smoke.';
    if (reason) this.wake(c, reason);
  }

  wake(c: Character, reason: string): void {
    if (!c.sleeping) return;
    c.sleeping = false;
    if (c.action?.type === 'sleep') c.action = undefined;
    const hours = (this.state.time - (c.sleepStart ?? this.state.time)) / 60;
    if (hours > 3) c.awakeMinutes = 0;
    if (this.isPlayer(c)) {
      const q = c.sleepQuality;
      const ql = q > 0.7 ? 'well' : q > 0.45 ? 'poorly' : 'badly';
      this.message(`${reason} (slept ${hours.toFixed(1)} h, ${ql})`, 'info');
      if (hours > 2) this.bus.emit('requestAutosave', { reason: 'sleep' });
      if (hours > 4) notePlayerDid(this, 'sleep');
    }
  }

  // --- toilet ----------------------------------------------------------------

  relieve(c: Character, mode: 'latrine' | 'open' | 'accident'): void {
    const n = c.needs;
    n.bladder = 0;
    if (mode === 'latrine') {
      const lat = this.index.nearestOfType('latrine', c.x, c.y, 2.5, (o) => o.build === undefined);
      if (lat) {
        lat.s = (lat.s ?? 0) + 1;
        if (lat.s > 70) {
          this.index.addContam(lat.x, lat.y, 0.03);
          this.charMessage(c, 'The latrine is full. Dig a new one.', 'warn');
        } else this.index.addContam(lat.x, lat.y, 0.003);
      }
      n.hygiene = Math.max(0, n.hygiene - 2);
      this.charMessage(c, 'You use the latrine.', 'info');
    } else if (mode === 'open') {
      this.index.addContam(c.x, c.y, 0.035);
      n.hygiene = Math.max(0, n.hygiene - 5);
      this.charMessage(c, 'You find a spot behind a tree. Without a latrine, waste spreads around camp.', 'info');
    } else {
      this.index.addContam(c.x, c.y, 0.02);
      n.hygiene = Math.max(0, n.hygiene - 35);
      n.morale = Math.max(0, n.morale - 12);
      n.wetness = Math.min(100, n.wetness + 15);
      if (this.isPlayer(c)) this.message('You could not hold it any longer. You need to wash.', 'bad');
      else c.memories.push({ kind: 'campEvent', day: dayOf(this.state.time), weight: -4, text: 'had an embarrassing accident' });
    }
  }

  private decayContamination(dt: number): void {
    const cont = this.state.contamination;
    const rainWash = this.state.weather.precipitation * 0.004;
    for (let i = 0; i < cont.length; i++) if (cont[i] > 0) cont[i] = Math.max(0, cont[i] - (0.003 + rainWash) * (dt / 60));
  }

  // --- morale ----------------------------------------------------------------

  /** Where a character's morale drifts toward, from their circumstances. */
  moraleTarget(c: Character, env: LocalEnv): number {
    let m = 50;
    const n = c.needs;
    m += (n.satiety - 50) * 0.15;
    m += (n.hydration - 50) * 0.1;
    m += (n.energy - 50) * 0.1;
    m -= n.stress * 0.2;
    m -= c.health.pain * 0.15;
    if (env.fireHeat > 3) m += 6;
    if (env.shelter) m += 4;
    if (n.bodyTemp < 36) m -= 10;
    if (n.wetness > 50) m -= 6;
    m += this.campComfort();
    m += this.social.friendsNearby(c) * 2.5;
    let memo = 0;
    for (const mem of c.memories) memo += clamp(mem.weight * 0.15, -12, 8);
    m += clamp(memo, -22, 12);
    const w = this.state.weather.current;
    if (w === 'clear') m += 3;
    if (w === 'heavyRain' || w === 'thunderstorm') m -= 4;
    return clamp(m, 0, 100);
  }

  private campCache = { t: -999, v: 0 };
  campComfort(): number {
    if (this.state.time - this.campCache.t < 30) return this.campCache.v;
    const h = this.home;
    let v = 0;
    const has = (t: string) => !!this.index.nearestOfType(t, h.x, h.y, 22, (o) => o.build === undefined);
    if (has('campfire') || has('fire_pit')) v += 3;
    if (has('lean_to') || has('tarp_shelter')) v += 3;
    if (has('latrine')) v += 2;
    if (has('storage_cache') || has('wooden_crate')) v += 1;
    const days = this.campFoodDays();
    v += clamp((days - 1) * 3, -8, 8);
    this.campCache = { t: this.state.time, v };
    return v;
  }

  /** Days of food stored at camp plus carried, per living person. */
  campFoodDays(): number {
    const h = this.home;
    let kcal = 0;
    this.index.objectsNear(h.x, h.y, 22, (o) => {
      if (o.inv && o.type !== 'corpse') kcal += totalKcal(o.inv);
    });
    const living = this.livingCharacters();
    for (const c of living) kcal += totalKcal(c.inventory);
    return kcal / Math.max(1, living.length) / 1800;
  }

  campWaterLitres(): number {
    const h = this.home;
    let ml = 0;
    this.index.objectsNear(h.x, h.y, 22, (o) => {
      if (o.inv) ml += liquidTotal(o.inv, 0.05);
      if (o.water) ml += o.water.ml;
    });
    return ml / 1000;
  }

  // --- injuries, illness, death ------------------------------------------------

  onInjury(c: Character, inj: Injury, why: string): void {
    const labels: Record<string, string> = { cut: 'a cut', bruise: 'a bruise', sprain: 'a sprain', burn: 'a burn', animalWound: 'a wound' };
    if (this.isPlayer(c)) this.message(`You suffer ${labels[inj.type]} from ${why}.${inj.bleeding > 0.1 ? ' It is bleeding.' : ''}`, 'bad');
    else {
      this.journal(`${c.name} was injured (${labels[inj.type]} from ${why}).`, 'danger');
      this.say(c, inj.severity > 0.4 ? 'Ah! I need help with this.' : 'Ow. I will be fine.');
    }
    c.memories.push({ kind: 'campEvent', day: dayOf(this.state.time), weight: -inj.severity * 15, text: `was hurt by ${why}` });
  }

  onIllness(c: Character, ill: Illness, why?: string): void {
    const names: Record<string, string> = { stomachBug: 'a stomach illness', foodPoisoning: 'food poisoning', cold: 'a head cold', hypothermia: 'hypothermia', infectionFever: 'an infection fever' };
    if (this.isPlayer(c)) this.message(`You feel ill: ${names[ill.type]}${why ? ` (probably ${why})` : ''}.`, 'bad');
    else this.journal(`${c.name} has ${names[ill.type]}${why ? `, probably from ${why}` : ''}.`, 'event');
  }

  killCharacter(c: Character, cause: string): void {
    if (!c.alive) return;
    if (this.settings.godMode && this.isPlayer(c)) {
      c.health.hp = 20;
      return;
    }
    c.alive = false;
    c.sleeping = false;
    c.action = undefined;
    c.death = { day: dayOf(this.state.time), cause, x: c.x, y: c.y };
    this.state.stats.deaths++;
    // the body remains with everything they carried
    const inv = [...c.inventory, ...Object.values(c.equipment)].filter(Boolean).map((s) => ({ ...s! }));
    const slots = new Array(24).fill(null);
    inv.slice(0, 24).forEach((s, i) => (slots[i] = s));
    const spot = this.index.findTileNear(c.x, c.y, 5, (tx, ty) => this.index.isFree(tx, ty)) ?? [Math.floor(c.x), Math.floor(c.y)];
    this.index.addObject({ type: 'corpse', x: spot[0], y: spot[1], inv: slots, label: c.name });
    c.inventory = c.inventory.map(() => null);
    c.equipment = {};
    this.journal(`${c.name} died of ${cause}.`, 'death');
    this.social.onDeath(c);
    for (const e of this.state.expeditions) if (e.members.includes(c.id) && e.status !== 'returned') e.log.push(`${c.name} did not survive.`);
    if (this.isPlayer(c)) this.bus.emit('playerDied', { id: c.id, cause });
  }

  /** Continue the world as another surviving classmate. */
  switchPlayer(id: string): boolean {
    const c = this.state.characters[id];
    if (!c || !c.alive) return false;
    this.state.playerId = id;
    c.action = undefined;
    c.ai.order = 'none';
    c.ai.task = 'idle';
    c.ai.path = undefined;
    c.ai.expeditionId = undefined;
    for (const e of this.state.expeditions) if (e.members.includes(id)) e.members = e.members.filter((m) => m !== id);
    this.journal(`You continue as ${c.name}.`, 'event');
    this.revealAround(c.x, c.y, 10);
    return true;
  }

  // --- construction ------------------------------------------------------------

  completeConstruction(o: WorldObject, by?: Character): void {
    o.build = undefined;
    this.index.sites.delete(o.id);
    const d = objectDef(o.type);
    if (d.fire) {
      o.s = o.s ?? 0;
      o.lit = false;
    }
    if (o.type === 'rain_collector') o.water = { ml: 0, contam: 0.03 };
    if (d.container && !o.inv) o.inv = new Array(d.container).fill(null);
    if (o.type === 'latrine') o.s = 0;
    if (o.type === 'garden_plot') o.s = 1;
    this.index.refreshObject(o);
    this.state.stats.structuresBuilt++;
    if (finalizeTerrainStructure(this, o)) {
      this.journal(`${by ? by.name + ' finished' : 'Finished'} building: ${d.name}.`, 'camp');
      return;
    }
    this.journal(`${by ? by.name + ' finished' : 'Finished'} building: ${d.name}.`, 'camp');
    this.bus.emit('sound', { id: 'buildDone', x: o.x, y: o.y });
    this.campCache.t = -999;
  }

  // --- orders --------------------------------------------------------------------

  setOrder(ids: string[], order: OrderId): void {
    const p = this.player;
    for (const id of ids) {
      const c = this.state.characters[id];
      if (!c || !c.alive || this.isPlayer(c)) continue;
      if (c.ai.expeditionId !== undefined && order !== 'returnCamp') continue;
      c.ai.order = order;
      c.ai.orderX = order === 'stay' ? c.x : order === 'watchCamp' ? this.home.x : p.x;
      c.ai.orderY = order === 'stay' ? c.y : order === 'watchCamp' ? this.home.y : p.y;
      c.ai.nextThink = this.state.time;
      c.ai.path = undefined;
      if (c.action && c.action.type !== 'sleep') c.action = undefined;
    }
  }

  setHomePin(x: number, y: number): void {
    const had = !!this.state.homePin;
    this.state.homePin = { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5 };
    this.state.markers = this.state.markers.filter((m) => m.kind !== 'home');
    this.state.markers.push({ id: this.state.nextId++, kind: 'home', x: this.state.homePin.x, y: this.state.homePin.y, label: 'Home' });
    this.journal(had ? 'The camp was moved. The group will relocate.' : 'The group decided to make camp here.', 'camp');
    for (const c of this.npcs()) {
      c.ai.nextThink = this.state.time + this.rng.range(0, 10);
      if (c.ai.order === 'stay' || c.ai.order === 'none') c.ai.order = 'none';
    }
    this.campCache.t = -999;
  }

  /** Fish living in a water body scale with its size. */
  fishCapacity(key: string): number {
    const size = this.index.waterSize.get(Number(key)) ?? 40;
    return Math.round(clamp(size / 5, 6, 220));
  }

  fishStock(key: string): number {
    if (this.state.fishStock[key] === undefined) this.state.fishStock[key] = this.fishCapacity(key);
    return this.state.fishStock[key];
  }

  private onNewDay(day: number): void {
    this.state.stats.daysSurvived = day - dayOf(this.state.startTime ?? 0);
    const s = season(this.state.time);
    if (((day - 1) % 14) === 0) this.journal(`${s.name} has begun.`, 'event');
    this.bus.emit('requestAutosave', { reason: 'new day' });
    for (const c of this.livingCharacters()) {
      // memories fade over time
      for (const m of c.memories) m.weight *= 0.93;
      c.memories = c.memories.filter((m) => Math.abs(m.weight) > 1.5).slice(-30);
    }
  }

  /** Start a character's return report when reaching home. */
  arrivedHome(c: Character): void {
    onNpcArrivedHome(this, c);
  }

  /** Hurts a character by an animal or accident. */
  injure(c: Character, type: Parameters<typeof addInjury>[2], sev: number, why: string): void {
    addInjury(this, c, type, sev, why);
  }

  minutesUntilSunrise(): number {
    const t = this.state.time;
    const { rise } = sunTimes(t);
    let h = rise - hourOf(t);
    if (h < 0) h += 24;
    return h * 60;
  }

  get dayLength(): number {
    return MIN_PER_DAY;
  }
}

export function faceDir(dx: number, dy: number, prev: Dir): Dir {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return prev;
  if (Math.abs(dx) > Math.abs(dy) * 1.05) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
