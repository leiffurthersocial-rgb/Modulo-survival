import { clamp } from '@/core/math';
import { itemDef } from '@/content/items';
import { STATUSES, type StatusMods } from '@/content/statuses';
import type { Character, EquipSlot, Illness, IllnessType, Injury, InjuryType } from './types';
import type { LocalEnv } from './environment';
import type { Game } from './game';
import { countItem } from './inventory';
import { daylight } from './clock';

/** Aggregated modifiers from active status effects. */
export function statusMods(c: Character): Required<StatusMods> {
  const m = { speed: 1, work: 1, staminaRegen: 1, stress: 0, morale: 0, accident: 1 };
  for (const id of c.statuses) {
    const s = STATUSES.find((x) => x.id === id);
    if (!s) continue;
    m.speed *= s.mods.speed ?? 1;
    m.work *= s.mods.work ?? 1;
    m.staminaRegen *= s.mods.staminaRegen ?? 1;
    m.stress += s.mods.stress ?? 0;
    m.morale += s.mods.morale ?? 0;
    m.accident *= s.mods.accident ?? 1;
  }
  return m;
}

const SLOT_RAIN_COVER: Partial<Record<EquipSlot, number>> = { outer: 0.5, torso: 0.1, head: 0.1, legs: 0.18, feet: 0.12 };

export function clothingInsulation(c: Character): { warmth: number; waterproof: number } {
  let warmth = 0;
  let waterproof = 0;
  for (const k in c.equipment) {
    const s = c.equipment[k as EquipSlot];
    if (!s) continue;
    const cl = itemDef(s.id).clothing;
    if (!cl) continue;
    // wet cotton loses most of its insulation, wool keeps more of it
    const wool = s.id === 'wool_sweater';
    const wetLoss = (c.needs.wetness / 100) * (wool ? 0.25 : 0.65) * (1 - cl.waterproof);
    // grime mats fibres and holds sweat, so filthy clothes insulate a little worse
    warmth += cl.warmth * (1 - wetLoss) * (s.q !== undefined ? 0.6 + 0.4 * s.q : 1) * (1 - (s.dirt ?? 0) * 0.15);
    waterproof += cl.waterproof * (SLOT_RAIN_COVER[k as EquipSlot] ?? 0);
  }
  return { warmth, waterproof: clamp(waterproof, 0, 0.95) };
}

/** Average grime of worn clothing (0..1). */
export function clothingDirt(c: Character): number {
  let sum = 0;
  let n = 0;
  for (const k in c.equipment) {
    const s = c.equipment[k as EquipSlot];
    if (!s || !itemDef(s.id).clothing) continue;
    sum += s.dirt ?? 0;
    n++;
  }
  return n ? sum / n : 0;
}

export function hasSleepingBag(c: Character): boolean {
  return countItem(c.inventory, 'sleeping_bag') > 0;
}

const COMFORT = 24;

/** The temperature the body "feels" given clothing, activity and surroundings. */
export function perceivedTemp(c: Character, env: LocalEnv): number {
  const { warmth } = clothingInsulation(c);
  const windChill = env.wind * 0.8;
  const metabolic = (c.exertion - 1) * 3;
  const wetChill = (c.needs.wetness / 100) * 4;
  const base = env.airTemp + env.fireHeat - windChill + metabolic - wetChill + (env.huddle ?? 0);
  // when warm, people open jackets and shed layers (a quarter of the insulation stays on)
  const clothes = warmth * 2.2;
  let p = base + (base + clothes > COMFORT ? clamp(COMFORT - base, clothes * 0.25, clothes) : clothes);
  // and unzip the sleeping bag instead of cooking in it
  if (c.sleeping && hasSleepingBag(c)) p += clamp(COMFORT + 2 - p, 0, 9);
  if (env.inWater) p -= 6;
  if (env.deepWater) p -= 14;
  return p;
}

export interface BodyTickResult {
  damageCause?: string;
}

/**
 * Advances one character's physiology by dt game minutes.
 * Systems are coupled: wetness drives heat loss, cold burns calories,
 * exertion drives thirst, illness drains fluids, and so on.
 */
export function updateBody(game: Game, c: Character, dt: number, env: LocalEnv): void {
  const n = c.needs;
  const hc = game.state.mode === 'hardcore';
  const hcMul = hc ? 1.2 : 1;
  const a = c.attributes;
  const mods = statusMods(c);
  let damage = 0;
  let cause = '';
  const hurt = (v: number, why: string) => {
    if (v > damage) cause = why;
    damage += v;
  };

  const ex = c.sleeping ? 0.75 : c.exertion;

  // --- Temperature and wetness -------------------------------------------
  const { waterproof } = clothingInsulation(c);
  if (env.rain > 0.01) n.wetness += env.rain * 1.4 * (1 - waterproof) * dt;
  if (env.inWater) n.wetness = Math.max(n.wetness, Math.min(60, n.wetness + 3 * dt));
  if (env.deepWater) n.wetness = 100;
  const beingWetted = env.rain > 0.05 || env.inWater;
  if (!beingWetted) {
    const dry = 0.07 + env.fireHeat * 0.06 + Math.max(0, env.airTemp - 12) * 0.006 + env.wind * 0.01 + (env.shelter ? 0.02 : 0);
    n.wetness -= dry * dt;
  }
  n.wetness = clamp(n.wetness, 0, 100);

  const p = perceivedTemp(c, env);
  const coldK = 0.0008 * (1.18 - a.endurance * 0.035) * hcMul;
  if (p < 18) {
    let deficit = 18 - p;
    // shivering and thermogenesis: burn calories to defend core temperature
    if ((n.satiety > 5 || n.reserves > 10) && n.bodyTemp > 34.5) {
      // shivering roughly doubles heat production at most (a few hundred kcal an hour)
      const covered = Math.min(deficit, 7);
      if (n.satiety > 5) n.satiety -= covered * 0.007 * dt;
      else n.reserves -= covered * 0.007 * dt * 0.08;
      deficit -= covered * (n.bodyTemp > 36.5 ? 1 : 0.6);
    }
    n.bodyTemp -= deficit * coldK * dt;
    if (deficit <= 0 && n.bodyTemp < 37) n.bodyTemp += 0.015 * dt;
  } else if (p > 28) {
    // sweating holds the core steady until it is really hot, as long as there is water to sweat
    const sweat = n.hydration > 15 ? 6 : 1;
    const excess = p - 28 - sweat;
    if (excess > 0) n.bodyTemp += excess * 0.0006 * dt;
    else n.bodyTemp += (37 - n.bodyTemp) * Math.min(1, 0.02 * dt);
    n.hydration -= (p - 28) * 0.012 * dt;
    n.hygiene -= (p - 28) * 0.004 * dt;
    if (n.bodyTemp > 37.5) n.wetness = Math.min(100, n.wetness + 0.05 * dt);
  } else {
    n.bodyTemp += (37 - n.bodyTemp) * Math.min(1, 0.02 * dt);
  }
  // fever raises core temperature
  const fever = c.health.illnesses.find((i) => i.type === 'infectionFever');
  if (fever) n.bodyTemp = Math.max(n.bodyTemp, 37 + fever.severity * 2.5 * Math.min(1, fever.age / 120));
  n.bodyTemp = clamp(n.bodyTemp, 28, 41.5);
  if (n.bodyTemp < 35) hurt((35 - n.bodyTemp + 0.4) * 0.05 * dt, 'hypothermia');
  if (n.bodyTemp > 39.5 && !fever) hurt((n.bodyTemp - 39.5) * 0.05 * dt, 'heatstroke');

  // --- Energy balance ----------------------------------------------------
  const conMul = 1 - (a.constitution - 5) * 0.025;
  const burn = 0.04 * ex * conMul * hcMul * dt;
  if (n.satiety > 0) n.satiety -= burn;
  else n.reserves -= burn * 0.08; // the body draws on its reserves: roughly two weeks without food
  // a full stomach slowly rebuilds reserves
  if (n.satiety > 75 && n.reserves < 100) {
    n.reserves += 0.004 * dt;
    n.satiety -= 0.004 * dt * 8;
  }
  n.hydration -= (0.05 + (ex - 1) * 0.03 + Math.max(0, env.airTemp - 20) * 0.003) * conMul * hcMul * dt;
  n.bladder += (c.sleeping ? 0.07 : 0.18) * dt;
  n.hygiene -= (0.011 + (ex - 1) * 0.01 + clothingDirt(c) * 0.006) * dt;
  // clothes pick up dirt from work, sweat and sleeping on the ground
  const grime = (0.00012 + Math.max(0, ex - 1) * 0.00025) * dt;
  for (const k in c.equipment) {
    const s = c.equipment[k as EquipSlot];
    if (s && itemDef(s.id).clothing) s.dirt = Math.min(1, (s.dirt ?? 0) + grime);
  }

  // --- Sleep / fatigue -----------------------------------------------------
  if (c.sleeping) {
    // even poor sleep restores a good part of what a proper night would
    n.energy += 0.21 * (0.45 + 0.55 * c.sleepQuality) * (0.85 + a.recovery * 0.03) * dt;
    n.stamina = Math.min(100, n.stamina + 2 * dt);
    c.awakeMinutes = Math.max(0, c.awakeMinutes - 2.5 * dt);
  } else {
    c.awakeMinutes += dt;
    const sickTired = c.health.illnesses.length ? 0.02 : 0;
    const coldTired = n.bodyTemp < 36 ? 0.02 : 0;
    n.energy -= (0.068 + (ex - 1) * 0.02 + sickTired + coldTired + n.stress * 0.0002) * hcMul * dt;
  }

  // --- Stamina ---------------------------------------------------------------
  const staminaMax = 100;
  if (c.sprinting && c.moving) n.stamina -= (3.5 - a.endurance * 0.15) * dt;
  else if (c.exertion >= 2) n.stamina -= (0.6 - a.endurance * 0.03) * dt;
  else {
    const regen = (3 + a.endurance * 0.2) * mods.staminaRegen * (n.energy < 20 ? 0.5 : 1) * (n.satiety < 10 ? 0.5 : 1);
    n.stamina += regen * dt;
  }
  n.stamina = clamp(n.stamina, 0, staminaMax);

  // --- Starvation and dehydration ------------------------------------------
  if (n.satiety <= 0 && n.reserves <= 3) hurt(0.012 * dt * hcMul, 'starvation');
  if (n.hydration <= 0) hurt(0.03 * dt * hcMul, 'dehydration');
  if (n.energy <= 0 && !c.sleeping) {
    n.energy = 0;
    // collapse from exhaustion
    game.forceSleep(c, 'collapsed from exhaustion');
  }

  // --- Toilet -----------------------------------------------------------------
  if (n.bladder >= 100 && !c.sleeping) game.relieve(c, 'accident');

  // --- Injuries -------------------------------------------------------------
  const h = c.health;
  let pain = 0;
  for (const inj of h.injuries) {
    inj.age += dt;
    if (inj.bleeding > 0) {
      hurt(inj.bleeding * (inj.bandaged ? 0.1 : 1) * 0.08 * dt, 'blood loss');
      // clotting
      inj.bleeding = Math.max(0, inj.bleeding - (inj.bandaged ? 0.02 : 0.0025) * dt * (inj.severity < 0.5 ? 2 : 1));
    }
    const dirty = (100 - n.hygiene) / 100;
    const open = inj.type === 'cut' || inj.type === 'animalWound' || inj.type === 'burn';
    if (open && !inj.bandaged) inj.infection += (0.00012 + dirty * 0.0004) * (1.2 - a.recovery * 0.04) * hcMul * dt;
    else if (open && inj.bandaged) inj.infection += dirty * 0.00006 * dt;
    if (inj.infection > 0 && inj.infection < 0.2 && n.hygiene > 60) inj.infection -= 0.00008 * dt;
    inj.infection = clamp(inj.infection, 0, 1);
    if (inj.infection > 0.6 && !h.illnesses.some((i) => i.type === 'infectionFever')) addIllness(game, c, 'infectionFever', 0.4);
    // healing
    const healRate = (0.00012 + a.recovery * 0.00003) * (c.sleeping ? 2 : 1) * (n.satiety > 20 ? 1 : 0.3) * (inj.infection > 0.3 ? 0.2 : 1);
    if (inj.bleeding < 0.05) inj.severity -= healRate * dt;
    pain += inj.severity * 60 * (inj.type === 'sprain' ? 1.2 : 1);
  }
  h.injuries = h.injuries.filter((i) => i.severity > 0.02);

  // --- Illness -------------------------------------------------------------
  for (const ill of h.illnesses) {
    ill.age += dt;
    const peak = ill.type === 'cold' ? 600 : ill.type === 'infectionFever' ? 900 : 360;
    const resist = 0.00025 + a.recovery * 0.00005 + (c.sleeping ? 0.0002 : 0) + (n.hydration > 40 ? 0.0001 : 0);
    if (ill.age < peak) ill.severity += 0.0006 * dt * (ill.type === 'infectionFever' ? (c.health.injuries.some((i) => i.infection > 0.5) ? 1 : -0.5) : 0.5);
    else ill.severity -= resist * dt;
    ill.severity = clamp(ill.severity, 0, 1);
    if (ill.type === 'stomachBug' || ill.type === 'foodPoisoning') {
      n.hydration -= ill.severity * 0.06 * dt;
      n.bladder += ill.severity * 0.25 * dt;
      n.satiety -= ill.severity * 0.02 * dt;
    }
    if (ill.type === 'infectionFever') {
      n.hydration -= ill.severity * 0.03 * dt;
      hurt(ill.severity * 0.012 * dt, 'infection');
    }
    if (ill.type === 'cold') n.energy -= ill.severity * 0.01 * dt;
    pain += ill.severity * 25;
  }
  h.illnesses = h.illnesses.filter((i) => i.severity > 0.01 || i.age < 30);

  // cold and wet exposure can cause a head cold
  if (n.bodyTemp < 36 && n.wetness > 40 && !h.illnesses.some((i) => i.type === 'cold')) {
    if (game.rng.chance(0.0004 * dt * (1.3 - a.recovery * 0.05))) addIllness(game, c, 'cold', 0.2);
  }
  // camp sanitation: contaminated surroundings and poor hygiene
  const contam = game.index.contamAt(c.x, c.y);
  if (contam > 0.15 && !h.illnesses.some((i) => i.type === 'stomachBug')) {
    const risk = contam * 0.00008 * (1.5 - n.hygiene / 100) * dt * hcMul;
    if (game.rng.chance(risk)) addIllness(game, c, 'stomachBug', 0.25, 'poor sanitation around camp');
  }

  // painkillers
  h.pain = clamp(pain - ((c.painkillerUntil ?? 0) > game.state.time ? 35 : 0), 0, 100);

  // --- Health ---------------------------------------------------------------
  if (damage > 0) {
    h.hp -= damage;
  } else if (n.satiety > 10 && n.hydration > 10 && n.bodyTemp > 35.5) {
    h.hp += (0.008 + a.recovery * 0.0015) * (c.sleeping ? 2.5 : 1) * dt;
  }
  const maxHp = 80 + a.constitution * 4;
  h.hp = clamp(h.hp, 0, maxHp);

  // --- Stress and morale ------------------------------------------------------
  let stressDelta = mods.stress / 60;
  if (env.fireHeat > 3) stressDelta -= 0.02;
  if (c.sleeping) stressDelta -= 0.03;
  if (env.shelter) stressDelta -= 0.005;
  if (daylight(game.state.time) < 0.2 && !env.nearestFire) stressDelta += 0.004;
  stressDelta -= 0.004;
  if (c.traits.includes('anxious')) stressDelta += 0.006;
  n.stress = clamp(n.stress + stressDelta * dt, 0, 100);

  const targetMorale = game.moraleTarget(c, env);
  const moraleRate = c.traits.includes('optimistic') ? 0.004 : 0.003;
  n.morale += (targetMorale - n.morale) * moraleRate * dt + (mods.morale / 60) * dt;
  n.morale = clamp(n.morale, 0, 100);

  n.satiety = clamp(n.satiety, 0, 100);
  n.reserves = clamp(n.reserves, 0, 100);
  n.hydration = clamp(n.hydration, 0, 100);
  n.energy = clamp(n.energy, 0, 100);
  n.bladder = clamp(n.bladder, 0, 100);
  n.hygiene = clamp(n.hygiene, 0, 100);

  // --- Statuses ------------------------------------------------------------
  c.statuses = STATUSES.filter((s) => s.test(c)).map((s) => s.id);

  if (h.hp <= 0) game.killCharacter(c, cause || 'their injuries');
}

export function maxHp(c: Character): number {
  return 80 + c.attributes.constitution * 4;
}

let injuryCounter = 1;

export function addInjury(game: Game, c: Character, type: InjuryType, severity: number, why: string): Injury {
  const prot = protectionOf(c);
  const hc = game.state.mode === 'hardcore' ? 1.4 : 1;
  const sev = clamp(severity * (1 - prot * 0.6) * hc, 0.05, 1);
  const bleeding = type === 'cut' || type === 'animalWound' ? sev * 0.8 : 0;
  const inj: Injury = { id: injuryCounter++, type, severity: sev, bleeding, bandaged: false, infection: 0, age: 0 };
  c.health.injuries.push(inj);
  c.health.hp -= sev * 12;
  c.needs.stress = Math.min(100, c.needs.stress + sev * 25);
  game.onInjury(c, inj, why);
  return inj;
}

export function addIllness(game: Game, c: Character, type: IllnessType, severity: number, why?: string): Illness {
  const existing = c.health.illnesses.find((i) => i.type === type);
  if (existing) {
    existing.severity = Math.min(1, existing.severity + severity * 0.5);
    return existing;
  }
  const ill: Illness = { type, severity, age: 0 };
  c.health.illnesses.push(ill);
  game.onIllness(c, ill, why);
  return ill;
}

export function protectionOf(c: Character): number {
  let p = 0;
  for (const k in c.equipment) {
    const s = c.equipment[k as EquipSlot];
    if (s) p += itemDef(s.id).clothing?.protection ?? 0;
  }
  return Math.min(0.8, p);
}
