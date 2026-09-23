import { itemDef } from '@/content/items';
import { CROPS } from '@/content/crops';
import { objectDef } from '@/content/objects';
import { T } from '@/content/terrain';
import { clamp } from '@/core/math';
import type { Game } from './game';
import type { ItemStack, WorldObject } from './types';
import { dayOf, season } from './clock';
import { updatePopulations } from './wildlife';
import { checkExpeditions } from './npc';
import { shelterAt } from './environment';

/** Freshness loss scales with temperature: cold slows spoilage greatly. */
export function spoilFactor(tempC: number): number {
  return clamp((tempC + 5) / 20, 0.08, 2);
}

function spoilSlots(slots: (ItemStack | null)[] | undefined, dt: number, factor: number): void {
  if (!slots) return;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s) continue;
    if (s.contents) spoilSlots(s.contents, dt, factor);
    const f = itemDef(s.id).food;
    if (!f || f.spoilPerDay <= 0) continue;
    s.q = Math.max(0, (s.q ?? 1) - f.spoilPerDay * (dt / 1440) * factor);
  }
}

/** Food spoilage and drying across every inventory and container. */
export function updateSpoilage(game: Game, dt: number): void {
  const s = game.state;
  const base = spoilFactor(s.weather.temp);
  for (const c of Object.values(s.characters)) spoilSlots(c.inventory, dt, base * 1.1);
  for (const k in s.objects) {
    const o = s.objects[k];
    if (!o.inv) continue;
    if (o.type === 'drying_rack') {
      dryRack(game, o, dt);
      continue;
    }
    // the ground is cooler than the air in the shade; buildings keep things dry
    spoilSlots(o.inv, dt, base * (o.type === 'pile' ? 1.2 : 0.9));
  }
}

function dryRack(game: Game, o: WorldObject, dt: number): void {
  const w = game.state.weather;
  const sheltered = !!shelterAt(game.index, o.x + 0.5, o.y + 0.5);
  const fire = game.index.nearestOfType(['campfire', 'fire_pit'], o.x, o.y, 4, (f) => !!f.lit);
  const raining = w.precipitation > 0.15 && !sheltered;
  const rate = raining ? 0 : (w.temp > 5 ? 1 : 0.3) * (fire ? 1.8 : 1) * (1 + w.wind * 0.05);
  for (let i = 0; i < o.inv!.length; i++) {
    const s = o.inv![i];
    if (!s) continue;
    const target = s.id === 'raw_meat' ? 'dried_meat' : s.id === 'raw_fish' ? 'dried_fish' : null;
    const f = itemDef(s.id).food;
    if (f && f.spoilPerDay > 0) s.q = Math.max(0, (s.q ?? 1) - f.spoilPerDay * (dt / 1440) * spoilFactor(w.temp) * (raining ? 1.3 : 0.5));
    if (!target) continue;
    s.charge = (s.charge ?? 0) + (rate * dt) / (14 * 60);
    if (s.charge >= 1) {
      o.inv![i] = { id: target, qty: s.qty, q: Math.max(0.5, s.q ?? 1) };
    }
  }
}

let lastPopDay = -1;

/** Hourly world processes: regrowth, crops, water collection, traps, fish, populations. */
export function updateEcology(game: Game, dt: number): void {
  const st = game.state;
  const sea = season(st.time);
  const w = st.weather;
  const idx = game.index;
  let deadfall = 0;
  const forestEdgeSpawns: [number, number][] = [];

  for (const k in st.objects) {
    const o = st.objects[k];
    // plant regrowth
    if (o.regrow !== undefined && st.time >= o.regrow) {
      if (o.type === 'stump') {
        idx.changeType(o, 'sapling');
        o.regrow = st.time + game.rng.range(25, 45) * 1440;
      } else if (o.type === 'sapling') {
        idx.changeType(o, game.rng.pick(['spruce', 'spruce', 'beech', 'birch']));
        o.regrow = undefined;
      } else {
        o.s = 1;
        o.regrow = undefined;
      }
    }
    switch (o.type) {
      case 'deadfall':
        deadfall++;
        break;
      case 'bilberry':
        if (!o.regrow) o.s = sea.id === 'summer' || (sea.id === 'autumn' && dayOf(st.time) % 14 < 5) ? 1 : 0;
        break;
      case 'bramble':
        if (!o.regrow) o.s = sea.berries && (sea.id === 'autumn' || dayOf(st.time) % 14 > 6) ? 1 : 0;
        break;
      case 'hazel':
        if (!o.regrow) o.s = sea.nuts ? 1 : 0;
        break;
      case 'wild_garlic':
        if (!o.regrow) o.s = sea.garlic ? 1 : 0;
        break;
      case 'nettles':
      case 'tall_grass':
      case 'reeds':
        if (!o.regrow && sea.id !== 'winter') o.s = 1;
        break;
      case 'mushrooms':
        if (!o.regrow && !o.s) {
          const wet = w.dryness < 0.45 ? 0.08 : 0.015;
          if (game.rng.chance(sea.mushrooms * wet * (dt / 60))) o.s = 1;
        } else if (o.s && sea.id === 'winter') o.s = 0;
        break;
      case 'rain_collector':
        if (o.build === undefined) {
          o.water ??= { ml: 0, contam: 0.03 };
          const add = w.precipitation * 1600 * (dt / 60) * (w.current === 'snow' ? 0.3 : 1);
          o.water.contam = (o.water.contam * o.water.ml + 0.03 * add) / Math.max(1, o.water.ml + add);
          o.water.ml = Math.min(40000, o.water.ml + add);
          // standing water slowly goes stale
          o.water.contam = Math.min(0.3, o.water.contam + 0.0004 * (dt / 60));
        }
        break;
      case 'garden_plot':
        if (o.crop) growCrop(game, o, dt);
        break;
      case 'snare':
        if (o.build === undefined && !o.s2) {
          const pop = st.populations['hare'];
          const density = pop ? pop.count / pop.cap : 0.3;
          const edge = idx.terrainAt(o.x, o.y) === T.FOREST ? 1.2 : 0.8;
          if (game.rng.chance(0.012 * density * edge * (dt / 60))) {
            o.s2 = 1;
            const hares = Object.values(st.animals).filter((a) => a.species === 'hare');
            if (hares.length) delete st.animals[game.rng.pick(hares).id];
          }
        }
        break;
      case 'campfire':
      case 'fire_pit':
        // ash turns to collectable charcoal
        break;
      default:
        break;
    }
  }

  // deadfall accumulates, faster after windy weather
  const targetDeadfall = 2600;
  if (deadfall < targetDeadfall) {
    const spawns = Math.ceil((targetDeadfall - deadfall) * 0.002 * (dt / 60) * (1 + w.wind * 0.2));
    for (let i = 0; i < spawns; i++) {
      const x = game.rng.int(2, st.width - 3);
      const y = game.rng.int(2, st.height - 3);
      if (idx.terrainAt(x, y) === T.FOREST && idx.isFree(x, y) && !nearPlayer(game, x, y, 12)) forestEdgeSpawns.push([x, y]);
    }
    for (const [x, y] of forestEdgeSpawns) idx.addObject({ type: 'deadfall', x, y, s: 3, v: game.rng.int(0, 255) });
  }

  // fish stocks recover
  for (const k of Object.keys(st.fishStock)) {
    const cap = game.fishCapacity(k);
    const s = st.fishStock[k];
    // logistic regrowth: depleted waters recover slowly
    st.fishStock[k] = Math.min(cap, s + Math.max(0.05, s * 0.012 * (1 - s / cap)) * (dt / 60));
  }

  const day = dayOf(st.time);
  if (day !== lastPopDay) {
    if (lastPopDay !== -1) updatePopulations(game, 1);
    lastPopDay = day;
  }
  checkExpeditions(game);
}

function nearPlayer(game: Game, x: number, y: number, r: number): boolean {
  const p = game.player;
  return !!p && Math.abs(p.x - x) < r && Math.abs(p.y - y) < r;
}

function growCrop(game: Game, o: WorldObject, dt: number): void {
  const crop = o.crop!;
  const def = CROPS[crop.id];
  if (!def) return;
  const st = game.state;
  const w = st.weather;
  const h = dt / 60;
  const sea = season(st.time);
  crop.water = clamp(crop.water + w.precipitation * 0.25 * h - (def.thirst / 24) * h * (w.temp > 22 ? 1.5 : 1), 0, 1);
  if (w.temp < def.frost) {
    crop.health -= 0.06 * h;
    if (crop.health < 0.5 && game.rng.chance(0.1)) game.nearbyMessage(o.x, o.y, 'Frost has damaged the crops.', 'warn');
  }
  if (crop.water < 0.1 && crop.growth < 1) crop.health -= 0.01 * h;
  crop.health = clamp(crop.health, 0, 1);
  if (crop.health <= 0) {
    game.journal(`The ${def.name.toLowerCase()} in the garden died.`, 'camp');
    o.crop = undefined;
    return;
  }
  if (!def.seasons.includes(sea.id) || w.temp < 4) return;
  const waterMod = crop.water > 0.25 ? 1 : 0.4;
  const before = crop.growth;
  crop.growth = Math.min(1, crop.growth + (h / (def.days * 24)) * waterMod * (0.5 + crop.health * 0.5));
  if (before < 1 && crop.growth >= 1) game.journal(`The ${def.name.toLowerCase()} are ready to harvest.`, 'camp');
}

export { objectDef };
