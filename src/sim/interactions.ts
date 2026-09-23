import { itemDef } from '@/content/items';
import { objectDef, isTree } from '@/content/objects';
import { isWater } from '@/content/terrain';
import { CROPS } from '@/content/crops';
import { ANIMALS } from '@/content/animals';
import type { Game } from './game';
import type { Animal, Character, EquipSlot, ItemStack, WorldObject } from './types';
import {
  addItem,
  bestTool,
  countItem,
  liquidTotal,
  removeAt,
  resizeInventory,
  cleanestWater,
} from './inventory';
import {
  dropItems,
  gatherLabel,
  gatherMinutes,
  startAction,
  workSpeed,
  waterContamAt,
} from './actions';
import { dismantle } from './building';
import { clothingDirt } from './body';
import { attackAnimal } from './wildlife';
import { docById, readDoc } from './loot';
import { makeStack } from '@/gen/characters';
import { campToolNear, skillLevel } from './actions';

export type Target =
  | { kind: 'object'; obj: WorldObject }
  | { kind: 'water'; x: number; y: number }
  | { kind: 'character'; char: Character }
  | { kind: 'animal'; animal: Animal };

export interface Interaction {
  id: string;
  label: string;
  enabled: boolean;
  reason?: string;
  run: () => void;
}

export const REACH = 1.7;

/**
 * What the character is facing: the first thing along a short line straight
 * ahead, within reach. Nothing beside or behind them is picked up, so E always
 * acts on what is in front. With a tile given (a click), that spot is used.
 */
export function findTarget(game: Game, c: Character, tileX?: number, tileY?: number): Target | undefined {
  if (tileX !== undefined && tileY !== undefined) return targetAt(game, c, tileX, tileY);
  const fx = c.facing === 'left' ? -1 : c.facing === 'right' ? 1 : 0;
  const fy = c.facing === 'up' ? -1 : c.facing === 'down' ? 1 : 0;
  // the body's centre sits a little above the feet; facing up reaches from there
  const ox = c.x;
  const oy = c.y - 0.2;
  for (let d = 0.35; d <= REACH + 0.01; d += 0.2) {
    const px = ox + fx * d;
    const py = oy + fy * d;
    for (const a of Object.values(game.state.animals)) {
      if (a.state === 'dead') continue;
      if (Math.hypot(a.x - px, a.y - 0.3 - py) < 0.6) return { kind: 'animal', animal: a };
    }
    for (const o of game.livingCharacters()) {
      if (o === c) continue;
      if (Math.abs(o.x - px) < 0.45 && py < o.y + 0.25 && py > o.y - 1.3) return { kind: 'character', char: o };
    }
    const o = game.index.objAt(px, py);
    if (o && o.type !== 'flowers') return { kind: 'object', obj: o };
    if (isWater(game.index.terrainAt(px, py))) return { kind: 'water', x: Math.floor(px), y: Math.floor(py) };
    // a wall or anything solid ends the line of reach
    if (game.index.isSolid(Math.floor(px), Math.floor(py))) break;
  }
  // standing on something low (a pile, a bed, a crop): that counts as in front too
  const under = game.index.objAt(c.x, c.y);
  if (under && under.type !== 'flowers' && !objectDef(under.type).solid) return { kind: 'object', obj: under };
  if (isWater(game.index.terrainAt(c.x, c.y))) return { kind: 'water', x: Math.floor(c.x), y: Math.floor(c.y) };
  return undefined;
}

/** The object or water at a given spot, if the character can reach it. */
function targetAt(game: Game, c: Character, x: number, y: number): Target | undefined {
  const o = game.index.objAt(x, y);
  if (o && o.type !== 'flowers' && def2(o, c) <= REACH + 0.6) return { kind: 'object', obj: o };
  if (isWater(game.index.terrainAt(x, y)) && Math.hypot(Math.floor(x) + 0.5 - c.x, Math.floor(y) + 0.5 - c.y) <= REACH + 0.6) {
    return { kind: 'water', x: Math.floor(x), y: Math.floor(y) };
  }
  return undefined;
}

function def2(o: WorldObject, c: Character): number {
  const d = objectDef(o.type);
  const w = d.w ?? 1;
  const h = d.h ?? 1;
  const cx = Math.max(o.x, Math.min(c.x, o.x + w));
  const cy = Math.max(o.y, Math.min(c.y, o.y + h));
  return Math.hypot(cx - c.x, cy - c.y);
}

export function targetName(game: Game, t: Target): string {
  switch (t.kind) {
    case 'object': {
      const o = t.obj;
      if (o.type === 'corpse') return `${o.label ?? 'Someone'}'s body`;
      if (o.type === 'carcass') return `${ANIMALS[o.label ?? '']?.name ?? 'Animal'} carcass`;
      const n = objectDef(o.type).name;
      if (o.build !== undefined) return `${n} (${Math.round(o.build * 100)}% built)`;
      if (o.burning) return `${n} (burning)`;
      return n;
    }
    case 'water':
      return game.index.terrainAt(t.x, t.y) === 12 ? 'Stream' : 'Water';
    case 'character':
      return t.char.name;
    case 'animal':
      return ANIMALS[t.animal.species]?.name ?? t.animal.species;
  }
}

export function getInteractions(game: Game, c: Character, t: Target): Interaction[] {
  const out: Interaction[] = [];
  const add = (id: string, label: string, run: () => void, enabled = true, reason?: string) => out.push({ id, label, run, enabled, reason });
  const ws = (s?: Parameters<typeof workSpeed>[1]) => workSpeed(c, s);

  if (t.kind === 'water') {
    const contam = waterContamAt(game, t.x, t.y);
    add('drink', 'Drink directly', () => startAction(game, c, 'drinkWater', 2, { tx: t.x, ty: t.y }));
    const hasContainer = c.inventory.some((s) => s && itemDef(s.id).liquidCapacity);
    add('fill', 'Fill containers', () => startAction(game, c, 'fill', 3, { tx: t.x, ty: t.y }), hasContainer, 'No containers');
    add('wash', 'Wash', () => startAction(game, c, 'wash', 10 / ws()));
    const grime = clothingDirt(c);
    add('washClothes', 'Wash clothes', () => startAction(game, c, 'washClothes', 20 / ws()), grime > 0.1, 'Clothes are clean');
    add('fish', 'Fish', () => startAction(game, c, 'fish', 60, { tx: t.x, ty: t.y }), !!bestTool(c, 'fish'), 'Needs a fishing rod');
    void contam;
    return out;
  }

  if (t.kind === 'animal') {
    add('attack', 'Attack', () => attackAnimal(game, c, t.animal));
    return out;
  }

  if (t.kind === 'character') {
    const o = t.char;
    add('talk', 'Talk', () => talkTo(game, c, o));
    const food = c.inventory.findIndex((s) => s && itemDef(s.id).food && (itemDef(s.id).food!.risk ?? 0) < 0.3);
    add('giveFood', 'Give food', () => giveFirst(game, c, o, food), food >= 0, 'No safe food');
    const water = cleanestWater(c.inventory, 200);
    add('giveWater', 'Give water', () => giveWater(game, c, o), !!water, 'No water');
    const hurt = o.health.injuries.some((i) => !i.bandaged);
    add('treat', 'Bandage wounds', () => startAction(game, c, 'treat', 4 / ws('firstAid'), { data: { patient: o.id } }), hurt && countItem(c.inventory, 'bandage') > 0, hurt ? 'No bandages' : 'Not injured');
    add('follow', 'Ask to follow you', () => game.setOrder([o.id], 'follow'));
    add('stay', 'Ask to wait here', () => game.setOrder([o.id], 'stay'));
    add('free', 'Let them decide', () => game.setOrder([o.id], 'none'));
    return out;
  }

  const o = t.obj;
  const d = objectDef(o.type);

  if (o.burning) {
    add('douse', 'Douse the flames', () => startAction(game, c, 'douse', 2, { targetId: o.id }), liquidTotal(c.inventory) > 200, 'No water');
    return out;
  }

  if (o.build !== undefined) {
    const tool = d.build?.tool;
    const toolOk = !tool || !!bestTool(c, tool);
    add('build', 'Work on construction', () => startAction(game, c, 'build', 30, { targetId: o.id }), toolOk, `Needs a tool (${tool})`);
    add('cancel', 'Cancel construction', () => dismantle(game, c, o));
    return out;
  }

  if (isTree(o.type)) {
    const tool = bestTool(c, 'chop');
    const mins = tool ? 25 / (tool.power * (0.6 + c.attributes.strength * 0.08) * ws()) : 0;
    add('chop', 'Chop down', () => startAction(game, c, 'chop', mins, { targetId: o.id }), !!tool, 'Needs an axe');
    add('branches', 'Snap off dead branches', () => startAction(game, c, 'gather', 6 / ws(), { targetId: o.id, data: { branches: true } }), true);
  }

  const gl = gatherLabel(game, o);
  if (gl) {
    const needTool = o.type === 'fallen_log' && !bestTool(c, 'chop') && !bestTool(c, 'saw');
    add('gather', gl, () => startAction(game, c, 'gather', gatherMinutes(o.type) / ws('foraging'), { targetId: o.id }), !needTool, 'Needs an axe or saw');
  } else if (['bilberry', 'bramble', 'wild_garlic', 'mushrooms', 'nettles', 'tall_grass', 'reeds'].includes(o.type)) {
    add('gather', 'Nothing to harvest now', () => {}, false, 'Out of season or picked');
  }

  // containers
  if (d.container && o.type !== 'drying_rack') {
    const searched = o.s2 === 1 || (!o.lootTable && o.type !== 'corpse' && d.kind !== 'furniture');
    if (!searched && (o.lootTable || d.kind === 'furniture' || o.type === 'corpse')) {
      add('search', o.type === 'corpse' ? 'Search the body' : 'Search', () => startAction(game, c, 'search', o.lootTable ? 4 : 1, { targetId: o.id }));
    } else add('open', 'Open', () => game.bus.emit('openContainer', { id: o.id }));
  }
  if (o.type === 'drying_rack') add('open', 'Hang food / take down', () => game.bus.emit('openContainer', { id: o.id }));
  if (o.type === 'supply_bag') add('pickup', 'Pick up the bag', () => startAction(game, c, 'pickupBag', 1, { targetId: o.id }));

  // fire
  if (d.fire) {
    for (const fuel of ['branch', 'firewood', 'log', 'plank', 'charcoal']) {
      const n = countItem(c.inventory, fuel);
      if (n > 0) add(`fuel_${fuel}`, fuel === 'branch' ? `Add ${Math.min(n, 5)} branches (${n} carried)` : `Add ${itemDef(fuel).name.toLowerCase()} (${n} carried)`, () => startAction(game, c, 'addFuel', 1, { targetId: o.id, data: { item: fuel, qty: fuel === 'branch' ? Math.min(n, 5) : 1 } }));
    }
    if (!o.lit) {
      const embers = (o.embers ?? 0) > game.state.time;
      const ign = !!bestTool(c, 'ignite');
      const drill = !ign && !embers && skillLevel(c, 'survival') >= 4;
      const label = embers ? 'Blow on the embers' : drill ? 'Try a hand drill' : 'Light the fire';
      add('light', label, () => startAction(game, c, 'lightFire', drill ? 25 : 2, { targetId: o.id }), (o.s ?? 0) > 0 && (ign || embers || drill), (o.s ?? 0) <= 0 ? 'Needs fuel' : 'Needs matches or a lighter');
    }
    if (o.lit) {
      const dirty = c.inventory.some((s) => s?.liquid && s.liquid.ml > 0 && s.liquid.contam > 0.01);
      const pot = !!bestTool(c, 'boil') || !!campToolNear(game, c, 'boil');
      add('boil', 'Boil water', () => startAction(game, c, 'boilWater', 15, { targetId: o.id }), dirty && pot, !pot ? 'Needs a cooking pot' : 'No untreated water');
      add('cook', 'Cook...', () => game.bus.emit('openPanel', 'craft'));
      add('warm', 'Sit by the fire', () => startAction(game, c, 'rest', 30));
      add('douse', 'Put out the fire', () => startAction(game, c, 'douse', 2, { targetId: o.id }), liquidTotal(c.inventory) > 200, 'No water');
    }
    if (!o.lit && (o.s2 ?? 0) >= 1) add('charcoal', `Collect charcoal (${Math.floor(o.s2!)})`, () => {
      const n = Math.floor(o.s2!);
      o.s2 = (o.s2 ?? 0) - n;
      const left = addItem(c.inventory, makeStack('charcoal', n));
      if (left) dropItems(game, c.x, c.y, [left]);
      game.charMessage(c, `Collected ${n} charcoal.`, 'info');
    });
  }

  if (d.shelter) {
    add('sleep', 'Sleep here', () => {
      c.x = o.x + (d.w ?? 1) / 2;
      c.y = o.y + (d.h ?? 1) / 2 + 0.1;
      game.startSleep(c);
    }, c.needs.energy < 85, 'Not tired');
    add('rest', 'Rest', () => startAction(game, c, 'rest', 30));
  }
  if (d.seat) add('sit', 'Sit and rest', () => startAction(game, c, 'rest', 30));

  switch (o.type) {
    case 'latrine':
      add('use', 'Use the latrine', () => startAction(game, c, 'relieve', 3, { targetId: o.id }), c.needs.bladder > 15, 'You do not need to go');
      break;
    case 'wash_station':
      add('wash', 'Wash (uses 1 L of water)', () => startAction(game, c, 'washStation', 8), liquidTotal(c.inventory, 1) >= 300, 'Needs water in a container');
      add('washClothes', 'Wash clothes (uses 2 L of water)', () => startAction(game, c, 'washClothes', 18, { data: { basin: true } }), liquidTotal(c.inventory, 1) >= 600 && clothingDirt(c) > 0.1, clothingDirt(c) > 0.1 ? 'Needs water in a container' : 'Clothes are clean');
      break;
    case 'rain_collector': {
      const l = (o.water?.ml ?? 0) / 1000;
      add('collect', `Fill containers (${l.toFixed(1)} L stored)`, () => startAction(game, c, 'collectRain', 2, { targetId: o.id }), l > 0.1, 'Empty');
      add('drinkRain', 'Drink', () => {
        const ml = Math.min(500, o.water?.ml ?? 0);
        if (o.water) o.water.ml -= ml;
        c.needs.hydration = Math.min(100, c.needs.hydration + ml / 25);
        game.charMessage(c, 'You drink the rainwater.', 'info');
      }, l > 0.1, 'Empty');
      break;
    }
    case 'water_filter':
      add('filter', 'Filter water', () => startAction(game, c, 'filterWater', 10), c.inventory.some((s) => s?.liquid && s.liquid.ml > 0 && s.liquid.contam > 0.02), 'No dirty water');
      break;
    case 'garden_plot': {
      if (!o.crop) {
        const seeds = [...new Set(c.inventory.filter((s) => s && itemDef(s.id).seed).map((s) => s!.id))];
        for (const sid of seeds) add(`plant_${sid}`, `Plant ${itemDef(sid).name.toLowerCase()}`, () => startAction(game, c, 'plant', 8 / ws('farming'), { targetId: o.id, data: { item: sid } }));
        if (!seeds.length) add('plant', 'Plant', () => {}, false, 'No seeds');
      } else {
        const def = CROPS[o.crop.id];
        if (o.crop.growth >= 1) add('harvest', `Harvest ${def.name.toLowerCase()}`, () => startAction(game, c, 'harvest', 10 / ws('farming'), { targetId: o.id }));
        add('water', `Water (${Math.round(o.crop.water * 100)}% moist)`, () => startAction(game, c, 'waterCrop', 2, { targetId: o.id }), liquidTotal(c.inventory, 1) > 200, 'No water');
        add('inspect', `${def.name}: ${Math.round(o.crop.growth * 100)}% grown, ${o.crop.health > 0.7 ? 'healthy' : o.crop.health > 0.35 ? 'struggling' : 'dying'}`, () => {}, false);
      }
      break;
    }
    case 'snare':
      add('check', 'Check the snare', () => startAction(game, c, 'checkSnare', 3, { targetId: o.id }));
      break;
    case 'workbench':
      add('craft', 'Craft at workbench', () => game.bus.emit('openPanel', 'craft'));
      break;
    case 'hunting_stand':
      add('climb', 'Climb up and look around', () => startAction(game, c, 'climb', 10, { tx: o.x, ty: o.y }));
      break;
    case 'carcass':
      add('butcher', 'Butcher', () => startAction(game, c, 'butcher', 25 / ws('hunting'), { targetId: o.id }), !!bestTool(c, 'cut'), 'Needs a knife');
      break;
    case 'sign':
      add('read', 'Read', () => {
        if (o.doc) {
          readDoc(game, o.doc);
          game.bus.emit('readDoc', o.doc);
        }
      });
      break;
    case 'table':
    case 'bed':
    case 'fence':
    case 'hay':
    case 'car_wreck':
    case 'shelf':
    case 'cupboard':
    case 'wardrobe':
    case 'crate': {
      const emptyOk = !o.inv || o.inv.every((s) => !s);
      const tool = bestTool(c, 'hammer') ?? bestTool(c, 'saw') ?? bestTool(c, 'chop');
      add('salvage', 'Salvage materials', () => startAction(game, c, 'salvage', 30 / ws('mechanics'), { targetId: o.id }), !!tool && emptyOk && !o.lootTable, !tool ? 'Needs a hammer, saw or axe' : 'Empty it first');
      break;
    }
    default:
      break;
  }

  if (d.build && d.kind === 'structure') add('dismantle', 'Dismantle', () => dismantle(game, c, o));
  return out;
}

// --- character interactions ------------------------------------------------------

export function talkTo(game: Game, player: Character, npc: Character): void {
  const n = npc.needs;
  const rel = game.social.get(npc.id, player.id);
  let line: string;
  const helped = npc.memories.find((m) => m.kind === 'helped' && m.who === player.id && m.weight > 3);
  if (npc.sleeping) line = '...';
  else if (npc.health.injuries.some((i) => i.bleeding > 0.1 && !i.bandaged)) line = 'I am bleeding. Do you have a bandage?';
  else if (n.hydration < 25) line = 'I am so thirsty I can hardly think.';
  else if (n.satiety < 20) line = 'I have not eaten properly in a long time.';
  else if (n.bodyTemp < 36) line = 'I cannot get warm.';
  else if (n.energy < 25) line = 'I need to sleep. Soon.';
  else if (npc.memories.some((m) => m.kind === 'death' && m.weight < -15)) line = 'I keep thinking about who we have lost.';
  else if (helped && game.rng.chance(0.5)) line = 'Thanks for earlier. I will not forget it.';
  else if (rel.affinity < -20) line = 'What do you want?';
  else if (npc.ai.expeditionId !== undefined) line = 'We are heading out. Back before dark, hopefully.';
  else if (n.morale > 65) line = game.rng.pick(['We are doing alright, considering.', 'Some days I almost forget what happened.', 'It is quiet out here. I like that.']);
  else if (n.morale < 30) line = game.rng.pick(['I do not know how long we can do this.', 'Everything is so hard.', 'I miss home.']);
  else line = game.rng.pick([`I am ${npc.ai.taskLabel.toLowerCase()}.`, 'Holding up.', 'Any idea what happens next?']);
  game.say(npc, line, 6);
  game.social.adjust(npc.id, player.id, 0.5, 0.2);
}

function giveFirst(game: Game, from: Character, to: Character, slot: number): void {
  const s = removeAt(from.inventory, slot, 1);
  if (!s) return;
  const left = addItem(to.inventory, s);
  if (left) addItem(from.inventory, left);
  else {
    game.social.helped(from.id, to.id, 'shared food with me', to.needs.satiety < 30 ? 10 : 4);
    game.say(to, to.needs.satiety < 30 ? 'Thank you. Really.' : 'Thanks.');
  }
}

function giveWater(game: Game, from: Character, to: Character): void {
  const s = cleanestWater(from.inventory, 100);
  if (!s?.liquid) return;
  const ml = Math.min(500, s.liquid.ml);
  s.liquid.ml -= ml;
  to.needs.hydration = Math.min(100, to.needs.hydration + ml / 25);
  game.social.helped(from.id, to.id, 'gave me water', to.needs.hydration < 40 ? 8 : 3);
  game.say(to, 'Thank you.');
}

// --- item actions ------------------------------------------------------------------

export interface ItemAction {
  id: string;
  label: string;
  run: () => void;
  enabled?: boolean;
}

export function itemActions(game: Game, c: Character, slot: number): ItemAction[] {
  const s = c.inventory[slot];
  if (!s) return [];
  const d = itemDef(s.id);
  const out: ItemAction[] = [];
  if (d.food) out.push({ id: 'eat', label: 'Eat', run: () => startAction(game, c, 'eat', d.food!.eatMinutes ?? 5, { data: { slot, item: s.id, from: 'inv' } }) });
  if (s.liquid && s.liquid.ml > 0) {
    out.push({ id: 'drink', label: 'Drink', run: () => startAction(game, c, 'drinkItem', 1, { data: { slot, ml: 400 } }) });
    if (s.liquid.contam > 0.02 && countItem(c.inventory, 'purify_tablets') > 0)
      out.push({ id: 'purify', label: 'Treat with tablet', run: () => purify(game, c, s) });
    out.push({ id: 'empty', label: 'Pour out', run: () => ((s.liquid!.ml = 0), (s.liquid!.contam = 0)) });
  }
  if (d.medical === 'bandage') out.push({ id: 'bandage', label: 'Bandage yourself', run: () => startAction(game, c, 'treat', 3, { data: { patient: c.id } }), enabled: c.health.injuries.some((i) => !i.bandaged) });
  if (d.medical === 'antiseptic') out.push({ id: 'antiseptic', label: 'Clean wounds', run: () => startAction(game, c, 'treat', 2, { data: { patient: c.id, kind: 'antiseptic' } }), enabled: c.health.injuries.length > 0 });
  if (d.medical === 'painkiller') out.push({ id: 'painkiller', label: 'Take a painkiller', run: () => startAction(game, c, 'treat', 0.5, { data: { patient: c.id, kind: 'painkiller' } }) });
  if (d.clothing || d.backpack || d.light || d.weapon || d.tool) {
    const slotName = equipSlotFor(s);
    if (slotName) out.push({ id: 'equip', label: slotName === 'hand' ? 'Hold in hand' : 'Wear', run: () => equip(game, c, slot) });
  }
  if (s.doc) out.push({ id: 'read', label: 'Read', run: () => {
    readDoc(game, s.doc!);
    game.bus.emit('readDoc', s.doc!);
  } });
  if (s.id === 'radio') out.push({ id: 'listen', label: 'Crank and listen', run: () => startAction(game, c, 'listenRadio', 10) });
  if (s.id === 'duffel_bag') out.push({ id: 'place', label: 'Set the bag down', run: () => placeBag(game, c, slot) });
  if (s.id === 'map') out.push({ id: 'map', label: 'Look at the map', run: () => game.bus.emit('openPanel', 'map') });
  out.push({ id: 'drop', label: 'Drop', run: () => {
    const st = removeAt(c.inventory, slot);
    if (st) dropItems(game, c.x, c.y, [st]);
  } });
  return out;
}

export function equipSlotFor(s: ItemStack): EquipSlot | undefined {
  const d = itemDef(s.id);
  if (d.clothing) return d.clothing.slot;
  if (d.backpack) return 'back';
  if (d.light || d.weapon || d.tool) return 'hand';
  return undefined;
}

export function equip(game: Game, c: Character, slot: number): void {
  const s = c.inventory[slot];
  if (!s) return;
  const es = equipSlotFor(s);
  if (!es) return;
  const prev = c.equipment[es] ?? null;
  c.inventory[slot] = prev;
  c.equipment[es] = s;
  if (es === 'back') {
    const overflow = resizeInventory(c);
    if (overflow.length) {
      dropItems(game, c.x, c.y, overflow);
      game.charMessage(c, 'Some items did not fit and were put on the ground.', 'warn');
    }
  }
  game.bus.emit('sound', { id: 'equip', x: c.x, y: c.y });
}

export function unequip(game: Game, c: Character, es: EquipSlot): void {
  const s = c.equipment[es];
  if (!s) return;
  if (es === 'back') {
    // items in backpack slots must fit elsewhere
    c.equipment.back = null;
    const overflow = resizeInventory(c);
    const left = addItem(c.inventory, s);
    const drop = [...overflow, ...(left ? [left] : [])];
    if (drop.length) {
      dropItems(game, c.x, c.y, drop);
      game.charMessage(c, 'Without the backpack, some items had to go on the ground.', 'warn');
    }
    return;
  }
  const left = addItem(c.inventory, s);
  if (left) {
    game.charMessage(c, 'No room in your inventory.', 'warn');
    return;
  }
  c.equipment[es] = null;
}

function purify(game: Game, c: Character, s: ItemStack): void {
  const tabs = c.inventory.findIndex((x) => x?.id === 'purify_tablets');
  if (tabs < 0 || !s.liquid) return;
  removeAt(c.inventory, tabs, 1);
  s.liquid.contam = Math.min(s.liquid.contam, 0.01);
  game.charMessage(c, 'You drop a tablet in. The water tastes of chlorine, but it is safe.', 'good');
}

function placeBag(game: Game, c: Character, slot: number): void {
  const s = c.inventory[slot];
  if (!s || s.id !== 'duffel_bag') return;
  const spot = game.index.findTileNear(c.x, c.y, 3, (x, y) => game.index.isFree(x, y));
  if (!spot) return game.charMessage(c, 'No room to set it down here.', 'warn');
  c.inventory[slot] = null;
  const inv = s.contents ?? new Array(20).fill(null);
  game.index.addObject({ type: 'supply_bag', x: spot[0], y: spot[1], inv });
  game.charMessage(c, 'You set the supply bag down.', 'info');
}

export function docText(game: Game, id: string): { title: string; text: string } | undefined {
  return docById(game, id);
}

export { liquidTotal };
