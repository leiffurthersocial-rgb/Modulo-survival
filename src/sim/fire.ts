import { objectDef } from '@/content/objects';
import { clamp } from '@/core/math';
import type { Game } from './game';
import type { WorldObject } from './types';
import { FIRE_TYPES, shelterAt } from './environment';
import { addInjury } from './body';

/**
 * Fire is a physical system: fuel burns down, weather affects burn rate and
 * ignition, unsafe fires can throw sparks into dry vegetation, and burning
 * objects spread to their neighbours.
 */
export function updateFires(game: Game, dt: number): void {
  const { state, index } = game;
  const w = state.weather;
  for (const type of FIRE_TYPES) {
    const set = index.byType.get(type);
    if (!set) continue;
    for (const id of [...set]) {
      const o = state.objects[id];
      if (!o || !o.lit) continue;
      const def = objectDef(o.type).fire!;
      const indoor = o.type === 'stove' || !!index.buildingAt(o.x, o.y);
      const sheltered = indoor || !!shelterAt(index, o.x + 0.5, o.y + 0.5);
      const rain = sheltered ? 0 : w.precipitation;
      const burnRate = 1 + w.wind * 0.04 + rain * 1.5;
      o.s = (o.s ?? 0) - burnRate * dt;
      // charcoal slowly accumulates in the ashes
      o.s2 = Math.min(6, (o.s2 ?? 0) + dt / 150);
      if (rain > 0.6 && (o.s ?? 0) < 45 && game.rng.chance(0.004 * dt * rain)) {
        o.s = 0;
        game.nearbyMessage(o.x, o.y, 'The rain put the fire out.', 'warn');
      }
      if ((o.s ?? 0) <= 0) {
        o.s = 0;
        o.lit = false;
        // embers stay hot for a while and can be blown back to life
        o.embers = game.state.time + (rain > 0.3 ? 30 : 150);
        game.bus.emit('fireOut', { id: o.id });
        game.nearbyMessage(o.x, o.y, 'The fire has burned down.', 'info');
        continue;
      }
      // sparks from open fires in dry, windy weather
      if (!def.safe && !sheltered && w.dryness > 0.55 && w.wind > 3) {
        const p = (w.dryness - 0.5) * (w.wind - 2) * 0.0015 * dt;
        if (game.rng.chance(p)) {
          const dx = Math.round(Math.cos(w.windDir) * game.rng.range(1, 2.5));
          const dy = Math.round(Math.sin(w.windDir) * game.rng.range(1, 2.5));
          const target = index.objAt(o.x + dx, o.y + dy);
          if (target && objectDef(target.type).flammable && !target.burning) {
            ignite(game, target);
            game.journal('Sparks from the campfire set the undergrowth alight.', 'danger');
          }
        }
      }
    }
  }

  // burning objects
  for (const id of [...game.burning]) {
    const o = state.objects[id];
    if (!o || !o.burning) {
      game.burning.delete(id);
      continue;
    }
    o.burning -= dt * (1 + w.precipitation * 4);
    // spread
    const spreadP = clamp((w.dryness - 0.25) * 0.02 + w.wind * 0.0015, 0, 0.05) * (1 - w.precipitation) * dt;
    if (game.rng.chance(spreadP)) {
      const bias = game.rng.chance(0.6);
      const dx = bias ? Math.round(Math.cos(w.windDir)) : game.rng.int(-1, 1);
      const dy = bias ? Math.round(Math.sin(w.windDir)) : game.rng.int(-1, 1);
      const n = index.objAt(o.x + dx, o.y + dy);
      if (n && n !== o && objectDef(n.type).flammable && !n.burning && game.burning.size < 300) ignite(game, n);
    }
    if (o.burning <= 0) burnOut(game, o);
  }

  // characters standing in or next to flames get burned
  if (game.burning.size > 0) {
    for (const c of game.livingCharacters()) {
      if (c.sleeping && !nearBurning(game, c.x, c.y, 1.2)) continue;
      if (nearBurning(game, c.x, c.y, 1.1) && game.rng.chance(0.08 * dt)) {
        addInjury(game, c, 'burn', game.rng.range(0.15, 0.4), 'fire');
      }
    }
  }
}

export function nearBurning(game: Game, x: number, y: number, r: number): boolean {
  for (const id of game.burning) {
    const o = game.state.objects[id];
    if (o && Math.hypot(o.x + 0.5 - x, o.y + 0.5 - y) < r) return true;
  }
  return false;
}

export function ignite(game: Game, o: WorldObject): void {
  o.burning = game.rng.range(25, 60);
  game.burning.add(o.id);
  game.bus.emit('sound', { id: 'ignite', x: o.x, y: o.y });
}

function burnOut(game: Game, o: WorldObject): void {
  o.burning = undefined;
  game.burning.delete(o.id);
  const d = objectDef(o.type);
  if (d.kind === 'tree') {
    game.index.changeType(o, 'burnt_tree');
  } else {
    if (d.kind === 'structure') game.journal(`The ${d.name.toLowerCase()} burned down.`, 'danger');
    game.index.removeObject(o.id);
  }
}

/** Put water on a fire or burning object. Returns true if it went out. */
export function douse(game: Game, o: WorldObject, ml: number): boolean {
  if (o.burning) {
    o.burning -= ml / 20;
    if (o.burning <= 0) {
      o.burning = undefined;
      game.burning.delete(o.id);
      return true;
    }
    return false;
  }
  if (o.lit) {
    o.lit = false;
    o.s = Math.max(0, (o.s ?? 0) - ml / 10);
    return true;
  }
  return false;
}
