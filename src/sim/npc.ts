import { itemDef } from '@/content/items';
import { objectDef } from '@/content/objects';
import { isWater } from '@/content/terrain';
import { clamp } from '@/core/math';
import type { Character, Expedition, ItemStack, OrderId, WorldObject } from './types';
import type { Game } from './game';
import { findPath } from './pathfinding';
import {
  addItem,
  bestTool,
  cleanestWater,
  countItem,
  foodStacks,
  loadRatio,
  pourInto,
  removeItem,
  slotsWeight,
  liquidTotal,
} from './inventory';
import {
  ACTIONS,
  eatStack,
  gatherLabel,
  gatherMinutes,
  lightFire,
  startAction,
  treatWounds,
  workSpeed,
} from './actions';
import { RECIPES, recipeById } from '@/content/recipes';
import { daylight, formatClock, hourOf, isNight, season } from './clock';
import { ensureLoot } from './loot';
import { FIRE_TYPES, SHELTER_TYPES } from './environment';
import { attackAnimal } from './wildlife';

export const STORAGE_TYPES = ['storage_cache', 'wooden_crate', 'supply_bag'];
const CAMP_RADIUS = 22;

type TaskId =
  | 'idle'
  | 'sleep'
  | 'drink'
  | 'eat'
  | 'toilet'
  | 'warm'
  | 'shelter'
  | 'flee'
  | 'treat'
  | 'wash'
  | 'gatherWood'
  | 'gatherFood'
  | 'gatherWater'
  | 'build'
  | 'cook'
  | 'tendFire'
  | 'fish'
  | 'hunt'
  | 'socialise'
  | 'follow'
  | 'stay'
  | 'goHome'
  | 'expedition'
  | 'deposit'
  | 'makeFire'
  | 'purify'
  | 'buildShelter'
  | 'buildLatrine';

const TASK_LABEL: Record<TaskId, string> = {
  idle: 'Resting', sleep: 'Sleeping', drink: 'Getting water to drink', eat: 'Getting something to eat', toilet: 'Going to the toilet',
  warm: 'Warming up', shelter: 'Seeking shelter', flee: 'Getting away from danger', treat: 'Treating a wound', wash: 'Washing',
  gatherWood: 'Gathering firewood', gatherFood: 'Foraging', gatherWater: 'Fetching water', build: 'Building', cook: 'Cooking',
  tendFire: 'Tending the fire', fish: 'Fishing', hunt: 'Hunting', socialise: 'Sitting with the others', follow: 'Following you',
  stay: 'Waiting here', goHome: 'Returning to camp', expedition: 'On an expedition', deposit: 'Storing supplies',
  makeFire: 'Making a fire', purify: 'Boiling water', buildShelter: 'Building a shelter', buildLatrine: 'Digging a latrine',
};

/** Remember that a task just finished or could not proceed. */
function markDone(game: Game, c: Character, task: string): void {
  (c.ai.recent ??= {})[task] = game.state.time;
}

/** The task cannot be done at all right now: stop considering it for a while. */
function markBlocked(game: Game, c: Character, task: string, minutes = 60): void {
  (c.ai.blocked ??= {})[task] = game.state.time + minutes;
  c.ai.nextThink = game.state.time + 0.5;
}

function shelterCapacity(game: Game): number {
  const h = game.home;
  let cap = 0;
  for (const t of ['lean_to', 'tarp_shelter', 'bough_bed', 'bed']) {
    const set = game.index.byType.get(t);
    if (!set) continue;
    for (const id of set) {
      const o = game.state.objects[id];
      if (o && Math.hypot(o.x - h.x, o.y - h.y) < CAMP_RADIUS) cap += objectDef(o.type).shelter?.capacity ?? 1;
    }
  }
  return cap;
}

function campHasDirtyWater(game: Game): boolean {
  return !!findInCamp(game, (s) => !!s.liquid && s.liquid.ml > 200 && s.liquid.contam > 0.05);
}

function potAvailable(game: Game, c: Character): boolean {
  return !!bestTool(c, 'boil') || !!findInCamp(game, (s) => itemDef(s.id).tool?.tags.includes('boil') === true);
}

// --- movement --------------------------------------------------------------

export function goTo(game: Game, c: Character, x: number, y: number, near: boolean, repath = false): void {
  if (!repath) c.ai.stuck = 0;
  c.ai.targetX = x;
  c.ai.targetY = y;
  if (near) {
    const path = findPath(game.index, c.x, c.y, x, y, 5000);
    // an empty path means "no route found": steer directly and let the stuck
    // detector give up soon, instead of searching again every tick
    c.ai.path = path ?? [];
    if (!path) {
      c.ai.stuck = Math.max(c.ai.stuck, 3);
      if (!findPath(game.index, c.x, c.y, game.home.x, game.home.y, 8000)) unstick(game, c);
    }
  } else c.ai.path = undefined;
  c.ai.pathIndex = 0;
}

/**
 * Safety net: a character boxed in by trees (for example after travelling
 * abstractly while far from the player) squeezes out to open ground.
 */
function unstick(game: Game, c: Character): void {
  const h = game.home;
  for (let r = 1; r <= 8; r++) {
    const spot = game.index.findTileNear(c.x, c.y, r, (x, y) => !game.index.isSolid(x, y) && Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) >= r - 0.5 && !!findPath(game.index, x, y, h.x, h.y, 3000));
    if (spot) {
      game.warn('npc', `${c.name} was boxed in and squeezed out to ${spot[0]},${spot[1]}`);
      c.x = spot[0] + 0.5;
      c.y = spot[1] + 0.5;
      c.ai.path = undefined;
      return;
    }
  }
}

function arrived(c: Character, x: number, y: number, r = 1.3): boolean {
  return Math.hypot(c.x - x, c.y - y) <= r;
}

/** Per-step NPC movement. Near NPCs collide with the world; far ones travel abstractly. */
export function updateNpc(game: Game, c: Character, dt: number, near: boolean): void {
  if (c.sleeping || c.action) {
    c.moving = false;
    return;
  }
  const tx = c.ai.targetX;
  const ty = c.ai.targetY;
  if (tx === undefined || ty === undefined) {
    c.moving = false;
    return;
  }
  if (arrived(c, tx, ty, 0.9)) {
    c.moving = false;
    c.ai.targetX = undefined;
    c.ai.targetY = undefined;
    c.ai.path = undefined;
    c.ai.nextThink = Math.min(c.ai.nextThink, game.state.time);
    return;
  }
  // wake from abstraction: repath if we just came near the player
  if (near && !c.ai.path && game.collides(c.x, c.y, 0.2)) {
    const spot = game.index.findTileNear(c.x, c.y, 6, (x, y) => !game.index.isSolid(x, y));
    if (spot) {
      c.x = spot[0] + 0.5;
      c.y = spot[1] + 0.5;
    }
  }
  if (near && !c.ai.path) goTo(game, c, tx, ty, true, true);
  let wx = tx;
  let wy = ty;
  const path = c.ai.path;
  if (path && path.length) {
    let i = c.ai.pathIndex ?? 0;
    while (i < path.length) {
      const nx = (path[i] % game.index.w) + 0.5;
      const ny = Math.floor(path[i] / game.index.w) + 0.5;
      if (Math.hypot(c.x - nx, c.y - ny) < 0.35) i++;
      else break;
    }
    c.ai.pathIndex = i;
    if (i < path.length) {
      wx = (path[i] % game.index.w) + 0.5;
      wy = Math.floor(path[i] / game.index.w) + 0.5;
    }
  }
  c.sprinting = c.ai.task === 'flee';
  if (near) {
    const moved = game.moveCharacter(c, wx - c.x, wy - c.y, dt, Math.hypot(wx - c.x, wy - c.y));
    if (!moved) {
      c.ai.stuck += dt;
      if (c.ai.stuck > 1.5) {
        c.ai.path = undefined;
        if (c.ai.stuck > 5) {
          // give up on this target and on the task for a while: it is unreachable
          c.ai.targetX = undefined;
          c.ai.targetY = undefined;
          markBlocked(game, c, c.ai.task, 30);
          c.ai.nextThink = game.state.time;
          c.ai.stuck = 0;
        }
      }
    } else c.ai.stuck = Math.max(0, c.ai.stuck - dt);
  } else {
    // abstract travel: straight line at walking pace
    const d = Math.hypot(wx - c.x, wy - c.y);
    // abstract pace: terrain is ignored so off-screen travellers never freeze on an impassable tile
    const step = Math.min(d, Math.max(2.5, game.moveSpeed(c)) * 0.9 * dt);
    if (d > 0) {
      const dx = (wx - c.x) / d;
      const dy = (wy - c.y) / d;
      c.x = clamp(c.x + dx * step, 1, game.state.width - 2);
      c.y = clamp(c.y + dy * step, 1, game.state.height - 2);
      c.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    }
    c.moving = true;
    // record explored area for later reporting
    const key = Math.floor(c.y / 6) * 1000 + Math.floor(c.x / 6);
    if (c.pendingExplored[c.pendingExplored.length - 1] !== key && c.pendingExplored.length < 400) c.pendingExplored.push(key);
  }
  // keep track of where the player last saw them
  const p = game.player;
  if (p && Math.hypot(p.x - c.x, p.y - c.y) < game.sightRadius() + 2) c.lastSeen = { x: c.x, y: c.y, t: game.state.time };
}

// --- helpers -----------------------------------------------------------------

function campContainers(game: Game): WorldObject[] {
  const h = game.home;
  const out: WorldObject[] = [];
  for (const t of STORAGE_TYPES) {
    const set = game.index.byType.get(t);
    if (!set) continue;
    for (const id of set) {
      const o = game.state.objects[id];
      if (o && o.build === undefined && o.inv && Math.hypot(o.x - h.x, o.y - h.y) < CAMP_RADIUS) out.push(o);
    }
  }
  return out;
}

function campFire(game: Game, litOnly = false): WorldObject | undefined {
  const h = game.home;
  return game.index.nearestOfType(['fire_pit', 'campfire'], h.x, h.y, CAMP_RADIUS, (o) => o.build === undefined && (!litOnly || !!o.lit));
}

function findInCamp(game: Game, pred: (s: ItemStack) => boolean): { o: WorldObject; slot: number } | undefined {
  for (const o of campContainers(game)) {
    const i = o.inv!.findIndex((s) => !!s && pred(s));
    if (i >= 0) return { o, slot: i };
  }
  return undefined;
}

function speak(game: Game, c: Character, lines: string[], chance = 0.35): void {
  if (game.state.time - (c.ai.lastSpeech ?? -999) < 45) return;
  if (!game.rng.chance(chance)) return;
  game.say(c, game.rng.pick(lines));
}

function setTask(c: Character, t: TaskId): void {
  c.ai.task = t;
  c.ai.taskLabel = TASK_LABEL[t];
}

function wantsSleep(game: Game, c: Character): boolean {
  const e = c.needs.energy;
  const h = hourOf(game.state.time);
  const night = isNight(game.state.time) && (h > 20 || h < 5);
  return e < 18 || (night && e < 75) || (h >= 22 && e < 85);
}

/** Dangerous surroundings: fire or an angry animal nearby. */
function danger(game: Game, c: Character): { x: number; y: number } | undefined {
  for (const id of game.burning) {
    const o = game.state.objects[id];
    if (o && Math.hypot(o.x - c.x, o.y - c.y) < 4) return { x: o.x, y: o.y };
  }
  for (const a of Object.values(game.state.animals)) {
    if (a.state === 'charge' && Math.hypot(a.x - c.x, a.y - c.y) < 6) return { x: a.x, y: a.y };
  }
  return undefined;
}

// --- decision making -------------------------------------------------------------

interface Option {
  task: TaskId;
  score: number;
}

/**
 * Priority-based utility decision. Survival needs dominate; orders from the
 * player raise the priority of work but never override self-preservation.
 */
export function npcThink(game: Game, c: Character): void {
  if (c.action) {
    c.ai.nextThink = game.state.time + 0.5;
    return;
  }
  const n = c.needs;
  const t = game.state.time;
  const opts: Option[] = [];
  const recent = (c.ai.recent ??= {});
  // tasks that recently failed or finished lose appeal for a while (prevents loops)
  const blocked = (c.ai.blocked ??= {});
  const add = (task: TaskId, score: number) => {
    if ((blocked[task] ?? 0) > t) return;
    const cool = recent[task] !== undefined && t - recent[task] < 90 ? 30 : 0;
    opts.push({ task, score: score + (c.ai.task === task ? 6 : 0) - cool });
  };
  const order = c.ai.order;
  const exp = c.ai.expeditionId !== undefined ? game.state.expeditions.find((e) => e.id === c.ai.expeditionId) : undefined;

  // survival needs are scored far above any work so they always win when pressing
  const dz = danger(game, c);
  if (dz) add('flee', 300);
  if (c.health.injuries.some((i) => i.bleeding > 0.1 && !i.bandaged) && (countItem(c.inventory, 'bandage') > 0 || findInCamp(game, (s) => s.id === 'bandage'))) add('treat', 150);
  if (n.hydration < 50) add('drink', (50 - n.hydration) * 4 + (n.hydration < 20 ? 80 : 0));
  // when stores run low, people ration: they eat later and rely on reserves
  const scarce = game.campFoodDays() < 1.2;
  const rations = scarce && (c.traits.includes('practical') || c.traits.includes('compassionate') || n.reserves > 50);
  const eatAt = rations ? 12 : 32;
  if (n.satiety < eatAt) add('eat', (eatAt + 8 - n.satiety) * 3 + (n.reserves < 30 ? 50 : 0));
  if (n.bladder > 65) add('toilet', (n.bladder - 65) * 4 + 30);
  const cold = n.bodyTemp < 36.5 || (n.wetness > 50 && game.state.weather.temp < 14);
  if (cold) add('warm', Math.min(230, (36.9 - n.bodyTemp) * 90 + n.wetness * 0.4 + 40));
  const env = game.envAt(c.x, c.y);
  if (env.rain > 0.45 && !env.shelter && !env.indoor) add('shelter', 55 + (c.traits.includes('cautious') ? 15 : 0));
  if (wantsSleep(game, c)) {
    // dry off by the fire before lying down soaked
    const dryFirst = n.wetness > 45 && n.energy > 12 && !!campFire(game, true);
    add('sleep', (100 - n.energy) * 1.1 + (isNight(t) ? 45 : 0) - (dryFirst ? 70 : 0));
    if (dryFirst) add('warm', 120);
  }
  if (n.hygiene < 35 && daylight(t) > 0.5 && game.state.weather.temp > 6) add('wash', 18 + (35 - n.hygiene) * 1.2);
  // with no fire at camp, someone practical will make one when it gets dark or cold
  if (!campFire(game) && (daylight(t) < 0.6 || game.state.weather.temp < 8 || cold)) {
    add('makeFire', 30 + c.skills.survival * 4 + (c.traits.includes('practical') ? 10 : 0) + (cold ? 30 : 0));
  }
  if (campHasDirtyWater(game) && campFire(game, true) && potAvailable(game, c)) add('purify', 24 + (c.traits.includes('practical') ? 6 : 0));

  if (exp && exp.status !== 'returned') {
    add('expedition', 70);
  } else {
    const refused = (c.ai.refusedUntil ?? 0) > t;
    const obey = refused ? 0.3 : 1;
    const orderTask: Partial<Record<OrderId, TaskId>> = {
      follow: 'follow', stay: 'stay', gatherWood: 'gatherWood', gatherFood: 'gatherFood', gatherWater: 'gatherWater',
      build: 'build', cook: 'cook', fish: 'fish', hunt: 'hunt', explore: 'expedition', watchCamp: 'tendFire', rest: 'socialise', returnCamp: 'goHome',
    };
    const ot = orderTask[order];
    if (ot) {
      if (checkRefusal(game, c, order)) c.ai.refusedUntil = t + 120;
      else add(ot, 55 * obey);
    }
    // autonomous work driven by camp needs, skills and personality
    const hw = c.traits.includes('hardworking') ? 8 : c.traits.includes('lazy') ? -8 : 0;
    const h = game.home;
    const daytime = daylight(t) > 0.35;
    if (daytime) {
      const woodNeed = campWoodScore(game);
      add('gatherWood', 14 + woodNeed + hw + c.skills.survival);
      const foodDays = game.campFoodDays();
      add('gatherFood', 10 + clamp((2 - foodDays) * 10, 0, 25) + c.skills.foraging * 1.5 + hw + (game.state.time % 1440 > 1080 ? -10 : 0));
      const canFish = bestTool(c, 'fish') || findInCamp(game, (s) => s.id === 'fishing_rod' || s.id === 'fishing_hooks') || countItem(c.inventory, 'fishing_hooks') > 0;
      if (canFish) add('fish', 10 + clamp((2 - foodDays) * 10, 0, 25) + c.skills.fishing * 2.5 + hw);
      const hunter = c.traits.includes('brave') || c.traits.includes('riskTaking') || c.skills.hunting >= 3;
      if (hunter && foodDays < 2) add('hunt', 6 + c.skills.hunting * 3 + clamp((1.5 - foodDays) * 8, 0, 12));
      const water = game.campWaterLitres();
      const living = game.livingCharacters().length;
      add('gatherWater', 8 + clamp((living * 1.2 - water) * 1.2, 0, 18) + hw);
      if (constructionSite(game)) add('build', 20 + c.skills.construction * 2 + hw);
      // basic camp infrastructure the group builds on its own once a camp is chosen
      if (game.state.homePin) {
        const cap = shelterCapacity(game);
        const living = game.livingCharacters().length;
        if (cap < living * 0.5) add('buildShelter', 16 + c.skills.construction * 2 + hw + (living * 0.5 - cap) * 1.5 + (cap === 0 ? 20 : 0));
        if (!game.index.nearestOfType('latrine', h.x, h.y, CAMP_RADIUS + 6)) add('buildLatrine', 14 + (c.traits.includes('practical') ? 10 : 0) + hw);
      }
      if (hasRawFood(game, c) && campFire(game)) add('cook', 18 + c.skills.cooking * 2 + clamp((1 - foodDays) * 15, 0, 15));
      if (!exp && canStartExpedition(game, c)) add('expedition', 12 + (c.traits.includes('curious') ? 12 : 0) + (c.traits.includes('brave') ? 6 : 0));
    }
    const fire = campFire(game);
    // bank the fire before night so it lasts
    const evening = hourOf(t) >= 18 || hourOf(t) < 5;
    const fuel = fire?.s ?? 0;
    if (fire && ((fire.lit && fuel < (evening ? 180 : 60)) || (!fire.lit && (daylight(t) < 0.5 || game.state.weather.temp < 10)))) {
      add('tendFire', 22 + (order === 'watchCamp' ? 20 : 0) + (evening ? 25 : 0) + (c.traits.includes('practical') ? 5 : 0));
    }
    add('socialise', 10 + (c.traits.includes('social') ? 8 : 0) + (daytime ? 0 : 15) + (c.traits.includes('lazy') ? 8 : 0));
    if (Math.hypot(c.x - game.home.x, c.y - game.home.y) > CAMP_RADIUS && order !== 'follow' && order !== 'stay') add('goHome', 25);
    if (carryingSupplies(c)) add('deposit', 15 + slotsWeight(c.inventory) * 1.5);
  }

  // small randomness keeps the group from moving in lockstep
  for (const o of opts) o.score += game.rng.range(0, 4);
  opts.sort((a, b) => b.score - a.score);
  const best = opts[0]?.task ?? 'idle';
  const prev = c.ai.task;
  setTask(c, best);
  if (prev !== best) onTaskStart(game, c, best);
  try {
    runTask(game, c, best);
  } catch (e) {
    game.warn('npc', `${c.id} task ${best} failed: ${(e as Error).message}`);
    c.ai.nextThink = t + 5;
  }
}

function checkRefusal(game: Game, c: Character, order: OrderId): boolean {
  if ((c.ai.refusedUntil ?? 0) > game.state.time) return false;
  const n = c.needs;
  const w = game.state.weather.current;
  const exhausted = n.energy < 15 || c.health.hp < 35;
  const storm = w === 'thunderstorm' || w === 'heavyRain' || w === 'snow';
  const risky = order === 'explore' || order === 'hunt';
  let refuse = '';
  if (exhausted && order !== 'rest' && order !== 'returnCamp' && order !== 'follow') refuse = 'Not now. I can barely stand.';
  else if (risky && (storm || isNight(game.state.time)) && !c.traits.includes('riskTaking')) refuse = 'In this? No. Let us wait until it is safer.';
  else if (risky && c.health.injuries.some((i) => i.severity > 0.4)) refuse = 'Not with this injury.';
  else if (c.traits.includes('independent') && game.social.opinionOfPlayer(c).trust < 25 && game.rng.chance(0.5)) refuse = 'I will decide that myself.';
  if (refuse) {
    game.say(c, refuse);
    game.social.adjust(c.id, game.state.playerId, -0.5);
    return true;
  }
  return false;
}

function onTaskStart(game: Game, c: Character, t: TaskId): void {
  const lines: Partial<Record<TaskId, string[]>> = {
    gatherWood: ['I will get some wood.', 'Going for firewood.'],
    gatherWater: ['I will fetch water.', 'We need water. I will go.'],
    gatherFood: ['I will look for something to eat out there.', 'Going foraging.'],
    fish: ['I will try the water. Maybe the fish are biting.'],
    warm: ['I am freezing.', 'I need to get warm.', 'So cold...'],
    sleep: ['I need to sleep.', 'Good night.'],
    drink: ['I need a drink.'],
    eat: ['I am starving.', 'I need to eat something.'],
    shelter: ['Get out of the rain!', 'Under cover, quick.'],
    tendFire: ['The fire needs looking after.'],
    build: ['I will help with the building.'],
    cook: ['I will cook something.'],
    flee: ['Get back!', 'Watch out!'],
  };
  const l = lines[t];
  if (l) speak(game, c, l, 0.45);
}

// --- task execution ---------------------------------------------------------------

function think(game: Game, c: Character, minutes: number): void {
  c.ai.nextThink = game.state.time + minutes;
}

function moveOrAct(game: Game, c: Character, x: number, y: number, r: number, act: () => void): void {
  const near = Math.hypot(c.x - game.player.x, c.y - game.player.y) < 42;
  if (arrived(c, x, y, r)) {
    act();
    think(game, c, 0.5);
  } else {
    if (c.ai.targetX !== x || c.ai.targetY !== y) goTo(game, c, x, y, near);
    think(game, c, near ? 2 : 6);
  }
}

function runTask(game: Game, c: Character, task: TaskId): void {
  const h = game.home;
  switch (task) {
    case 'flee': {
      const d = danger(game, c);
      if (!d) return think(game, c, 0.5);
      const ang = Math.atan2(c.y - d.y, c.x - d.x);
      goTo(game, c, c.x + Math.cos(ang) * 8, c.y + Math.sin(ang) * 8, true);
      return think(game, c, 1);
    }
    case 'treat': {
      if (countItem(c.inventory, 'bandage') > 0) {
        startAction(game, c, 'treat', 4 / workSpeed(c, 'firstAid'), { data: { patient: c.id } });
        return think(game, c, 1);
      }
      const f = findInCamp(game, (s) => s.id === 'bandage');
      if (f) return moveOrAct(game, c, f.o.x + 0.5, f.o.y + 0.5, 1.6, () => takeFrom(c, f.o, 'bandage', 1));
      return think(game, c, 3);
    }
    case 'drink':
      return doDrink(game, c);
    case 'eat':
      return doEat(game, c);
    case 'toilet': {
      const lat = game.index.nearestOfType('latrine', c.x, c.y, 35, (o) => o.build === undefined && (o.s ?? 0) < 70);
      if (lat) return moveOrAct(game, c, lat.x + 0.5, lat.y + 0.5, 1.2, () => startAction(game, c, 'relieve', 3, { targetId: lat.id }));
      // step away from camp
      if (Math.hypot(c.x - h.x, c.y - h.y) < 8) {
        const a = game.rng.range(0, Math.PI * 2);
        return moveOrAct(game, c, h.x + Math.cos(a) * 11, h.y + Math.sin(a) * 11, 1.5, () => startAction(game, c, 'relieve', 3));
      }
      startAction(game, c, 'relieve', 3);
      return think(game, c, 1);
    }
    case 'warm': {
      const env = game.envAt(c.x, c.y);
      if (env.rain > 0.4 && !env.shelter && !env.indoor && shelterNear(game, c)) return runTask(game, c, 'shelter');
      const fire = game.index.nearestOfType(FIRE_TYPES, c.x, c.y, 45, (o) => o.build === undefined);
      if (!fire) return doMakeFire(game, c);
      // a dead fire and nothing to burn: collect deadfall first, then go to the fire
      const carrying = countItem(c.inventory, 'branch') + countItem(c.inventory, 'firewood') + countItem(c.inventory, 'log');
      if (!fire.lit && (fire.s ?? 0) < 20 && carrying === 0 && !findInCamp(game, (s) => s.id === 'branch' || s.id === 'firewood')) {
        const df = game.index.nearestObjectRing(fire.x, fire.y, 20, (o) => o.type === 'deadfall');
        if (df) return moveOrAct(game, c, df.x + 0.5, df.y + 0.5, 1.3, () => startAction(game, c, 'gather', gatherMinutes('deadfall') / workSpeed(c), { targetId: df.id }));
        return runTask(game, c, 'shelter');
      }
      return moveOrAct(game, c, fire.x + 0.5, fire.y + 1.6, 2.2, () => {
        if ((fire.s ?? 0) < 50 && feedFire(game, c, fire)) return;
        if ((fire.s ?? 0) <= 0) return runTask(game, c, 'shelter');
        if (!fire.lit && fetchIgniter(game, c, fire)) {
          lightFire(game, c, fire);
          if (!fire.lit) return think(game, c, 1);
        }
        startAction(game, c, 'rest', fire.lit ? 20 : 5);
      });
    }
    case 'shelter': {
      const sh = game.index.nearestOfType(SHELTER_TYPES, c.x, c.y, 45, (o) => o.build === undefined);
      const b = nearestBuilding(game, c, 45);
      const target = sh ? { x: sh.x + 1, y: sh.y + 1 } : b ? { x: b.doorX + 0.5, y: b.doorY - 0.5 } : undefined;
      if (target) return moveOrAct(game, c, target.x, target.y, 1, () => startAction(game, c, 'rest', 25));
      // at least get under the trees
      const tree = game.index.nearestObjectRing(c.x, c.y, 10, (o) => o.type === 'spruce' || o.type === 'pine' || o.type === 'beech');
      if (tree) return moveOrAct(game, c, tree.x + 0.5, tree.y + 1.4, 1, () => startAction(game, c, 'rest', 20));
      startAction(game, c, 'rest', 15);
      return think(game, c, 1);
    }
    case 'sleep': {
      const spot = sleepingSpot(game, c);
      return moveOrAct(game, c, spot.x, spot.y, 1.1, () => {
        game.startSleep(c);
      });
    }
    case 'wash': {
      const water = nearestWaterTile(game, c, 45);
      if (!water) return think(game, c, 10);
      return moveOrAct(game, c, water[0] + 0.5, water[1] + 0.5, 1.6, () => startAction(game, c, 'wash', 10));
    }
    case 'gatherWood':
      return doGatherWood(game, c);
    case 'gatherFood':
      return doForage(game, c);
    case 'gatherWater':
      return doGatherWater(game, c);
    case 'build': {
      const site = constructionSite(game, c);
      if (!site) return markBlocked(game, c, 'build', 60);
      const tool = objectDef(site.type).build?.tool;
      if (tool && !bestTool(c, tool)) {
        const t = findInCamp(game, (s) => itemDef(s.id).tool?.tags.includes(tool) === true);
        if (!t) return markBlocked(game, c, 'build', 60);
        return moveOrAct(game, c, t.o.x + 0.5, t.o.y + 0.5, 1.6, () => takeFrom(c, t.o, t.o.inv![t.slot]!.id, 1));
      }
      return moveOrAct(game, c, site.x + 0.5, site.y + 0.5, 1.8, () => startAction(game, c, 'build', 15, { targetId: site.id }));
    }
    case 'cook':
      return doCook(game, c);
    case 'tendFire': {
      const fire = campFire(game);
      if (!fire) return runTask(game, c, 'socialise');
      return moveOrAct(game, c, fire.x + 0.5, fire.y + 1.5, 1.8, () => {
        if ((fire.s ?? 0) < 120 && feedFire(game, c, fire)) return;
        if ((fire.s ?? 0) <= 0) {
          // nothing to burn: this becomes a firewood problem
          markBlocked(game, c, 'tendFire', 30);
          (c.ai.recent ??= {}).gatherWood = -1e9;
          return;
        }
        const dark = daylight(game.state.time) < 0.5 || game.state.weather.temp < 10;
        if (!fire.lit && dark) {
          if (fetchIgniter(game, c, fire)) startAction(game, c, 'lightFire', 3, { targetId: fire.id });
          else markBlocked(game, c, 'tendFire', 60);
        } else {
          startAction(game, c, 'rest', 15);
          markDone(game, c, 'tendFire');
        }
      });
    }
    case 'fish':
      return doFish(game, c);
    case 'hunt':
      return doHunt(game, c);
    case 'socialise': {
      const fire = campFire(game);
      const cx = fire ? fire.x + 0.5 : h.x;
      const cy = fire ? fire.y + 0.5 : h.y;
      // each NPC has a stable seat around the fire
      const idx = Object.keys(game.state.characters).indexOf(c.id);
      const a = (idx / 16) * Math.PI * 2;
      const sx = cx + Math.cos(a) * 2.4;
      const sy = cy + Math.sin(a) * 2;
      return moveOrAct(game, c, sx, sy, 1.2, () => startAction(game, c, 'rest', game.rng.range(15, 40)));
    }
    case 'follow': {
      const p = game.player;
      if (arrived(c, p.x, p.y, 3)) return think(game, c, 0.5);
      goTo(game, c, p.x + game.rng.range(-1.5, 1.5), p.y + game.rng.range(-1.5, 1.5), true);
      return think(game, c, 1);
    }
    case 'stay': {
      const x = c.ai.orderX ?? c.x;
      const y = c.ai.orderY ?? c.y;
      return moveOrAct(game, c, x, y, 1.5, () => startAction(game, c, 'rest', 20));
    }
    case 'goHome': {
      return moveOrAct(game, c, h.x + game.rng.range(-3, 3), h.y + game.rng.range(-3, 3), 3, () => {
        if (c.ai.order === 'returnCamp') c.ai.order = 'none';
        onNpcArrivedHome(game, c);
      });
    }
    case 'deposit':
      return doDeposit(game, c);
    case 'makeFire':
      return doMakeFire(game, c);
    case 'buildShelter':
      return doAutoBuild(game, c, 'lean_to', 'buildShelter', 'We need somewhere dry to sleep. I will put up a lean-to.');
    case 'buildLatrine':
      return doAutoBuild(game, c, 'latrine', 'buildLatrine', 'Someone has to dig a latrine. Fine, me.');
    case 'purify': {
      const fire = campFire(game, true);
      const dirty = findInCamp(game, (s) => !!s.liquid && s.liquid.ml > 200 && s.liquid.contam > 0.05);
      if (!fire || !dirty) {
        markDone(game, c, 'purify');
        return think(game, c, 2);
      }
      const own = c.inventory.some((s) => s?.liquid && s.liquid.contam > 0.05 && s.liquid.ml > 0);
      if (!own) {
        // take the dirty container (and the pot if needed) from storage
        return moveOrAct(game, c, dirty.o.x + 0.5, dirty.o.y + 0.5, 1.6, () => {
          const s = dirty.o.inv![dirty.slot];
          if (s) {
            const free = c.inventory.findIndex((x) => !x);
            if (free >= 0) {
              c.inventory[free] = s;
              dirty.o.inv![dirty.slot] = null;
            }
          }
          if (!bestTool(c, 'boil')) {
            const pot = findInCamp(game, (x) => itemDef(x.id).tool?.tags.includes('boil') === true);
            if (pot) takeFrom(c, pot.o, pot.o.inv![pot.slot]!.id, 1);
          }
        });
      }
      return moveOrAct(game, c, fire.x + 0.5, fire.y + 1.5, 1.8, () => {
        startAction(game, c, 'boilWater', 15, { targetId: fire.id });
        markDone(game, c, 'purify');
        c.ai.task = 'deposit';
      });
    }
    case 'expedition':
      return doExpedition(game, c);
    default:
      startAction(game, c, 'rest', 10);
      return think(game, c, 2);
  }
}

// --- concrete behaviours ------------------------------------------------------------

function takeFrom(c: Character, o: WorldObject, id: string, qty: number): number {
  if (!o.inv) return 0;
  const taken = removeItem(o.inv, id, qty);
  let n = 0;
  for (const s of taken) {
    const left = addItem(c.inventory, s);
    n += s.qty - (left?.qty ?? 0);
    if (left) addItem(o.inv, left);
  }
  return n;
}

function doDrink(game: Game, c: Character): void {
  // own clean water first
  const own = cleanestWater(c.inventory, 100);
  const cautious = c.traits.includes('cautious');
  if (own && (own.liquid!.contam < 0.1 || c.needs.hydration < (cautious ? 18 : 32))) {
    const slot = c.inventory.indexOf(own);
    // drink until satisfied, not just a sip
    startAction(game, c, 'drinkItem', 2, { data: { slot, ml: Math.max(300, (100 - c.needs.hydration) * 25) } });
    return think(game, c, 1);
  }
  // dirty water: purify with a tablet if we have one
  if (own && countItem(c.inventory, 'purify_tablets') > 0) {
    removeItem(c.inventory, 'purify_tablets', 1);
    own.liquid!.contam = 0.01;
    return think(game, c, 0.5);
  }
  // camp water (rain collector or containers)
  const h = game.home;
  const rc = game.index.nearestOfType('rain_collector', h.x, h.y, CAMP_RADIUS, (o) => (o.water?.ml ?? 0) > 300);
  if (rc && c.inventory.some((s) => s && itemDef(s.id).liquidCapacity)) {
    return moveOrAct(game, c, rc.x + 0.5, rc.y + 0.5, 1.6, () => startAction(game, c, 'collectRain', 2, { targetId: rc.id }));
  }
  const stored = findInCamp(game, (s) => !!s.liquid && s.liquid.ml > 200 && s.liquid.contam < 0.1);
  if (stored) {
    return moveOrAct(game, c, stored.o.x + 0.5, stored.o.y + 0.5, 1.6, () => {
      const s = stored.o.inv![stored.slot];
      if (s?.liquid) {
        const ml = Math.min(500, s.liquid.ml);
        s.liquid.ml -= ml;
        c.needs.hydration = Math.min(100, c.needs.hydration + ml / 25);
        game.social.adjust(c.id, game.state.playerId, 0.2);
      }
    });
  }
  // boil what we have if a fire is lit
  const fire = campFire(game, true);
  if (own && fire && (bestTool(c, 'boil') || findInCamp(game, (s) => itemDef(s.id).tool?.tags.includes('boil') === true))) {
    return moveOrAct(game, c, fire.x + 0.5, fire.y + 1.5, 1.8, () => startAction(game, c, 'boilWater', 15, { targetId: fire.id }));
  }
  // carrying untreated water already: no point walking to the stream; wait
  // until thirst outweighs the risk (cautious people hold out longer)
  if (own) return markBlocked(game, c, 'drink', 40);
  // go to water: fill containers, and drink there if thirsty enough to take the risk
  const wt = nearestWaterTile(game, c, 70);
  if (!wt) return markBlocked(game, c, 'drink', 30);
  moveOrAct(game, c, wt[0] + 0.5, wt[1] + 0.5, 1.6, () => {
    if (c.needs.hydration < (cautious ? 20 : 45)) startAction(game, c, 'drinkWater', 2, { tx: wt[0], ty: wt[1] });
    else if (c.inventory.some((s) => s && itemDef(s.id).liquidCapacity)) startAction(game, c, 'fill', 2, { tx: wt[0], ty: wt[1] });
  });
}

/** Food that must be cooked, mapped to the recipe that makes it edible. */
const COOK: Record<string, string> = {
  raw_meat: 'cook_meat',
  raw_fish: 'cook_fish',
  potato: 'bake_potato',
  chanterelles: 'roast_mushrooms',
  pasta: 'boil_pasta',
  beans_dry: 'bean_stew',
};

let campKnifeCache = { t: -1, v: false };
function canOpen(c: Character, id: string, game?: Game): boolean {
  if (!itemDef(id).food?.needsOpen || !!bestTool(c, 'open') || !!bestTool(c, 'cut')) return true;
  if (!game) return false;
  // borrow a knife or hatchet from the camp stores
  if (campKnifeCache.t !== game.state.time) campKnifeCache = { t: game.state.time, v: !!findInCamp(game, (s) => itemDef(s.id).tool?.tags.some((t) => t === 'cut' || t === 'open') === true) };
  return campKnifeCache.v && Math.hypot(c.x - game.home.x, c.y - game.home.y) < CAMP_RADIUS;
}

function pickFood(slots: (ItemStack | null)[], allowRaw: boolean, c: Character, game?: Game): number {
  let best = -1;
  let bestScore = -Infinity;
  slots.forEach((s, i) => {
    if (!s) return;
    const f = itemDef(s.id).food;
    if (!f) return;
    if (!allowRaw && (f.risk ?? 0) >= 0.3) return;
    if (!canOpen(c, s.id, game)) return;
    // prefer food that will spoil soon, and cooked food
    const score = (f.spoilPerDay > 0 ? (1 - (s.q ?? 1)) * 3 + f.spoilPerDay : 0) + (f.morale ?? 0) * 0.1 - (f.risk ?? 0) * 5 + (s.id === 'ration' ? -1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

function doEat(game: Game, c: Character): void {
  // raw food is only eaten raw when there is no fire to cook it on
  const desperate = c.needs.satiety < 10 && !campFire(game);
  const i = pickFood(c.inventory, desperate, c);
  if (i >= 0) {
    const s = c.inventory[i]!;
    startAction(game, c, 'eat', itemDef(s.id).food!.eatMinutes ?? 5, { data: { slot: i, item: s.id, from: 'inv' } });
    return think(game, c, 1);
  }
  const stored = campContainers(game).find((o) => pickFood(o.inv!, desperate, c, game) >= 0);
  if (stored) {
    return moveOrAct(game, c, stored.x + 0.5, stored.y + 0.5, 1.6, () => {
      const j = pickFood(stored.inv!, desperate, c, game);
      if (j >= 0) eatStack(game, c, stored.inv!, j);
    });
  }
  // raw food and a fire: cook it
  if (hasRawFood(game, c) && campFire(game)) return doCook(game, c);
  // nothing edible at hand: look for something growing nearby, otherwise give up for now
  if (forageTarget(game, c)) return doForage(game, c);
  if (bestTool(c, 'fish')) return doFish(game, c);
  markBlocked(game, c, 'eat', 90);
}

function forageTarget(game: Game, c: Character): WorldObject | undefined {
  const types = ['bilberry', 'bramble', 'hazel', 'wild_garlic', 'mushrooms'];
  const h = game.home;
  return game.index.nearestObjectRing(c.x, c.y, 40, (o) => types.includes(o.type) && !!o.s && (o.type !== 'hazel' || season(game.state.time).nuts) && Math.hypot(o.x - h.x, o.y - h.y) < 80);
}

/** Make sure the NPC carries something to light a fire with. */
function fetchIgniter(game: Game, c: Character, fire?: WorldObject): boolean {
  if (bestTool(c, 'ignite')) return true;
  if (fire && (fire.embers ?? 0) > game.state.time) return true;
  const ig = findInCamp(game, (s) => itemDef(s.id).tool?.tags.includes('ignite') === true && (s.charge ?? 0) > 0);
  if (!ig) return c.skills.survival >= 4; // can try a friction fire
  // only when standing close enough to reach it
  if (Math.hypot(ig.o.x - c.x, ig.o.y - c.y) > 8) return false;
  takeFrom(c, ig.o, ig.o.inv![ig.slot]!.id, 1);
  return !!bestTool(c, 'ignite');
}

function hasRawFood(game: Game, c: Character): boolean {
  if (c.inventory.some((s) => s && COOK[s.id])) return true;
  return !!findInCamp(game, (s) => !!COOK[s.id]);
}

function doCook(game: Game, c: Character): void {
  const fire = campFire(game, true);
  if (!fire) {
    // light the camp fire first
    const cold = campFire(game);
    if (!cold) return doMakeFire(game, c);
    return moveOrAct(game, c, cold.x + 0.5, cold.y + 1.5, 1.8, () => {
      if ((cold.s ?? 0) < 30 && feedFire(game, c, cold)) return;
      if ((cold.s ?? 0) > 0 && fetchIgniter(game, c, cold)) startAction(game, c, 'lightFire', 2, { targetId: cold.id });
      else markBlocked(game, c, 'cook', 60);
    });
  }
  // cook what we carry
  for (const s of c.inventory) {
    const rid = s ? COOK[s.id] : undefined;
    if (rid && npcCraft(game, c, rid)) return;
  }
  // fetch something cookable from storage
  const stored = findInCamp(game, (s) => !!COOK[s.id]);
  if (stored) {
    const id = stored.o.inv![stored.slot]!.id;
    const need = Object.values(recipeById(COOK[id])!.inputs)[0] ?? 1;
    return moveOrAct(game, c, stored.o.x + 0.5, stored.o.y + 0.5, 1.6, () => {
      takeFrom(c, stored.o, id, need);
      if (countItem(c.inventory, id) < need) markBlocked(game, c, 'cook', 60);
    });
  }
  markBlocked(game, c, 'cook', 60);
}

/** Put fuel on the fire. Returns true if something was done (an action started or fuel fetched). */
function feedFire(game: Game, c: Character, fire: WorldObject): boolean {
  for (const fuel of ['firewood', 'branch', 'log']) {
    if (countItem(c.inventory, fuel) > 0) {
      startAction(game, c, 'addFuel', 1, { targetId: fire.id, data: { item: fuel, qty: fuel === 'branch' ? 4 : 2 } });
      return true;
    }
  }
  const isFuel = (s: ItemStack) => s.id === 'firewood' || s.id === 'branch' || s.id === 'log';
  const stored = findInCamp(game, isFuel);
  if (stored) {
    takeFrom(c, stored.o, stored.o.inv![stored.slot]!.id, 5);
    return countItem(c.inventory, 'branch') + countItem(c.inventory, 'firewood') + countItem(c.inventory, 'log') > 0;
  }
  const pile = game.index.nearestOfType('pile', fire.x, fire.y, 8, (o) => !!o.inv?.some((s) => !!s && isFuel(s)));
  if (pile) {
    const s = pile.inv!.find((x) => !!x && isFuel(x))!;
    takeFrom(c, pile, s.id, 5);
    return true;
  }
  return false;
}

function campWoodScore(game: Game): number {
  let fuel = 0;
  for (const o of campContainers(game)) for (const s of o.inv!) if (s) fuel += (itemDef(s.id).fuel ?? 0) * s.qty * (s.id === 'fiber' || s.id === 'cloth' ? 0 : 1);
  const fire = campFire(game);
  fuel += fire?.s ?? 0;
  const piles = game.index.nearestOfType('pile', game.home.x, game.home.y, CAMP_RADIUS);
  if (piles?.inv) for (const s of piles.inv) if (s) fuel += (itemDef(s.id).fuel ?? 0) * s.qty;
  // want roughly a day of fuel in stock
  return clamp((900 - fuel) / 40, 0, 25);
}

function carryingSupplies(c: Character): boolean {
  let n = 0;
  for (const s of c.inventory) {
    if (!s) continue;
    const d = itemDef(s.id);
    if (d.category === 'material' || (d.food && s.qty > 2)) n += s.qty;
  }
  return n >= 6 || loadRatio(c) > 0.85;
}

function doDeposit(game: Game, c: Character): void {
  const store = campContainers(game)[0];
  const fire = campFire(game);
  const target = store ?? fire;
  const tx = target ? target.x + 0.5 : game.home.x;
  const ty = target ? target.y + 1.5 : game.home.y;
  moveOrAct(game, c, tx, ty, 1.8, () => {
    let keptWater = false;
    const keep = (s: ItemStack) => {
      const d = itemDef(s.id);
      if (d.category === 'water' && d.id !== 'cooking_pot') {
        // keep one bottle for yourself, share the rest
        if (!keptWater) return (keptWater = true);
        return false;
      }
      return d.category === 'tool' || d.category === 'weapon' || d.category === 'light' || d.category === 'clothing' || d.category === 'medical' || d.category === 'document';
    };
    const out: ItemStack[] = [];
    c.inventory.forEach((s, i) => {
      if (!s || keep(s)) return;
      const d = itemDef(s.id);
      // keep up to two portions of food for oneself
      if (d.food) {
        if (s.qty <= 2 && foodStacks(c.inventory).length <= 1) return;
        if (s.qty > 2 && foodStacks(c.inventory).length <= 1) {
          out.push({ ...s, qty: s.qty - 2 });
          s.qty = 2;
          return;
        }
      }
      out.push(s);
      c.inventory[i] = null;
    });
    if (!out.length) return;
    let leftovers: ItemStack[] = out;
    if (store?.inv) {
      leftovers = [];
      for (const s of out) {
        const left = addItem(store.inv, s);
        if (left) leftovers.push(left);
      }
    }
    if (leftovers.length) {
      // pile near the fire
      let pile = game.index.nearestOfType('pile', tx, ty, 3);
      if (!pile) {
        const spot = game.index.findTileNear(tx, ty, 4, (x, y) => game.index.isFree(x, y));
        if (spot) pile = game.index.addObject({ type: 'pile', x: spot[0], y: spot[1], inv: new Array(12).fill(null) });
      }
      if (pile?.inv) for (const s of leftovers) {
        const left = addItem(pile.inv, s);
        if (left) pile.inv.push(left);
      }
    }
    game.social.adjust(c.id, game.state.playerId, 0.3);
  });
}

function doMakeFire(game: Game, c: Character): void {
  doAutoBuild(game, c, 'campfire', 'makeFire', 'I will get a fire going.');
}

/** Materials an NPC can gather by themselves, and where they come from. */
const GATHERABLE: Record<string, string[]> = { branch: ['deadfall'], fiber: ['nettles', 'tall_grass', 'reeds'], stone: ['rocks'] };

/**
 * Build a basic camp structure without being told to: fetch or gather the
 * materials, choose a sensible spot near camp, place the site and work on it.
 */
function doAutoBuild(game: Game, c: Character, type: string, task: string, line: string): void {
  const h = game.home;
  const def = objectDef(type);
  const b = def.build!;
  // an unfinished site of this type near camp: finish it
  for (const id of game.index.sites) {
    const o = game.state.objects[id];
    if (o && o.type === type && Math.hypot(o.x - h.x, o.y - h.y) < CAMP_RADIUS) {
      if (b.tool && !bestTool(c, b.tool)) {
        const tool = findInCamp(game, (s) => itemDef(s.id).tool?.tags.includes(b.tool!) === true);
        if (!tool) return markBlocked(game, c, task, 120);
        return moveOrAct(game, c, tool.o.x + 0.5, tool.o.y + 0.5, 1.6, () => takeFrom(c, tool.o, tool.o.inv![tool.slot]!.id, 1));
      }
      return moveOrAct(game, c, o.x + 0.5, o.y + 1.5, 1.8, () => startAction(game, c, 'build', 15, { targetId: o.id }));
    }
  }
  // materials
  for (const [id, n] of Object.entries(b.materials)) {
    const have = countItem(c.inventory, id);
    if (have >= n) continue;
    const stored = findInCamp(game, (s) => s.id === id);
    if (stored) return moveOrAct(game, c, stored.o.x + 0.5, stored.o.y + 0.5, 1.6, () => takeFrom(c, stored.o, id, n - have));
    const pile = game.index.nearestOfType('pile', h.x, h.y, CAMP_RADIUS, (o) => !!o.inv?.some((s) => s?.id === id));
    if (pile) return moveOrAct(game, c, pile.x + 0.5, pile.y + 0.5, 1.4, () => takeFrom(c, pile, id, n - have));
    const sources = GATHERABLE[id];
    if (!sources) return markBlocked(game, c, task, 180);
    const src = game.index.nearestObjectRing(c.x, c.y, 35, (o) => sources.includes(o.type) && (o.type === 'deadfall' || o.type === 'rocks' || !!o.s));
    if (!src) return markBlocked(game, c, task, 120);
    return moveOrAct(game, c, src.x + 0.5, src.y + 0.5, 1.3, () => startAction(game, c, 'gather', gatherMinutes(src.type) / workSpeed(c), { targetId: src.id }));
  }
  const w = def.w ?? 1;
  const hh = def.h ?? 1;
  const wantFar = type === 'latrine' ? 10 : 2;
  const spot = game.index.findTileNear(h.x, h.y, type === 'latrine' ? 16 : 8, (x, y) => {
    if (!game.index.isFree(x, y, w, hh)) return false;
    if (Math.hypot(x - h.x, y - h.y) < wantFar) return false;
    if (type === 'campfire') {
      let flammable = 0;
      game.index.objectsNear(x + 0.5, y + 0.5, 1, (o) => {
        if (objectDef(o.type).flammable) flammable++;
      });
      if (flammable) return false;
    }
    if (type === 'latrine') {
      // keep waste away from water
      if (game.index.findTileNear(x, y, 8, (tx, ty) => isWater(game.index.terrainAt(tx, ty)))) return false;
    }
    return true;
  });
  if (!spot) return markBlocked(game, c, task, 240);
  moveOrAct(game, c, spot[0] + w / 2, spot[1] + hh + 0.6, 1.6, () => {
    if (!game.index.isFree(spot[0], spot[1], w, hh)) return;
    for (const [id, n] of Object.entries(b.materials)) removeItem(c.inventory, id, n);
    const site = game.index.addObject({ type, x: spot[0], y: spot[1], build: 0, v: game.rng.int(0, 255) });
    if (!b.tool || bestTool(c, b.tool)) startAction(game, c, 'build', 15, { targetId: site.id });
    game.say(c, line);
    game.journal(`${c.name} started building a ${def.name.toLowerCase()} at camp.`, 'camp');
  });
}

function doGatherWood(game: Game, c: Character): void {
  if (loadRatio(c) > 0.85 || countItem(c.inventory, 'branch') >= 16 || countItem(c.inventory, 'log') >= 2) return doDeposit(game, c);
  const h = game.home;
  // pick up logs lying in piles near camp first
  const pile = game.index.nearestOfType('pile', c.x, c.y, 30, (o) => !!o.inv?.some((s) => s && (s.id === 'log' || s.id === 'branch')) && Math.hypot(o.x - h.x, o.y - h.y) > 4);
  if (pile) {
    return moveOrAct(game, c, pile.x + 0.5, pile.y + 0.5, 1.4, () => {
      const id = pile.inv!.some((s) => s?.id === 'branch') ? 'branch' : 'log';
      takeFrom(c, pile, id, id === 'log' ? 1 : 10);
      if (pile.inv!.every((s) => !s)) game.index.removeObject(pile.id);
    });
  }
  const df = game.index.nearestObjectRing(c.x, c.y, 40, (o) => o.type === 'deadfall');
  if (df && Math.hypot(df.x - h.x, df.y - h.y) < 60) {
    return moveOrAct(game, c, df.x + 0.5, df.y + 0.5, 1.3, () => startAction(game, c, 'gather', gatherMinutes('deadfall') / workSpeed(c), { targetId: df.id }));
  }
  if (bestTool(c, 'chop') || findInCamp(game, (s) => itemDef(s.id).tool?.tags.includes('chop') === true)) {
    if (!bestTool(c, 'chop')) {
      const ax = findInCamp(game, (s) => itemDef(s.id).tool?.tags.includes('chop') === true)!;
      return moveOrAct(game, c, ax.o.x + 0.5, ax.o.y + 0.5, 1.6, () => takeFrom(c, ax.o, ax.o.inv![ax.slot]!.id, 1));
    }
    const tree = game.index.nearestObjectRing(c.x, c.y, 30, (o) => (o.type === 'spruce' || o.type === 'pine' || o.type === 'birch') && Math.hypot(o.x - h.x, o.y - h.y) > 7);
    if (tree) {
      const tool = bestTool(c, 'chop')!;
      return moveOrAct(game, c, tree.x + 0.5, tree.y + 1.4, 1.3, () => startAction(game, c, 'chop', 25 / (tool.power * (0.6 + c.attributes.strength * 0.08) * workSpeed(c)), { targetId: tree.id }));
    }
  }
  think(game, c, 10);
}

function doForage(game: Game, c: Character): void {
  if (loadRatio(c) > 0.85 || foodStacks(c.inventory).reduce((n, s) => n + s.qty, 0) >= 12) return doDeposit(game, c);
  const target = forageTarget(game, c);
  if (target) {
    return moveOrAct(game, c, target.x + 0.5, target.y + 0.5, 1.3, () => startAction(game, c, 'gather', gatherMinutes(target.type) / workSpeed(c, 'foraging'), { targetId: target.id }));
  }
  // nothing in season nearby: fish if possible
  if (bestTool(c, 'fish')) return doFish(game, c);
  markBlocked(game, c, 'gatherFood', 120);
}

function doGatherWater(game: Game, c: Character): void {
  const containers = c.inventory.filter((s) => s && itemDef(s.id).liquidCapacity) as ItemStack[];
  if (!containers.length) {
    const empty = findInCamp(game, (s) => !!itemDef(s.id).liquidCapacity);
    if (empty) return moveOrAct(game, c, empty.o.x + 0.5, empty.o.y + 0.5, 1.6, () => takeFrom(c, empty.o, empty.o.inv![empty.slot]!.id, 1));
    return think(game, c, 10);
  }
  const full = containers.every((s) => (s.liquid?.ml ?? 0) >= (itemDef(s.id).liquidCapacity ?? 0) * 0.9);
  if (!full) {
    const wt = nearestWaterTile(game, c, 70);
    if (!wt) return think(game, c, 10);
    return moveOrAct(game, c, wt[0] + 0.5, wt[1] + 0.5, 1.6, () => startAction(game, c, 'fill', 3, { tx: wt[0], ty: wt[1] }));
  }
  // purify: boil at a lit fire if a pot is around, else tablets
  const dirty = containers.some((s) => (s.liquid?.contam ?? 0) > 0.05);
  const fire = campFire(game, true);
  if (dirty && fire && (bestTool(c, 'boil') || findInCamp(game, (s) => itemDef(s.id).tool?.tags.includes('boil') === true))) {
    return moveOrAct(game, c, fire.x + 0.5, fire.y + 1.5, 1.8, () => startAction(game, c, 'boilWater', 15, { targetId: fire.id }));
  }
  // deliver clean water to camp: rain collector barrel or storage containers
  const h = game.home;
  const rc = game.index.nearestOfType('rain_collector', h.x, h.y, CAMP_RADIUS, (o) => (o.water?.ml ?? 0) < 38000);
  if (rc && !dirty) {
    return moveOrAct(game, c, rc.x + 0.5, rc.y + 0.5, 1.6, () => {
      for (const s of containers) {
        if (!s.liquid) continue;
        const room = 40000 - (rc.water!.ml ?? 0);
        const n = Math.min(room, s.liquid.ml);
        rc.water!.contam = (rc.water!.contam * rc.water!.ml + s.liquid.contam * n) / Math.max(1, rc.water!.ml + n);
        rc.water!.ml += n;
        s.liquid.ml -= n;
      }
      game.social.adjust(c.id, game.state.playerId, 0.3);
    });
  }
  const store = campContainers(game).find((o) => o.inv!.some((s) => s && itemDef(s.id).liquidCapacity && (s.liquid?.ml ?? 0) < (itemDef(s.id).liquidCapacity ?? 0)));
  if (store && !dirty) {
    return moveOrAct(game, c, store.x + 0.5, store.y + 0.5, 1.6, () => {
      for (const t of store.inv!) {
        if (!t || !itemDef(t.id).liquidCapacity) continue;
        for (const s of containers) {
          if (!s.liquid || s.liquid.ml <= 0) continue;
          const n = pourInto(t, s.liquid.ml, s.liquid.contam);
          s.liquid.ml -= n;
        }
      }
    });
  }
  // nowhere clean to store it: bring it to camp storage so it can be boiled later
  const anyStore = campContainers(game)[0];
  if (anyStore && Math.hypot(c.x - game.home.x, c.y - game.home.y) < CAMP_RADIUS + 20) {
    return moveOrAct(game, c, anyStore.x + 0.5, anyStore.y + 0.5, 1.6, () => {
      // keep one container for yourself, store the rest
      let kept = false;
      c.inventory.forEach((s, i) => {
        if (!s || !itemDef(s.id).liquidCapacity || (s.liquid?.ml ?? 0) <= 0) return;
        if (!kept) {
          kept = true;
          return;
        }
        if (!addItem(anyStore.inv!, s)) c.inventory[i] = null;
      });
      markDone(game, c, 'gatherWater');
    });
  }
  markDone(game, c, 'gatherWater');
  think(game, c, 5);
}

/**
 * Work toward crafting a recipe: fetch tools and inputs from camp, gather raw
 * materials, craft intermediate parts (cordage), then craft. Returns true if
 * the NPC is now doing something toward it.
 */
function npcCraft(game: Game, c: Character, recipeId: string, depth = 0): boolean {
  const r = recipeById(recipeId);
  if (!r || depth > 2) return false;
  if (r.tool === 'boil') {
    if (liquidTotal(c.inventory) < 900) return false;
    if (!bestTool(c, 'boil')) {
      const pot = findInCamp(game, (s) => itemDef(s.id).tool?.tags.includes('boil') === true);
      if (!pot) return false;
      moveOrAct(game, c, pot.o.x + 0.5, pot.o.y + 0.5, 1.6, () => takeFrom(c, pot.o, pot.o.inv![pot.slot]!.id, 1));
      return true;
    }
  } else if (r.tool && !bestTool(c, r.tool)) {
    const t = findInCamp(game, (s) => itemDef(s.id).tool?.tags.includes(r.tool!) === true);
    if (!t) return false;
    moveOrAct(game, c, t.o.x + 0.5, t.o.y + 0.5, 1.6, () => takeFrom(c, t.o, t.o.inv![t.slot]!.id, 1));
    return true;
  }
  for (const [id, n] of Object.entries(r.inputs)) {
    const have = countItem(c.inventory, id);
    if (have >= n) continue;
    const stored = findInCamp(game, (s) => s.id === id);
    if (stored) {
      moveOrAct(game, c, stored.o.x + 0.5, stored.o.y + 0.5, 1.6, () => takeFrom(c, stored.o, id, n - have));
      return true;
    }
    const sub = RECIPES.find((x) => x.outputs[id] && x.id !== recipeId);
    if (sub && npcCraft(game, c, sub.id, depth + 1)) return true;
    const sources = GATHERABLE[id];
    if (!sources) return false;
    const src = game.index.nearestObjectRing(c.x, c.y, 35, (o) => sources.includes(o.type) && (o.type === 'deadfall' || o.type === 'rocks' || !!o.s));
    if (!src) return false;
    moveOrAct(game, c, src.x + 0.5, src.y + 0.5, 1.3, () => startAction(game, c, 'gather', gatherMinutes(src.type) / workSpeed(c), { targetId: src.id }));
    return true;
  }
  const minutes = r.minutes / workSpeed(c, r.skill);
  if (r.station === 'fire') {
    const fire = campFire(game, true);
    if (!fire) return false;
    moveOrAct(game, c, fire.x + 0.5, fire.y + 1.5, 1.8, () => startAction(game, c, 'craft', minutes, { data: { recipe: recipeId } }));
    return true;
  }
  if (r.station === 'workbench') return false;
  startAction(game, c, 'craft', minutes, { data: { recipe: recipeId } });
  think(game, c, 1);
  return true;
}

function doFish(game: Game, c: Character): void {
  if (!bestTool(c, 'fish')) {
    const rod = findInCamp(game, (s) => s.id === 'fishing_rod');
    if (rod) return moveOrAct(game, c, rod.o.x + 0.5, rod.o.y + 0.5, 1.6, () => takeFrom(c, rod.o, 'fishing_rod', 1));
    if (npcCraft(game, c, 'fishing_rod')) return;
    return markBlocked(game, c, 'fish', 180);
  }
  if (countItem(c.inventory, 'raw_fish') >= 4) return doDeposit(game, c);
  const wt = nearestWaterTile(game, c, 60, true);
  if (!wt) return think(game, c, 15);
  moveOrAct(game, c, wt[0] + 0.5, wt[1] + 0.5, 1.7, () => startAction(game, c, 'fish', 60, { tx: wt[0], ty: wt[1] }));
}

function doHunt(game: Game, c: Character): void {
  if (countItem(c.inventory, 'spear') === 0) {
    const spear = findInCamp(game, (s) => s.id === 'spear');
    if (spear) return moveOrAct(game, c, spear.o.x + 0.5, spear.o.y + 0.5, 1.6, () => takeFrom(c, spear.o, 'spear', 1));
    if (npcCraft(game, c, 'spear')) return;
    return markBlocked(game, c, 'hunt', 240);
  }
  const carcass = game.index.nearestOfType('carcass', c.x, c.y, 30);
  if (carcass) {
    if (!bestTool(c, 'cut')) return think(game, c, 10);
    return moveOrAct(game, c, carcass.x + 0.5, carcass.y + 0.5, 1.3, () => startAction(game, c, 'butcher', 25, { targetId: carcass.id }));
  }
  let best: { a: typeof game.state.animals[number]; d: number } | undefined;
  for (const a of Object.values(game.state.animals)) {
    if (a.state === 'dead' || a.species === 'fox') continue;
    const d = Math.hypot(a.x - c.x, a.y - c.y);
    if (d < 50 && (!best || d < best.d)) best = { a, d };
  }
  if (!best) return think(game, c, 20);
  if (best.d < 1.6) {
    attackAnimal(game, c, best.a);
    return think(game, c, 0.5);
  }
  goTo(game, c, best.a.x, best.a.y, true);
  think(game, c, 1);
}

/** A construction site near camp that this character can actually work on. */
function constructionSite(game: Game, c?: Character): WorldObject | undefined {
  const h = game.home;
  let best: WorldObject | undefined;
  let bestD = Infinity;
  for (const id of game.index.sites) {
    const o = game.state.objects[id];
    if (!o || o.build === undefined || Math.hypot(o.x - h.x, o.y - h.y) > CAMP_RADIUS + 10) continue;
    const tool = objectDef(o.type).build?.tool;
    if (c && tool && !bestTool(c, tool) && !findInCamp(game, (s) => itemDef(s.id).tool?.tags.includes(tool) === true)) continue;
    const d = c ? Math.hypot(o.x - c.x, o.y - c.y) : 0;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

export function nearestWaterTile(game: Game, c: Character, r: number, deep = false): [number, number] | undefined {
  // cheap coarse search: scan rings but sample every tile only close by
  const idx = game.index;
  return idx.findTileNear(c.x, c.y, r, (x, y) => {
    const t = idx.terrainAt(x, y);
    if (!isWater(t)) return false;
    if (deep) return true;
    // must be reachable: a walkable neighbour
    return !idx.isSolid(x, y) || !idx.isSolid(x + 1, y) || !idx.isSolid(x - 1, y) || !idx.isSolid(x, y + 1) || !idx.isSolid(x, y - 1);
  });
}

function shelterNear(game: Game, c: Character): boolean {
  return !!game.index.nearestOfType(SHELTER_TYPES, c.x, c.y, 30, (o) => o.build === undefined) || !!nearestBuilding(game, c, 30);
}

function nearestBuilding(game: Game, c: Character, r: number) {
  let best;
  let bd = r;
  for (const b of game.state.buildings) {
    const d = Math.hypot(b.doorX - c.x, b.doorY - c.y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

function sleepingSpot(game: Game, c: Character): { x: number; y: number } {
  const h = game.home;
  const sleepers = new Map<number, number>();
  for (const o of game.livingCharacters()) {
    if (!o.sleeping || o === c) continue;
    const sh = game.envAt(o.x, o.y).shelterObj;
    if (sh) sleepers.set(sh.id, (sleepers.get(sh.id) ?? 0) + 1);
  }
  const near = Math.hypot(c.x - h.x, c.y - h.y) < 40;
  const origin = near ? h : { x: c.x, y: c.y };
  const campfire = near ? campFire(game) : undefined;
  // on cold nights, a shelter far from the fire is worse than the ground beside it
  const coldNight = game.state.weather.temp < 8 || c.needs.bodyTemp < 36.5 || c.needs.wetness > 40;
  const shelter = game.index.nearestOfType(['tarp_shelter', 'lean_to', 'bough_bed', 'bed'], origin.x, origin.y, 30, (o) => {
    if (o.build !== undefined) return false;
    const cap = objectDef(o.type).shelter?.capacity ?? 1;
    if (coldNight && campfire && Math.hypot(o.x - campfire.x, o.y - campfire.y) > 5) return false;
    return (sleepers.get(o.id) ?? 0) < cap;
  });
  if (shelter) {
    const d = objectDef(shelter.type);
    const k = sleepers.get(shelter.id) ?? 0;
    return { x: shelter.x + 0.5 + (k % (d.w ?? 1)), y: shelter.y + 0.5 + Math.floor(k / (d.w ?? 1)) * 0.6 };
  }
  // otherwise near the fire, spread out a little
  const fire = campFire(game);
  const idx = Object.keys(game.state.characters).indexOf(c.id);
  const a = (idx / 16) * Math.PI * 2;
  if (fire && near) {
    const r = coldNight ? 2 : 3;
    return { x: fire.x + 0.5 + Math.cos(a) * r, y: fire.y + 0.5 + Math.sin(a) * r * 0.85 };
  }
  if (!near) return { x: c.x, y: c.y };
  return { x: h.x + Math.cos(a) * 3, y: h.y + Math.sin(a) * 3 };
}

// --- expeditions --------------------------------------------------------------------

function canStartExpedition(game: Game, c: Character): boolean {
  const n = c.needs;
  const t = game.state.time;
  const h = hourOf(t);
  if (h < 7 || h > 13) return false;
  // hunger does not stop people from searching for food; weakness does
  if (n.reserves < 25 || n.hydration < 45 || n.energy < 50 || c.health.hp < 60) return false;
  const w = game.state.weather.current;
  if (w === 'heavyRain' || w === 'thunderstorm' || w === 'snow' || w === 'fog') return false;
  const active = game.state.expeditions.filter((e) => e.status !== 'returned' && e.status !== 'lost').length;
  if (active >= 2) return false;
  if (!game.state.homePin) return false;
  const wantsTo = c.ai.order === 'explore' || c.traits.includes('curious') || c.traits.includes('brave') || c.traits.includes('riskTaking');
  // with the stores running empty, even cautious people go looking for food
  const desperate = game.campFoodDays() < 0.8 && (c.traits.includes('practical') || c.traits.includes('hardworking') || c.skills.survival >= 3);
  return (wantsTo || desperate) && (c.ai.order === 'explore' || game.rng.chance(desperate ? 0.15 : 0.08));
}

function chooseDestination(game: Game, c: Character): { x: number; y: number; name: string; kind: Expedition['kind'] } {
  const h = game.home;
  // unlooted buildings are attractive destinations
  const candidates = game.state.buildings.filter((b) => {
    let unlooted = false;
    game.index.objectsNear(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h), (o) => {
      if (o.lootTable || (o.inv && o.s2 !== 1)) unlooted = true;
    });
    const d = Math.hypot(b.x - h.x, b.y - h.y);
    return unlooted && d > 20 && d < 170;
  });
  if (candidates.length && game.rng.chance(0.65)) {
    const b = game.rng.pick(candidates);
    return { x: b.doorX + 0.5, y: b.doorY + 1.5, name: b.discovered ? `the ${b.name.toLowerCase()}` : 'an unexplored area', kind: 'loot' };
  }
  // otherwise an unexplored part of the map
  const W = game.state.width;
  for (let i = 0; i < 40; i++) {
    const a = game.rng.range(0, Math.PI * 2);
    const d = game.rng.range(35, 110);
    const x = clamp(Math.round(h.x + Math.cos(a) * d), 5, W - 5);
    const y = clamp(Math.round(h.y + Math.sin(a) * d), 5, game.state.height - 5);
    if (!game.state.explored[y * W + x] && !game.index.isSolid(x, y)) {
      const dir = compassName(a);
      return { x, y, name: `the woods to the ${dir}`, kind: 'explore' };
    }
  }
  return { x: h.x + 40, y: h.y, name: 'the woods to the east', kind: 'forage' };
}

export function compassName(angle: number): string {
  const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const i = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return dirs[i];
}

function startExpedition(game: Game, c: Character): Expedition {
  const dest = chooseDestination(game, c);
  // a friend may come along
  const companions = game.npcs().filter((o) => o !== c && o.ai.expeditionId === undefined && !o.sleeping && o.needs.energy > 55 && o.needs.hydration > 50 && Math.hypot(o.x - c.x, o.y - c.y) < 15 && o.ai.order !== 'stay' && o.ai.order !== 'follow');
  companions.sort((a, b) => game.social.get(c.id, b.id).affinity - game.social.get(c.id, a.id).affinity);
  const members = [c.id];
  if (companions.length && game.rng.chance(0.6) && game.social.get(c.id, companions[0].id).affinity > 10) members.push(companions[0].id);
  const dist = Math.hypot(dest.x - c.x, dest.y - c.y);
  const travel = (dist / 3.2) * 1.2;
  const e: Expedition = {
    id: game.state.nextId++,
    members,
    objective: dest.kind === 'loot' ? `Search ${dest.name} for supplies` : dest.kind === 'explore' ? `Explore ${dest.name}` : `Forage in ${dest.name}`,
    kind: dest.kind,
    targetX: dest.x,
    targetY: dest.y,
    targetName: dest.name,
    departed: game.state.time,
    expectedReturn: game.state.time + travel * 2 + 90,
    status: 'outbound',
    log: [],
  };
  game.state.expeditions.push(e);
  if (game.state.expeditions.length > 30) game.state.expeditions.splice(0, game.state.expeditions.length - 30);
  for (const id of members) {
    const m = game.state.characters[id];
    m.ai.expeditionId = e.id;
    m.ai.order = m.ai.order === 'explore' ? 'none' : m.ai.order;
    m.pendingExplored = [];
  }
  const names = members.map((id) => game.state.characters[id].name).join(' and ');
  game.journal(`${names} set out: ${e.objective.toLowerCase()}. Expected back around ${formatClock(e.expectedReturn)}.`, 'expedition');
  game.say(c, dest.kind === 'loot' ? 'I am going to check out what is over there. Back before dark.' : 'I want to see what is out there. Back later.');
  return e;
}

function doExpedition(game: Game, c: Character): void {
  let e = c.ai.expeditionId !== undefined ? game.state.expeditions.find((x) => x.id === c.ai.expeditionId) : undefined;
  if (!e) {
    if (!canStartExpedition(game, c) && c.ai.order !== 'explore') return think(game, c, 10);
    e = startExpedition(game, c);
  }
  const leader = game.state.characters[e.members[0]];
  const t = game.state.time;
  const w = game.state.weather.current;
  const exposed = w === 'thunderstorm' || w === 'heavyRain' || w === 'snow';
  const env = game.envAt(c.x, c.y);
  // weather: shelter and wait it out
  if (exposed && e.status !== 'working') {
    if (e.status !== 'sheltering') {
      e.status = 'sheltering';
      e.log.push(`Sheltered from the ${w === 'snow' ? 'snow' : 'storm'}.`);
      e.expectedReturn += 120;
    }
    if (!env.shelter && !env.indoor) return runTask(game, c, 'shelter');
    startAction(game, c, 'rest', 20);
    return think(game, c, 5);
  }
  if (e.status === 'sheltering') e.status = e.workUntil ? 'returning' : 'outbound';
  // night far from home: camp out
  if (isNight(t) && Math.hypot(c.x - game.home.x, c.y - game.home.y) > 50 && c.needs.energy < 70) {
    if (!e.log.includes('Spent the night out.')) e.log.push('Spent the night out.');
    e.expectedReturn = Math.max(e.expectedReturn, t + 600);
    return runTask(game, c, 'sleep');
  }
  // followers stay with the leader
  if (c !== leader && leader.alive && leader.ai.expeditionId === e.id) {
    if (!arrived(c, leader.x, leader.y, 2.5)) {
      goTo(game, c, leader.x + game.rng.range(-1, 1), leader.y + game.rng.range(-1, 1), Math.hypot(c.x - game.player.x, c.y - game.player.y) < 42);
      return think(game, c, 1);
    }
    if (e.status === 'working') return workAtDestination(game, c, e);
    return think(game, c, 1);
  }
  switch (e.status) {
    case 'outbound':
      return moveOrAct(game, c, e.targetX, e.targetY, 2, () => {
        e!.status = 'working';
        e!.workUntil = t + game.rng.range(40, 90);
        e!.log.push(`Reached ${e!.targetName}.`);
      });
    case 'working':
      if (t > (e.workUntil ?? t) || loadRatio(c) > 0.9) {
        e.status = 'returning';
        return think(game, c, 0.5);
      }
      return workAtDestination(game, c, e);
    case 'returning':
      return moveOrAct(game, c, game.home.x, game.home.y, 3, () => finishExpedition(game, e!));
    default:
      return think(game, c, 5);
  }
}

function workAtDestination(game: Game, c: Character, e: Expedition): void {
  // search containers in range
  let target: WorldObject | undefined;
  game.index.objectsNear(e.targetX, e.targetY, 9, (o) => {
    if (target) return;
    if ((o.lootTable || (o.inv && o.s2 !== 1)) && objectDef(o.type).container && o.type !== 'corpse' && o.type !== 'pile' && o.type !== 'supply_bag') target = o;
  });
  if (target) {
    const o = target;
    return moveOrAct(game, c, o.x + 0.5, o.y + 1.2, 1.6, () => {
      ensureLoot(game, o);
      o.s2 = 1;
      const found: string[] = [];
      o.inv!.forEach((s, i) => {
        if (!s || loadRatio(c) > 1) return;
        const left = addItem(c.inventory, s);
        if (!left) {
          found.push(itemDef(s.id).name.toLowerCase());
          o.inv![i] = null;
        } else o.inv![i] = left;
      });
      if (found.length) {
        e.log.push(`${c.name} found ${found.slice(0, 4).join(', ')}.`);
        c.pendingReports.push(...found.slice(0, 4));
      }
      startAction(game, c, 'rest', 3);
    });
  }
  // forage nearby
  const types = ['bilberry', 'bramble', 'hazel', 'wild_garlic', 'mushrooms', 'deadfall'];
  const plant = game.index.nearestObjectRing(c.x, c.y, 12, (o) => types.includes(o.type) && (o.type === 'deadfall' || !!o.s) && gatherLabel(game, o) !== null);
  if (plant) return moveOrAct(game, c, plant.x + 0.5, plant.y + 0.5, 1.3, () => startAction(game, c, 'gather', gatherMinutes(plant.type), { targetId: plant.id }));
  if (bestTool(c, 'fish')) return doFish(game, c);
  // wander the area
  goTo(game, c, e.targetX + game.rng.range(-10, 10), e.targetY + game.rng.range(-10, 10), Math.hypot(c.x - game.player.x, c.y - game.player.y) < 42);
  think(game, c, 5);
}

function finishExpedition(game: Game, e: Expedition): void {
  if (e.status === 'returned') return;
  e.status = 'returned';
  const members = e.members.map((id) => game.state.characters[id]).filter((m) => m?.alive);
  const names = members.map((m) => m.name).join(' and ');
  const finds = members.flatMap((m) => m.pendingReports);
  const late = game.state.time > e.expectedReturn + 60;
  let text = `${names || 'The expedition'} returned from ${e.targetName}`;
  text += finds.length ? ` with ${[...new Set(finds)].slice(0, 5).join(', ')}.` : ' empty-handed.';
  if (late) text += ' They were later than planned.';
  if (e.log.includes('Spent the night out.')) text += ' They had to spend the night outside.';
  game.journal(text, 'expedition');
  for (const m of members) {
    m.ai.expeditionId = undefined;
    onNpcArrivedHome(game, m);
  }
  if (members.length > 1) game.social.sharedExperience(members.map((m) => m.id), finds.length ? 6 : 3, `went to ${e.targetName} together`);
  for (const m of members) game.social.remember(m.id, 'expedition', undefined, finds.length ? 5 : 1, `explored ${e.targetName}`);
}

/** When an NPC reaches camp they share what they saw. */
export function onNpcArrivedHome(game: Game, c: Character): void {
  if (c.pendingExplored.length) {
    for (const key of c.pendingExplored) game.revealAround((key % 1000) * 6 + 3, Math.floor(key / 1000) * 6 + 3, 6);
    c.pendingExplored = [];
  }
  if (c.pendingReports.length) {
    c.pendingReports = [];
    if (game.rng.chance(0.5)) game.say(c, 'We brought back what we could carry.');
  }
}

/** Expedition overdue checks and lost detection, called from ecology hourly. */
export function checkExpeditions(game: Game): void {
  for (const e of game.state.expeditions) {
    if (e.status === 'returned' || e.status === 'lost') continue;
    const alive = e.members.filter((id) => game.state.characters[id]?.alive);
    if (!alive.length) {
      e.status = 'lost';
      game.journal(`Nobody has come back from ${e.targetName}.`, 'expedition');
      continue;
    }
    if (game.state.time > e.expectedReturn + 360 && !e.log.includes('overdue')) {
      e.log.push('overdue');
      const names = alive.map((id) => game.state.characters[id].name).join(' and ');
      game.journal(`${names} ${alive.length > 1 ? 'are' : 'is'} long overdue from ${e.targetName}.`, 'expedition');
    }
  }
}

export { ACTIONS };
export const _test = { chooseDestination, pickFood, TASK_LABEL };
void treatWounds;
