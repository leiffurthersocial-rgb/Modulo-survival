import { itemDef } from '@/content/items';
import { objectDef, isTree } from '@/content/objects';
import { recipeById } from '@/content/recipes';
import { CROPS } from '@/content/crops';
import { ANIMALS } from '@/content/animals';
import { terrainDef } from '@/content/terrain';
import { causeById } from '@/content/lore';
import { clamp } from '@/core/math';
import { makeStack } from '@/gen/characters';
import type { Game } from './game';
import type { ActionState, Character, ItemStack, SkillId, WorldObject } from './types';
import {
  addItem,
  bestTool,
  countItem,
  pourInto,
  removeItem,
  wearTool,
  type Slots,
} from './inventory';
import { addIllness, addInjury, statusMods } from './body';
import { season, dayOf } from './clock';
import { ensureLoot } from './loot';
import { douse } from './fire';
import { computeEnv, shelterAt } from './environment';

export type Anim = 'work' | 'eat' | 'sleep' | 'idle' | 'sit' | 'fish';

export interface ActionDef {
  anim: Anim;
  exertion: number;
  label: string;
  /** For the player: run the clock faster while this action runs. */
  fastForward?: boolean;
  /** Called every tick; returning false cancels the action. */
  tick?: (game: Game, c: Character, a: ActionState, dt: number) => boolean | void;
  complete: (game: Game, c: Character, a: ActionState) => void;
}

// --- helpers -------------------------------------------------------------

export function skillLevel(c: Character, s: SkillId): number {
  return c.skills[s] ?? 0;
}

/** Work speed multiplier from skill and condition. */
export function workSpeed(c: Character, s?: SkillId): number {
  const sk = s ? skillLevel(c, s) : 3;
  const lazy = c.traits.includes('lazy') ? 0.92 : c.traits.includes('hardworking') ? 1.08 : 1;
  return statusMods(c).work * (0.7 + sk * 0.1) * lazy;
}

export function gainSkill(game: Game, c: Character, s: SkillId, amount: number): void {
  const before = Math.floor(c.skills[s]);
  c.skills[s] = Math.min(10, c.skills[s] + amount / (1 + c.skills[s] * 0.6));
  if (Math.floor(c.skills[s]) > before) game.charMessage(c, `${c.name}'s ${s === 'firstAid' ? 'first aid' : s} skill improved.`, 'good');
}

/** Put items in the character's inventory, dropping the rest on the ground. */
export function giveOrDrop(game: Game, c: Character, stack: ItemStack): void {
  const left = addItem(c.inventory, stack);
  if (left) {
    dropItems(game, c.x, c.y, [left]);
    game.charMessage(c, `Not enough room: ${itemDef(left.id).name} left on the ground.`, 'warn');
  }
}

export function dropItems(game: Game, x: number, y: number, stacks: ItemStack[]): void {
  if (!stacks.length) return;
  // add to an existing pile nearby, else create one
  let pile = game.index.nearestOfType('pile', x, y, 1.6);
  if (!pile) {
    const spot = game.index.findTileNear(x, y, 4, (tx, ty) => game.index.isFree(tx, ty));
    if (!spot) {
      game.warn('inventory', 'no free tile to drop items; items lost');
      return;
    }
    pile = game.index.addObject({ type: 'pile', x: spot[0], y: spot[1], inv: new Array(12).fill(null) });
  }
  for (const s of stacks) {
    const left = addItem(pile.inv!, s);
    if (left) {
      pile.inv!.push(left);
    }
  }
}

function accident(game: Game, c: Character, base: number, type: 'cut' | 'bruise' | 'sprain', why: string): void {
  const m = statusMods(c).accident;
  const p = base * m * (1.3 - c.attributes.dexterity * 0.05) * (game.state.mode === 'hardcore' ? 1.4 : 1);
  if (game.rng.chance(p)) addInjury(game, c, type, game.rng.range(0.15, 0.45), why);
}

const yieldMul = (c: Character, s: SkillId) => 0.75 + skillLevel(c, s) * 0.08;

// --- action registry -------------------------------------------------------

export const ACTIONS: Record<string, ActionDef> = {
  chop: {
    anim: 'work', exertion: 2.6, label: 'Chopping', fastForward: true,
    tick: (game, c, a) => {
      if (a.elapsed % 1 < 0.2) game.bus.emit('sound', { id: 'chop', x: c.x, y: c.y });
      return !!game.state.objects[a.targetId!];
    },
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (!o || !isTree(o.type)) return;
      const tool = bestTool(c, 'chop');
      if (tool && wearTool(c, tool.stack, 3)) game.charMessage(c, `The ${itemDef(tool.stack.id).name} broke.`, 'bad');
      const logs = o.type === 'birch' ? 1 : game.rng.int(2, 3);
      const branches = game.rng.int(3, 6);
      const wasType = o.type;
      game.index.changeType(o, 'stump');
      o.regrow = game.state.time + game.rng.range(20, 40) * 1440;
      dropItems(game, o.x + 0.5, o.y + 1.5, [makeStack('log', logs), makeStack('branch', branches)]);
      game.charMessage(c, `The ${objectDef(wasType).name.toLowerCase()} falls. Logs and branches lie on the ground.`, 'info');
      game.bus.emit('sound', { id: 'treeFall', x: o.x, y: o.y });
      gainSkill(game, c, 'construction', 0.08);
      accident(game, c, 0.03, 'cut', 'a slipped axe');
    },
  },
  gather: {
    anim: 'work', exertion: 1.8, label: 'Gathering', fastForward: true,
    tick: (game, _c, a) => !!game.state.objects[a.targetId!],
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (o) harvestObject(game, c, o);
    },
  },
  search: {
    anim: 'work', exertion: 1.3, label: 'Searching',
    tick: (game, _c, a) => !!game.state.objects[a.targetId!],
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (!o) return;
      ensureLoot(game, o);
      o.s2 = 1;
      if (game.isPlayer(c)) game.bus.emit('openContainer', { id: o.id });
    },
  },
  drinkWater: {
    anim: 'eat', exertion: 1, label: 'Drinking',
    complete: (game, c, a) => {
      const contam = waterContamAt(game, a.tx!, a.ty!);
      drinkLiquid(game, c, Math.max(400, (100 - c.needs.hydration) * 25), contam);
    },
  },
  fill: {
    anim: 'work', exertion: 1.1, label: 'Filling containers',
    complete: (game, c, a) => {
      const contam = waterContamAt(game, a.tx!, a.ty!);
      let filled = 0;
      for (const s of c.inventory) {
        if (!s || !itemDef(s.id).liquidCapacity) continue;
        filled += pourInto(s, 100000, contam);
      }
      if (filled > 0) game.charMessage(c, `Filled ${(filled / 1000).toFixed(1)} L of water. It may not be safe to drink untreated.`, 'info');
      else game.charMessage(c, 'You have no empty containers.', 'warn');
      game.bus.emit('sound', { id: 'water', x: c.x, y: c.y });
    },
  },
  wash: {
    anim: 'work', exertion: 1.3, label: 'Washing', fastForward: true,
    complete: (game, c) => {
      const soap = c.inventory.find((s) => s?.id === 'soap' && (s.charge ?? 0) > 0);
      c.needs.hygiene = Math.min(100, c.needs.hygiene + (soap ? 80 : 45));
      if (soap) soap.charge = (soap.charge ?? 1) - 1;
      c.needs.wetness = Math.min(100, c.needs.wetness + 35);
      c.needs.morale = Math.min(100, c.needs.morale + 3);
      game.charMessage(c, soap ? 'You scrub yourself clean with soap. Cold, but good.' : 'You rinse off in the cold water.', 'good');
      gainSkill(game, c, 'survival', 0.01);
    },
  },
  washStation: {
    anim: 'work', exertion: 1.1, label: 'Washing', fastForward: true,
    complete: (game, c) => {
      const used = useWaterFromInventory(c, 1000);
      if (used < 300) {
        game.charMessage(c, 'You need about a litre of water in a container to wash here.', 'warn');
        return;
      }
      const soap = c.inventory.find((s) => s?.id === 'soap' && (s.charge ?? 0) > 0);
      c.needs.hygiene = Math.min(100, c.needs.hygiene + (soap ? 70 : 40));
      if (soap) soap.charge = (soap.charge ?? 1) - 1;
      c.needs.wetness = Math.min(100, c.needs.wetness + 8);
      game.charMessage(c, 'You wash at the basin.', 'good');
    },
  },
  drinkItem: {
    anim: 'eat', exertion: 1, label: 'Drinking',
    complete: (game, c, a) => {
      const s = c.inventory[a.data!.slot as number];
      if (!s?.liquid || s.liquid.ml <= 0) return;
      const ml = Math.min(s.liquid.ml, (a.data!.ml as number) ?? 400);
      s.liquid.ml -= ml;
      drinkLiquid(game, c, ml, s.liquid.contam);
      if (s.liquid.ml <= 0) s.liquid.contam = 0;
    },
  },
  eat: {
    anim: 'eat', exertion: 1, label: 'Eating',
    complete: (game, c, a) => {
      const slots = (a.data!.from === 'container' ? game.state.objects[a.targetId!]?.inv : c.inventory) as Slots | undefined;
      if (!slots) return;
      const s = slots[a.data!.slot as number];
      if (!s || s.id !== a.data!.item) return;
      eatStack(game, c, slots, a.data!.slot as number);
    },
  },
  sleep: {
    anim: 'sleep', exertion: 0.75, label: 'Sleeping',
    tick: (game, c) => {
      game.updateSleep(c);
      return c.sleeping;
    },
    complete: () => {},
  },
  relieve: {
    anim: 'work', exertion: 1, label: 'Using the latrine',
    complete: (game, c, a) => {
      const o = a.targetId ? game.state.objects[a.targetId] : undefined;
      game.relieve(c, o && o.type === 'latrine' ? 'latrine' : 'open');
    },
  },
  addFuel: {
    anim: 'work', exertion: 1.2, label: 'Tending fire',
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (!o) return;
      const item = a.data!.item as string;
      const qty = Math.min(a.data!.qty as number, countItem(c.inventory, item));
      const def = objectDef(o.type).fire!;
      const per = itemDef(item).fuel ?? 0;
      const room = Math.max(0, Math.floor((def.maxFuel - (o.s ?? 0)) / per));
      const n = Math.min(qty, Math.max(1, room));
      removeItem(c.inventory, item, n);
      o.s = Math.min(def.maxFuel, (o.s ?? 0) + per * n);
      game.charMessage(c, `Added ${n} ${itemDef(item).name.toLowerCase()} to the fire.`, 'info');
    },
  },
  lightFire: {
    anim: 'work', exertion: 1.2, label: 'Lighting fire',
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (!o) return;
      lightFire(game, c, o);
    },
  },
  boilWater: {
    anim: 'work', exertion: 1.1, label: 'Boiling water', fastForward: true,
    tick: (game, _c, a) => !!game.state.objects[a.targetId!]?.lit,
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (!o?.lit) return;
      const pot = bestTool(c, 'boil') ?? campToolNear(game, c, 'boil');
      if (!pot) return;
      let budget = 2000;
      let done = 0;
      const containers = c.inventory.filter((s) => s?.liquid && s.liquid.ml > 0 && s.liquid.contam > 0.01) as ItemStack[];
      for (const s of containers) {
        if (budget <= 0) break;
        const ml = Math.min(budget, s.liquid!.ml);
        // boiling fully treats the processed share
        s.liquid!.contam = s.liquid!.contam * (1 - ml / s.liquid!.ml);
        budget -= ml;
        done += ml;
      }
      o.s = Math.max(1, (o.s ?? 0) - 12);
      game.charMessage(c, done > 0 ? `Boiled ${(done / 1000).toFixed(1)} L of water. It is safe to drink.` : 'Nothing to boil.', done > 0 ? 'good' : 'info');
      gainSkill(game, c, 'survival', 0.03);
    },
  },
  craft: {
    anim: 'work', exertion: 1.4, label: 'Crafting', fastForward: true,
    complete: (game, c, a) => {
      const r = recipeById(a.data!.recipe as string);
      if (!r) return;
      craftComplete(game, c, r.id);
    },
  },
  build: {
    anim: 'work', exertion: 2.2, label: 'Building', fastForward: true,
    tick: (game, c, a, dt) => {
      const o = game.state.objects[a.targetId!];
      if (!o || o.build === undefined) return false;
      const d = objectDef(o.type).build!;
      const tool = d.tool ? bestTool(c, d.tool) : undefined;
      if (d.tool && !tool) {
        game.charMessage(c, `You need a tool for this (${d.tool}).`, 'warn');
        return false;
      }
      const speed = workSpeed(c, 'construction') * (tool ? 0.5 + tool.power * 0.5 : 1);
      o.build += (dt * speed) / d.minutes;
      if (a.elapsed % 1 < 0.25) game.bus.emit('sound', { id: 'build', x: c.x, y: c.y });
      if (o.build >= 1) {
        game.completeConstruction(o, c);
        return false;
      }
      return true;
    },
    complete: (game, c) => {
      gainSkill(game, c, 'construction', 0.05);
    },
  },
  salvage: {
    anim: 'work', exertion: 2, label: 'Salvaging', fastForward: true,
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (!o) return;
      const out: ItemStack[] = [];
      if (o.type === 'car_wreck') out.push(makeStack('scrap_metal', game.rng.int(2, 4)));
      else if (o.type === 'fence') out.push(makeStack('plank', 1), makeStack('nails', game.rng.int(2, 5)));
      else if (o.type === 'hay') out.push(makeStack('fiber', 20));
      else {
        out.push(makeStack('plank', game.rng.int(2, 3)), makeStack('nails', game.rng.int(4, 10)));
        if (o.type === 'bed') out.push(makeStack('cloth', game.rng.int(2, 4)));
      }
      if (o.inv) out.push(...(o.inv.filter(Boolean) as ItemStack[]));
      game.index.removeObject(o.id);
      dropItems(game, o.x + 0.5, o.y + 0.5, out);
      game.charMessage(c, `Salvaged the ${objectDef(o.type).name.toLowerCase()}.`, 'info');
      gainSkill(game, c, 'mechanics', 0.05);
      accident(game, c, 0.02, 'cut', 'a splinter of sheet metal');
    },
  },
  fish: {
    anim: 'fish', exertion: 1.1, label: 'Fishing', fastForward: true,
    tick: (game, c, a, dt) => {
      const rod = bestTool(c, 'fish');
      if (!rod) return false;
      const label = game.index.waterLabel[a.ty! * game.index.w + a.tx!];
      const key = String(label);
      const stock = game.fishStock(key);
      const hour = (game.state.time % 1440) / 60;
      const dawnDusk = hour < 8 || hour > 18 ? 1.4 : 1;
      const s = season(game.state.time);
      const seasonMod = s.id === 'winter' ? 0.4 : s.id === 'summer' ? 1.1 : 1;
      const weatherMod = game.state.weather.current === 'lightRain' ? 1.25 : game.state.weather.current === 'thunderstorm' ? 0.3 : 1;
      const density = Math.min(1.2, stock / Math.max(6, game.fishCapacity(key) * 0.6));
      const p = 0.03 * (0.5 + skillLevel(c, 'fishing') * 0.12) * dawnDusk * seasonMod * weatherMod * density * (0.6 + c.attributes.dexterity * 0.06);
      if (game.rng.chance(p * dt)) {
        game.state.fishStock[key] = Math.max(0, stock - 1);
        giveOrDrop(game, c, makeStack('raw_fish', 1));
        game.charMessage(c, 'Something bites. You land a fish.', 'good');
        gainSkill(game, c, 'fishing', 0.12);
        if (wearTool(c, rod.stack)) game.charMessage(c, 'The line snapped. The rod is useless now.', 'bad');
        a.data = { ...(a.data ?? {}), caught: ((a.data?.caught as number) ?? 0) + 1 };
        if (!game.isPlayer(c) && ((a.data.caught as number) ?? 0) >= 3) return false;
      }
      return true;
    },
    complete: (game, c, a) => {
      if (!a.data?.caught) game.charMessage(c, 'Nothing is biting.', 'info');
      gainSkill(game, c, 'fishing', 0.02);
    },
  },
  butcher: {
    anim: 'work', exertion: 1.6, label: 'Butchering', fastForward: true,
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (!o) return;
      const def = ANIMALS[o.label ?? 'deer'];
      const knife = bestTool(c, 'cut');
      const n = Math.max(1, Math.round((def?.meat ?? 3) * (knife ? 0.7 + knife.power * 0.3 : 0.5) * yieldMul(c, 'hunting')));
      game.index.removeObject(o.id);
      dropItems(game, o.x + 0.5, o.y + 0.5, [makeStack('raw_meat', n)]);
      if (knife) wearTool(c, knife.stack, 3);
      game.charMessage(c, `You butcher the ${def?.name.toLowerCase() ?? 'animal'}: ${n} portions of meat.`, 'good');
      c.needs.hygiene = Math.max(0, c.needs.hygiene - 20);
      gainSkill(game, c, 'hunting', 0.1);
      accident(game, c, 0.03, 'cut', 'a slipping knife');
    },
  },
  treat: {
    anim: 'work', exertion: 1, label: 'Treating wounds',
    complete: (game, c, a) => {
      const patient = game.state.characters[(a.data?.patient as string) ?? c.id] ?? c;
      treatWounds(game, c, patient, a.data?.kind as string);
    },
  },
  plant: {
    anim: 'work', exertion: 1.6, label: 'Planting', fastForward: true,
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      const seedItem = a.data!.item as string;
      if (!o || o.crop || countItem(c.inventory, seedItem) <= 0) return;
      const cropId = itemDef(seedItem).seed!;
      removeItem(c.inventory, seedItem, 1);
      o.crop = { id: cropId, growth: 0, water: 0.6, health: 1, plantedDay: dayOf(game.state.time) };
      game.charMessage(c, `Planted ${CROPS[cropId].name.toLowerCase()}.`, 'good');
      gainSkill(game, c, 'farming', 0.06);
    },
  },
  waterCrop: {
    anim: 'work', exertion: 1.2, label: 'Watering',
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (!o?.crop) return;
      const used = useWaterFromInventory(c, 1000, true);
      if (used <= 0) return game.charMessage(c, 'You have no water to spare.', 'warn');
      o.crop.water = clamp(o.crop.water + used / 1000, 0, 1);
      game.charMessage(c, 'The soil darkens as it soaks up the water.', 'info');
    },
  },
  harvest: {
    anim: 'work', exertion: 1.6, label: 'Harvesting', fastForward: true,
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (!o?.crop || o.crop.growth < 1) return;
      const def = CROPS[o.crop.id];
      const [item, lo, hi] = def.yield;
      const n = Math.max(1, Math.round(game.rng.int(lo, hi) * o.crop.health * yieldMul(c, 'farming')));
      o.crop = undefined;
      giveOrDrop(game, c, makeStack(item, n));
      game.charMessage(c, `Harvested ${n} ${itemDef(item).name.toLowerCase()}.`, 'good');
      game.journal(`${c.name} harvested ${def.name.toLowerCase()} from the garden.`, 'camp');
      gainSkill(game, c, 'farming', 0.15);
    },
  },
  collectRain: {
    anim: 'work', exertion: 1, label: 'Collecting water',
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (!o?.water) return;
      let moved = 0;
      for (const s of c.inventory) {
        if (!s || !itemDef(s.id).liquidCapacity || o.water.ml <= 0) continue;
        const n = pourInto(s, o.water.ml, o.water.contam);
        o.water.ml -= n;
        moved += n;
      }
      game.charMessage(c, moved > 0 ? `Collected ${(moved / 1000).toFixed(1)} L of rainwater.` : 'No room in your containers.', 'info');
    },
  },
  filterWater: {
    anim: 'work', exertion: 1, label: 'Filtering water', fastForward: true,
    complete: (game, c) => {
      let n = 0;
      for (const s of c.inventory) {
        if (s?.liquid && s.liquid.ml > 0 && s.liquid.contam > 0.02) {
          s.liquid.contam *= 0.2;
          n += s.liquid.ml;
        }
      }
      game.charMessage(c, n ? `Filtered ${(n / 1000).toFixed(1)} L. Much cleaner, though boiling is safer.` : 'You have no dirty water to filter.', 'info');
    },
  },
  checkSnare: {
    anim: 'work', exertion: 1.2, label: 'Checking snare',
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (!o) return;
      if (o.s2 === 1) {
        o.s2 = 0;
        const knife = bestTool(c, 'cut');
        giveOrDrop(game, c, makeStack('raw_meat', knife ? 2 : 1));
        game.charMessage(c, 'A hare is caught in the snare. You clean it and reset the snare.', 'good');
        gainSkill(game, c, 'trapping', 0.15);
      } else game.charMessage(c, 'The snare is empty.', 'info');
    },
  },
  climb: {
    anim: 'work', exertion: 2, label: 'Looking out', fastForward: true,
    complete: (game, c, a) => {
      game.revealAround(a.tx!, a.ty!, 30);
      game.charMessage(c, 'From the stand you can see far over the treetops. You note what you see on the map.', 'good');
      gainSkill(game, c, 'navigation', 0.1);
    },
  },
  listenRadio: {
    anim: 'sit', exertion: 1, label: 'Cranking the radio', fastForward: true,
    complete: (game, c) => {
      const cause = causeById(game.state.lore.cause);
      const line = game.rng.pick(cause.radio);
      game.charMessage(c, `Through the static: "${line}"`, 'info');
      game.journal(`Radio fragment: "${line}"`, 'lore');
    },
  },
  rest: {
    anim: 'sit', exertion: 0.9, label: 'Resting',
    tick: (_game, c) => {
      c.needs.stress = Math.max(0, c.needs.stress - 0.03);
      return true;
    },
    complete: () => {},
  },
  douse: {
    anim: 'work', exertion: 1.5, label: 'Dousing flames',
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (!o) return;
      const used = useWaterFromInventory(c, 1000, true);
      if (used <= 0) return game.charMessage(c, 'You have no water.', 'warn');
      if (douse(game, o, used)) game.charMessage(c, 'The flames hiss out.', 'good');
      else game.charMessage(c, 'The fire is still burning. You need more water.', 'warn');
    },
  },
  pickupBag: {
    anim: 'work', exertion: 1.5, label: 'Packing up',
    complete: (game, c, a) => {
      const o = game.state.objects[a.targetId!];
      if (!o || o.type !== 'supply_bag') return;
      const bag = makeStack('duffel_bag', 1, { contents: o.inv ?? [] });
      const free = c.inventory.findIndex((s) => !s);
      if (free < 0) return game.charMessage(c, 'Your hands are full: free an inventory slot.', 'warn');
      c.inventory[free] = bag;
      game.index.removeObject(o.id);
      game.charMessage(c, 'You shoulder the heavy supply bag.', 'info');
    },
  },
};

// --- shared action implementations ------------------------------------------

export function startAction(game: Game, c: Character, type: string, duration: number, opts: Partial<ActionState> = {}): void {
  if (!ACTIONS[type]) {
    game.warn('actions', `unknown action ${type}`);
    return;
  }
  c.action = { type, duration: Math.max(0.2, duration), elapsed: 0, ...opts };
  c.moving = false;
}

export function waterContamAt(game: Game, x: number, y: number): number {
  const t = game.index.terrainAt(x, y);
  const base = terrainDef(t).contam ?? 0.3;
  const cell = game.index.contamAt(x, y);
  return clamp(base + cell * 0.8, 0, 1);
}

export function drinkLiquid(game: Game, c: Character, ml: number, contam: number): void {
  const room = (100 - c.needs.hydration) * 25;
  const drank = Math.min(ml, Math.max(150, room));
  c.needs.hydration = Math.min(100, c.needs.hydration + drank / 25);
  c.needs.bladder = Math.min(100, c.needs.bladder + drank / 60);
  if (contam > 0.02) {
    const p = contam * 0.28 * Math.min(1.5, drank / 400) * (1.25 - c.attributes.constitution * 0.04) * (game.state.mode === 'hardcore' ? 1.4 : 1);
    if (game.rng.chance(p)) addIllness(game, c, 'stomachBug', 0.3 + contam * 0.4, 'contaminated water');
  }
  if (game.state.weather.temp < 3 && contam >= 0) c.needs.bodyTemp -= drank / 4000;
}

/** Take water from any inventory containers (dirtiest first when allowDirty). */
export function useWaterFromInventory(c: Character, ml: number, allowDirty = false): number {
  const list = c.inventory
    .filter((s): s is ItemStack => !!s?.liquid && s.liquid.ml > 0)
    .sort((a, b) => (allowDirty ? b.liquid!.contam - a.liquid!.contam : a.liquid!.contam - b.liquid!.contam));
  let used = 0;
  for (const s of list) {
    const n = Math.min(ml - used, s.liquid!.ml);
    s.liquid!.ml -= n;
    used += n;
    if (used >= ml) break;
  }
  return used;
}

export function eatStack(game: Game, c: Character, slots: Slots, slot: number): void {
  const s = slots[slot];
  if (!s) return;
  const d = itemDef(s.id);
  const f = d.food;
  if (!f) return;
  if (f.needsOpen && !bestTool(c, 'open') && !bestTool(c, 'cut') && !campToolNear(game, c, 'cut')) {
    game.charMessage(c, 'You need a knife to open this.', 'warn');
    return;
  }
  const q = s.q ?? 1;
  s.qty -= 1;
  if (s.qty <= 0) slots[slot] = null;
  const kcal = f.kcal * (q < 0.15 ? 0.7 : 1);
  c.needs.satiety = Math.min(100, c.needs.satiety + kcal / 20);
  c.needs.hydration = clamp(c.needs.hydration + (f.hydration ?? 0), 0, 100);
  c.needs.morale = clamp(c.needs.morale + (f.morale ?? 0) * (q > 0.4 ? 1 : 0.3), 0, 100);
  if (f.warming) c.needs.bodyTemp = Math.min(37.2, c.needs.bodyTemp + f.warming * 0.3);
  let risk = (f.risk ?? 0) + (q < 0.45 ? (0.45 - q) * 1.4 : 0);
  if (d.id.startsWith('cooked') || d.id.startsWith('roasted') || d.id.startsWith('baked')) risk *= 1 - skillLevel(c, 'cooking') * 0.05;
  if (game.state.mode === 'hardcore') risk *= 1.3;
  if (risk > 0 && game.rng.chance(risk)) {
    addIllness(game, c, 'foodPoisoning', 0.25 + risk * 0.5, d.id === 'mushrooms_unknown' ? 'bad mushrooms' : q < 0.45 ? 'spoiled food' : 'undercooked food');
  }
  game.charMessage(c, `You eat the ${d.name.toLowerCase()}.${q < 0.3 ? ' It tastes off.' : ''}`, 'info');
  game.bus.emit('sound', { id: 'eat', x: c.x, y: c.y });
}

export function lightFire(game: Game, c: Character, o: WorldObject): boolean {
  if (o.lit) return true;
  if ((o.s ?? 0) <= 0) {
    game.charMessage(c, 'There is nothing to burn. Add branches or firewood first.', 'warn');
    return false;
  }
  const w = game.state.weather;
  const sheltered = !!game.index.buildingAt(o.x, o.y) || !!shelterAt(game.index, o.x + 0.5, o.y + 0.5);
  const weatherMod = sheltered ? 1 : 1 - w.precipitation * 0.65 - Math.max(0, w.wind - 6) * 0.04;
  // live embers: blow the fire back to life without matches
  if ((o.embers ?? 0) > game.state.time) {
    if (game.rng.chance(clamp(0.75 * weatherMod + skillLevel(c, 'survival') * 0.03, 0.2, 0.95))) {
      o.lit = true;
      o.embers = undefined;
      game.charMessage(c, 'You blow on the embers until the new wood catches.', 'good');
      gainSkill(game, c, 'survival', 0.04);
      return true;
    }
    game.charMessage(c, 'The embers smoke but do not catch. Try again.', 'warn');
    return false;
  }
  const ign = bestTool(c, 'ignite');
  if (!ign) {
    // last resort: friction fire, only for someone who knows how
    const sk = skillLevel(c, 'survival');
    if (sk < 4) {
      game.charMessage(c, 'You need matches or a lighter.', 'warn');
      return false;
    }
    const p = clamp((sk - 3) * 0.07 * weatherMod * (1 - w.precipitation) * (0.5 + w.dryness), 0.02, 0.5);
    c.needs.stamina = Math.max(0, c.needs.stamina - 25);
    if (game.rng.chance(p)) {
      o.lit = true;
      game.charMessage(c, 'After a long struggle with a hand drill, a coal forms. The fire catches.', 'good');
      gainSkill(game, c, 'survival', 0.15);
      return true;
    }
    game.charMessage(c, 'You work the hand drill until your palms burn. Nothing.', 'warn');
    gainSkill(game, c, 'survival', 0.03);
    return false;
  }
  ign.stack.charge = Math.max(0, (ign.stack.charge ?? 1) - 1);
  const wetHands = c.needs.wetness > 60 && ign.stack.id === 'matches' ? 0.7 : 1;
  const p = clamp((0.45 + skillLevel(c, 'survival') * 0.08) * ign.power * weatherMod * wetHands, 0.05, 0.97);
  if (game.rng.chance(p)) {
    o.lit = true;
    game.charMessage(c, 'The kindling catches. The fire is burning.', 'good');
    game.bus.emit('sound', { id: 'ignite', x: o.x, y: o.y });
    gainSkill(game, c, 'survival', 0.08);
    if (!game.state.hints.includes('firstFire')) game.state.hints.push('firstFire');
    return true;
  }
  game.charMessage(c, ign.stack.id === 'matches' ? 'The match sputters out. Try again.' : 'The flame will not catch. Try again.', 'warn');
  gainSkill(game, c, 'survival', 0.02);
  if (ign.stack.charge <= 0) {
    const i = c.inventory.indexOf(ign.stack);
    if (i >= 0) c.inventory[i] = null;
    game.charMessage(c, ign.stack.id === 'matches' ? 'That was the last match.' : 'The lighter is empty.', 'bad');
  }
  return false;
}

export function campToolNear(game: Game, c: Character, tag: 'boil' | 'cut'): { stack: ItemStack; power: number } | undefined {
  // a pot in a nearby camp container can be used at the fire
  let found: { stack: ItemStack; power: number } | undefined;
  game.index.objectsNear(c.x, c.y, 6, (o) => {
    if (found || !o.inv) return;
    for (const s of o.inv) if (s && itemDef(s.id).tool?.tags.includes(tag)) found = { stack: s, power: 1 };
  });
  return found;
}

export function craftComplete(game: Game, c: Character, recipeId: string): boolean {
  const r = recipeById(recipeId);
  if (!r) return false;
  for (const [id, n] of Object.entries(r.inputs)) {
    if (countItem(c.inventory, id) < n) {
      game.charMessage(c, `Missing ${itemDef(id).name}.`, 'warn');
      return false;
    }
  }
  if (r.tool === 'boil') {
    const water = useWaterFromInventory(c, 1000, true);
    if (water < 500) {
      game.charMessage(c, 'You need about a litre of water for this.', 'warn');
      return false;
    }
  }
  for (const [id, n] of Object.entries(r.inputs)) removeItem(c.inventory, id, n);
  const sk = skillLevel(c, r.skill);
  for (const [id, n] of Object.entries(r.outputs)) {
    const s = makeStack(id, n);
    if (s.q !== undefined && itemDef(id).tool) s.q = clamp(0.55 + sk * 0.06, 0.4, 1);
    giveOrDrop(game, c, s);
  }
  const tool = r.tool && r.tool !== 'boil' ? bestTool(c, r.tool) : undefined;
  if (tool) wearTool(c, tool.stack);
  gainSkill(game, c, r.skill, 0.08);
  game.charMessage(c, `${r.name}: done.`, 'good');
  if (r.tool === 'cut') accident(game, c, 0.012, 'cut', 'a slipped knife');
  return true;
}

export function treatWounds(game: Game, medic: Character, patient: Character, kind?: string): void {
  const h = patient.health;
  const skill = skillLevel(medic, 'firstAid');
  if (kind === 'painkiller') {
    if (removeItem(medic.inventory, 'painkillers', 1).length) {
      patient.painkillerUntil = game.state.time + 300;
      game.charMessage(medic, 'The painkillers take the edge off.', 'info');
    }
    return;
  }
  if (kind === 'antiseptic') {
    const bottle = medic.inventory.find((s) => s?.id === 'antiseptic' && (s.charge ?? 0) > 0);
    if (!bottle) return;
    bottle.charge = (bottle.charge ?? 1) - 1;
    if ((bottle.charge ?? 0) <= 0) medic.inventory[medic.inventory.indexOf(bottle)] = null;
    for (const inj of h.injuries) inj.infection = Math.max(0, inj.infection - 0.45 - skill * 0.03);
    game.charMessage(medic, 'You clean the wounds. It stings.', 'info');
    gainSkill(game, medic, 'firstAid', 0.05);
    return;
  }
  const target = h.injuries.filter((i) => !i.bandaged).sort((a, b) => b.bleeding - a.bleeding || b.severity - a.severity)[0];
  if (!target) return;
  if (!removeItem(medic.inventory, 'bandage', 1).length) {
    game.charMessage(medic, 'You have no bandages.', 'warn');
    return;
  }
  target.bandaged = true;
  target.bleeding *= Math.max(0.1, 0.5 - skill * 0.05);
  target.infection = Math.max(0, target.infection - 0.05 - skill * 0.01);
  gainSkill(game, medic, 'firstAid', 0.08);
  if (medic !== patient) {
    game.charMessage(medic, `You bandage ${patient.name}'s wound.`, 'good');
    game.social.helped(medic.id, patient.id, 'treated my wound', 12);
  } else game.charMessage(medic, 'You bandage the wound.', 'good');
}

/** Harvest a gatherable world object (plants, deadfall, stones). */
export function harvestObject(game: Game, c: Character, o: WorldObject): void {
  const s = season(game.state.time);
  const mul = yieldMul(c, 'foraging') * s.forage;
  const give = (id: string, n: number) => {
    if (n > 0) giveOrDrop(game, c, makeStack(id, n));
  };
  const deplete = (days: number) => {
    o.s = 0;
    o.regrow = game.state.time + days * 1440 * game.rng.range(0.8, 1.3);
  };
  switch (o.type) {
    case 'deadfall': {
      give('branch', game.rng.int(2, 4));
      o.s = (o.s ?? 3) - 1;
      if ((o.s ?? 0) <= 0) game.index.removeObject(o.id);
      break;
    }
    case 'rocks': {
      give('stone', game.rng.int(1, 2));
      o.s = (o.s ?? 2) - 1;
      if ((o.s ?? 0) <= 0) game.index.removeObject(o.id);
      break;
    }
    case 'fallen_log': {
      if (!bestTool(c, 'chop') && !bestTool(c, 'saw')) return game.charMessage(c, 'You need an axe or saw to cut this log.', 'warn');
      dropItems(game, o.x + 0.5, o.y + 1.2, [makeStack('log', 2), makeStack('branch', game.rng.int(1, 3))]);
      game.index.removeObject(o.id);
      game.charMessage(c, 'You cut the fallen log into manageable lengths.', 'info');
      break;
    }
    case 'bilberry':
    case 'bramble': {
      if (!o.s) return game.charMessage(c, 'No ripe berries right now.', 'info');
      give(o.type === 'bilberry' ? 'bilberries' : 'blackberries', Math.round(game.rng.int(2, 5) * mul));
      deplete(6);
      if (o.type === 'bramble' && game.rng.chance(0.15)) addInjury(game, c, 'cut', 0.08, 'bramble thorns');
      gainSkill(game, c, 'foraging', 0.05);
      break;
    }
    case 'hazel': {
      if (o.s && s.nuts) {
        give('hazelnuts', Math.round(game.rng.int(2, 4) * mul));
        deplete(20);
      } else {
        give('branch', game.rng.int(1, 3));
        o.s = 0;
      }
      gainSkill(game, c, 'foraging', 0.04);
      break;
    }
    case 'wild_garlic': {
      if (!o.s) return game.charMessage(c, 'The garlic has been picked here.', 'info');
      give('wild_garlic', Math.round(game.rng.int(2, 4) * mul));
      deplete(8);
      gainSkill(game, c, 'foraging', 0.04);
      break;
    }
    case 'mushrooms': {
      if (!o.s) return game.charMessage(c, 'Only a few rotten stems remain.', 'info');
      const sk = skillLevel(c, 'foraging');
      const edible = game.rng.chance(0.6);
      const n = Math.round(game.rng.int(2, 4) * mul);
      if (edible) give(sk >= 3 || game.rng.chance(0.3) ? 'chanterelles' : 'mushrooms_unknown', n);
      else if (sk >= 4 && game.rng.chance(0.4 + sk * 0.08)) game.charMessage(c, 'You recognise these as poisonous and leave them.', 'info');
      else give('mushrooms_unknown', n);
      deplete(5);
      gainSkill(game, c, 'foraging', 0.06);
      break;
    }
    case 'nettles':
    case 'tall_grass':
    case 'reeds': {
      if (!o.s) return game.charMessage(c, 'Nothing useful left here yet.', 'info');
      give('fiber', game.rng.int(2, 4));
      deplete(3);
      if (o.type === 'nettles' && !c.equipment.hands) game.charMessage(c, 'The nettles sting your hands.', 'info');
      gainSkill(game, c, 'foraging', 0.02);
      break;
    }
    case 'bush':
    case 'fern': {
      give('branch', 1);
      if (o.type === 'fern') give('fiber', 1);
      game.index.removeObject(o.id);
      break;
    }
    case 'sapling': {
      give('branch', 2);
      game.index.removeObject(o.id);
      break;
    }
    case 'stump': {
      give('branch', 1);
      break;
    }
    case 'spruce':
    case 'pine':
    case 'beech':
    case 'birch':
    case 'oak': {
      if ((o.s2 ?? 0) >= 2) return game.charMessage(c, 'No more dead branches within reach on this tree.', 'info');
      o.s2 = (o.s2 ?? 0) + 1;
      give('branch', game.rng.int(1, 2));
      break;
    }
    default:
      break;
  }
  game.bus.emit('sound', { id: 'gather', x: c.x, y: c.y });
}

/** Gathering duration by object type. */
export function gatherMinutes(type: string): number {
  switch (type) {
    case 'deadfall': return 4;
    case 'rocks': return 5;
    case 'fallen_log': return 25;
    case 'mushrooms': return 4;
    case 'wild_garlic': return 4;
    case 'bilberry': case 'bramble': return 8;
    case 'hazel': return 8;
    default: return 5;
  }
}

/** Is this object currently harvestable, and what would it give? */
export function gatherLabel(game: Game, o: WorldObject): string | null {
  const s = season(game.state.time);
  switch (o.type) {
    case 'deadfall': return 'Gather branches';
    case 'rocks': return 'Collect stones';
    case 'fallen_log': return 'Cut up log';
    case 'bilberry': return o.s ? 'Pick bilberries' : null;
    case 'bramble': return o.s ? 'Pick blackberries' : null;
    case 'hazel': return o.s && s.nuts ? 'Gather hazelnuts' : 'Cut hazel rods';
    case 'wild_garlic': return o.s ? 'Pick wild garlic' : null;
    case 'mushrooms': return o.s ? 'Pick mushrooms' : null;
    case 'nettles': case 'tall_grass': case 'reeds': return o.s ? 'Strip fibre' : null;
    case 'bush': return 'Cut branches';
    case 'fern': return 'Cut ferns';
    case 'sapling': return 'Cut sapling';
    default: return null;
  }
}

export function isIndoorsOrSheltered(game: Game, x: number, y: number): boolean {
  const env = computeEnv(game.state, game.index, x, y);
  return env.indoor || !!env.shelter;
}

