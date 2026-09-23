import { ANIMALS } from '@/content/animals';
import { itemDef } from '@/content/items';
import { isWater } from '@/content/terrain';
import { clamp } from '@/core/math';
import type { Animal, Character } from './types';
import type { Game } from './game';
import { daylight, season } from './clock';
import { addInjury } from './body';
import { gainSkill, skillLevel } from './actions';
import { countItem } from './inventory';

const NEAR = 45;

/**
 * Wildlife: animals have territories, hunger and thirst, react to humans and
 * noise, sleep according to their rhythm, and populations respond to hunting.
 * Near animals move smoothly every step; far animals are simulated coarsely.
 */
export function moveAnimals(game: Game, dt: number): void {
  const p = game.player;
  for (const a of Object.values(game.state.animals)) {
    if (a.state === 'dead' || a.tx === undefined || a.ty === undefined) {
      a.moving = false;
      continue;
    }
    const near = p && Math.abs(a.x - p.x) < NEAR && Math.abs(a.y - p.y) < NEAR;
    if (!near) continue;
    stepToward(game, a, dt, true);
  }
}

function speedOf(a: Animal): number {
  const d = ANIMALS[a.species];
  if (!d) return 1;
  return a.state === 'flee' ? d.fleeSpeed : a.state === 'charge' ? d.fleeSpeed * 0.9 : d.speed;
}

function stepToward(game: Game, a: Animal, dt: number, collide: boolean): void {
  const dx = a.tx! - a.x;
  const dy = a.ty! - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.3) {
    a.moving = false;
    a.tx = undefined;
    a.ty = undefined;
    return;
  }
  const step = Math.min(d, speedOf(a) * dt);
  const nx = a.x + (dx / d) * step;
  const ny = a.y + (dy / d) * step;
  if (!collide || !game.index.isSolid(nx, ny)) {
    a.x = nx;
    a.y = ny;
  } else if (!game.index.isSolid(nx, a.y)) a.x = nx;
  else if (!game.index.isSolid(a.x, ny)) a.y = ny;
  else {
    // blocked: pick a new direction
    a.tx = a.x + game.rng.range(-4, 4);
    a.ty = a.y + game.rng.range(-4, 4);
  }
  a.moving = true;
  a.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}

export function updateWildlife(game: Game, dt: number, nearTier: boolean): void {
  const s = game.state;
  const p = game.player;
  const light = daylight(s.time);
  const people = game.livingCharacters();
  for (const a of Object.values(s.animals)) {
    if (a.state === 'dead') continue;
    const def = ANIMALS[a.species];
    if (!def) continue;
    const near = !!p && Math.abs(a.x - p.x) < NEAR && Math.abs(a.y - p.y) < NEAR;
    if (near !== nearTier) continue;
    if (!near) {
      // coarse simulation for far animals: drift inside territory
      if (a.tx !== undefined) stepToward(game, a, dt, false);
      else if (game.rng.chance(0.3)) {
        a.tx = a.homeX + game.rng.range(-def.territory, def.territory) * 0.5;
        a.ty = a.homeY + game.rng.range(-def.territory, def.territory) * 0.5;
      }
      a.state = 'wander';
      continue;
    }
    a.hunger += dt * 0.05;
    a.thirst += dt * 0.07;
    a.timer -= dt;
    a.fear = Math.max(0, a.fear - dt * 0.5);

    // perceive humans
    let threat: Character | undefined;
    let threatD = Infinity;
    for (const c of people) {
      const d = Math.hypot(c.x - a.x, c.y - a.y);
      let aware = def.awareness * (c.sprinting ? 1.6 : c.moving ? 1 : 0.55) * (0.6 + light * 0.4) * (1 - s.weather.precipitation * 0.25);
      if (c.action?.type === 'chop') aware *= 2;
      if (d < aware && d < threatD) {
        threat = c;
        threatD = d;
      }
    }
    if (a.state === 'charge') {
      const target = threat;
      if (!target || a.timer <= 0) {
        a.state = 'flee';
        a.timer = 6;
      } else {
        a.tx = target.x;
        a.ty = target.y;
        if (threatD < 0.9) {
          addInjury(game, target, 'animalWound', game.rng.range(0.25, 0.6) * def.damage * 2.5, `a ${def.name.toLowerCase()}`);
          game.bus.emit('sound', { id: 'boar', x: a.x, y: a.y });
          a.state = 'flee';
          a.timer = 8;
          const ang = Math.atan2(a.y - target.y, a.x - target.x);
          a.tx = a.x + Math.cos(ang) * 12;
          a.ty = a.y + Math.sin(ang) * 12;
        }
      }
      continue;
    }
    if (threat) {
      const protectiveSeason = season(s.time).id === 'spring' && a.species === 'boar';
      const cornered = threatD < 2.5;
      if (def.aggressive > 0 && cornered && game.rng.chance(def.aggressive * (protectiveSeason ? 1.5 : 0.5) * (a.hp < def.hp ? 1.5 : 1) * dt * 0.5)) {
        a.state = 'charge';
        a.timer = 3;
        game.bus.emit('sound', { id: 'boar', x: a.x, y: a.y });
        if (game.isPlayer(threat)) game.message(`The ${def.name.toLowerCase()} charges!`, 'bad');
        continue;
      }
      if (a.state !== 'flee' || a.tx === undefined) {
        const ang = Math.atan2(a.y - threat.y, a.x - threat.x) + game.rng.range(-0.5, 0.5);
        a.state = 'flee';
        a.fear = 10;
        a.tx = a.x + Math.cos(ang) * 14;
        a.ty = a.y + Math.sin(ang) * 14;
        a.timer = 8;
      }
      continue;
    }
    if (a.state === 'flee' && a.timer > 0) continue;

    // needs and rhythm
    const sleeps = def.night ? light > 0.7 : light < 0.2;
    if (sleeps && a.hunger < 60 && a.thirst < 60) {
      a.state = 'sleep';
      a.tx = undefined;
      continue;
    }
    if (a.thirst > 55 && a.state !== 'drink') {
      const w = game.index.findTileNear(a.x, a.y, 25, (x, y) => isWater(game.index.terrainAt(x, y)) && !game.index.isSolid(x + 1, y));
      if (w) {
        a.state = 'drink';
        a.tx = w[0] + 1.5;
        a.ty = w[1] + 0.5;
        continue;
      }
    }
    if (a.state === 'drink' && a.tx === undefined) {
      a.thirst = 0;
      a.state = 'graze';
      a.timer = game.rng.range(10, 30);
    }
    if (a.timer <= 0 || a.state === 'sleep') {
      if (game.rng.chance(0.55)) {
        a.state = 'graze';
        a.hunger = Math.max(0, a.hunger - 20);
        a.timer = game.rng.range(8, 25);
        a.tx = undefined;
      } else {
        a.state = 'wander';
        const r = def.territory * 0.5;
        // drift home when outside territory
        const hx = Math.hypot(a.x - a.homeX, a.y - a.homeY) > def.territory ? a.homeX : a.x;
        const hy = Math.hypot(a.x - a.homeX, a.y - a.homeY) > def.territory ? a.homeY : a.y;
        a.tx = clamp(hx + game.rng.range(-r, r) * 0.4, 2, s.width - 2);
        a.ty = clamp(hy + game.rng.range(-r, r) * 0.4, 2, s.height - 2);
        a.timer = game.rng.range(5, 15);
      }
    }
  }
}

/** Strike an animal with the best weapon available. */
export function attackAnimal(game: Game, c: Character, a: Animal): boolean {
  const def = ANIMALS[a.species];
  if (!def || a.state === 'dead') return false;
  let weapon = { damage: 4, reach: 0.9, name: 'bare hands' };
  for (const s of [c.equipment.hand, ...c.inventory]) {
    const w = s ? itemDef(s.id).weapon : undefined;
    if (w && w.damage > weapon.damage) weapon = { ...w, name: itemDef(s!.id).name.toLowerCase() };
  }
  const d = Math.hypot(a.x - c.x, a.y - c.y);
  if (d > weapon.reach + 0.8) {
    game.charMessage(c, 'Too far away.', 'info');
    return false;
  }
  c.needs.stamina = Math.max(0, c.needs.stamina - 12);
  const hit = clamp(0.3 + skillLevel(c, 'hunting') * 0.06 + c.attributes.agility * 0.025 - (a.state === 'flee' ? 0.2 : 0) + (a.state === 'sleep' || a.state === 'graze' ? 0.15 : 0), 0.05, 0.92);
  game.bus.emit('sound', { id: 'swing', x: c.x, y: c.y });
  if (!game.rng.chance(hit)) {
    game.charMessage(c, `You miss with the ${weapon.name}.`, 'info');
    a.state = 'flee';
    a.fear = 10;
    return false;
  }
  const dmg = weapon.damage * (0.8 + c.attributes.strength * 0.04) * game.rng.range(0.8, 1.2);
  a.hp -= dmg;
  gainSkill(game, c, 'hunting', 0.1);
  if (a.hp <= 0) {
    killAnimal(game, a, c);
    return true;
  }
  game.charMessage(c, `You wound the ${def.name.toLowerCase()}.`, 'info');
  if (def.aggressive > 0 && game.rng.chance(def.aggressive)) {
    a.state = 'charge';
    a.timer = 3;
  } else {
    a.state = 'flee';
    a.timer = 10;
    const ang = Math.atan2(a.y - c.y, a.x - c.x);
    a.tx = a.x + Math.cos(ang) * 16;
    a.ty = a.y + Math.sin(ang) * 16;
  }
  return false;
}

export function killAnimal(game: Game, a: Animal, by?: Character): void {
  const def = ANIMALS[a.species];
  a.state = 'dead';
  delete game.state.animals[a.id];
  const pop = game.state.populations[a.species];
  if (pop) pop.count = Math.max(0, pop.count - 1);
  const spot = game.index.findTileNear(a.x, a.y, 3, (x, y) => game.index.isFree(x, y));
  if (spot) game.index.addObject({ type: 'carcass', x: spot[0], y: spot[1], label: a.species });
  if (by) {
    game.charMessage(by, `The ${def.name.toLowerCase()} goes down.${countItem(by.inventory, 'pocket_knife') + countItem(by.inventory, 'hunting_knife') > 0 ? ' Butcher it with your knife.' : ' You will need a knife to butcher it.'}`, 'good');
    game.journal(`${by.name} killed a ${def.name.toLowerCase()}.`, 'event');
  }
}

/** Daily population change: births where there is room, near existing animals. */
export function updatePopulations(game: Game, days: number): void {
  const s = game.state;
  const p = game.player;
  const growing = season(s.time).id === 'spring' || season(s.time).id === 'summer';
  for (const [species, pop] of Object.entries(s.populations)) {
    const def = ANIMALS[species];
    if (!def) continue;
    const members = Object.values(s.animals).filter((a) => a.species === species);
    pop.count = members.length;
    if (!members.length || !growing) continue;
    const expected = members.length * def.birthRate * days * (1 - members.length / pop.cap) * 3;
    let births = Math.floor(expected) + (game.rng.chance(expected % 1) ? 1 : 0);
    while (births-- > 0) {
      const parent = game.rng.pick(members);
      if (p && Math.hypot(parent.x - p.x, parent.y - p.y) < 30) continue;
      const id = s.nextId++;
      s.animals[id] = { ...parent, id, hp: def.hp, hunger: 20, thirst: 20, state: 'idle', timer: 0, fear: 0, tx: undefined, ty: undefined, moving: false };
      pop.count++;
    }
  }
}
