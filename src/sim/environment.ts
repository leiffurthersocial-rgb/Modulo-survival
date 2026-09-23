import { objectDef, isTree, type ShelterProps } from '@/content/objects';
import { T } from '@/content/terrain';
import { daylight } from './clock';
import type { GameState, WorldObject } from './types';
import type { WorldIndex } from './world';

export interface LocalEnv {
  airTemp: number;
  /** effective wind after shelter, m/s */
  wind: number;
  /** effective precipitation reaching the body 0..1 */
  rain: number;
  snowing: boolean;
  /** perceived C added by nearby fires */
  fireHeat: number;
  nearestFire?: WorldObject;
  fireDist: number;
  shelter?: ShelterProps;
  shelterObj?: WorldObject;
  indoor: boolean;
  /** 0..1 */
  light: number;
  inWater: boolean;
  deepWater: boolean;
  /** extra warmth from people close by (set per character, not cached) */
  huddle?: number;
}

export const SHELTER_TYPES = ['lean_to', 'tarp_shelter', 'bough_bed', 'bed', 'roof'];
export const FIRE_TYPES = ['campfire', 'fire_pit', 'stove'];

export function isLitFire(o: WorldObject): boolean {
  return !!objectDef(o.type).fire && !!o.lit && o.build === undefined;
}

/** Shelter covering this point, if any (only completed structures). */
export function shelterAt(index: WorldIndex, x: number, y: number): { def: ShelterProps; obj: WorldObject } | undefined {
  let best: { def: ShelterProps; obj: WorldObject } | undefined;
  index.objectsNear(x, y, 2, (o) => {
    if (o.build !== undefined) return;
    const d = objectDef(o.type);
    if (!d.shelter) return;
    const cx = o.x + (d.w ?? 1) / 2;
    const cy = o.y + (d.h ?? 1) / 2;
    const r = d.shelter.radius;
    if (Math.abs(x - cx) <= r && Math.abs(y - cy) <= r) {
      if (!best || d.shelter.rain + d.shelter.warmth / 10 > best.def.rain + best.def.warmth / 10) best = { def: d.shelter, obj: o };
    }
  });
  return best;
}

export function computeEnv(state: GameState, index: WorldIndex, x: number, y: number): LocalEnv {
  const w = state.weather;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const terrain = index.terrainAt(tx, ty);
  const building = index.buildingAt(tx, ty);
  const indoor = !!building;
  const sh = indoor ? undefined : shelterAt(index, x, y);

  let rain = w.precipitation;
  let wind = w.wind;
  let air = w.temp;
  if (indoor) {
    rain = 0;
    wind *= 0.1;
    air += 3;
  } else if (sh) {
    rain *= 1 - sh.def.rain;
    wind *= 1 - sh.def.wind;
    air += sh.def.warmth;
  } else if (rain > 0) {
    // tree canopy blocks some rain
    let trees = 0;
    index.objectsNear(x, y, 1, (o) => {
      if (isTree(o.type)) trees++;
    });
    rain *= 1 - Math.min(0.45, trees * 0.12);
    wind *= 1 - Math.min(0.4, trees * 0.08);
  }

  // Fires: scan the fire type index (few objects) instead of the grid.
  let fireHeat = 0;
  let nearestFire: WorldObject | undefined;
  let fireDist = Infinity;
  for (const t of FIRE_TYPES) {
    const set = index.byType.get(t);
    if (!set) continue;
    for (const id of set) {
      const o = state.objects[id];
      if (!o || !isLitFire(o)) continue;
      const d = Math.hypot(o.x + 0.5 - x, o.y + 0.5 - y);
      if (d > 7) continue;
      // indoor stoves heat the whole building
      const inSame = o.type === 'stove' && building && index.buildingAt(o.x, o.y) === building;
      const strength = Math.min(1, (o.s ?? 0) / 40 + 0.3);
      const heat = inSame ? 12 * strength : d < 5 ? 16 * Math.pow(1 - d / 5, 1.1) * strength : 0;
      fireHeat = Math.max(fireHeat, heat);
      if (d < fireDist) {
        fireDist = d;
        nearestFire = o;
      }
    }
  }
  // burning world objects (forest fire) are intensely hot
  index.objectsNear(x, y, 2, (o) => {
    if (o.burning && o.burning > 0) fireHeat = Math.max(fireHeat, 25);
  });

  let light = daylight(state.time) * (1 - 0.5 * weatherGloom(state));
  if (nearestFire && fireDist < 6) light = Math.max(light, 0.8 * (1 - fireDist / 6));

  return {
    airTemp: air,
    wind,
    rain,
    snowing: w.current === 'snow',
    fireHeat,
    nearestFire,
    fireDist,
    shelter: indoor ? { capacity: 4, rain: 1, wind: 0.9, warmth: 3, sleep: 0.3, radius: 0 } : sh?.def,
    shelterObj: sh?.obj,
    indoor,
    light,
    inWater: terrain === T.SHALLOW || terrain === T.STREAM,
    deepWater: terrain === T.DEEP,
  };
}

export function weatherGloom(state: GameState): number {
  const c = state.weather.current;
  return c === 'thunderstorm' ? 0.5 : c === 'heavyRain' ? 0.35 : c === 'snow' ? 0.25 : c === 'lightRain' ? 0.22 : c === 'fog' ? 0.18 : c === 'cloudy' ? 0.12 : 0;
}
