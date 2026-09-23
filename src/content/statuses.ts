import type { Character } from '@/sim/types';

export interface StatusMods {
  /** movement speed multiplier */
  speed?: number;
  /** work speed multiplier */
  work?: number;
  /** stamina regen multiplier */
  staminaRegen?: number;
  /** stress per hour */
  stress?: number;
  /** morale per hour */
  morale?: number;
  /** accident risk multiplier */
  accident?: number;
}

export interface StatusDef {
  id: string;
  name: string;
  desc: string;
  tone: 'good' | 'info' | 'warn' | 'bad';
  test: (c: Character) => boolean;
  mods: StatusMods;
}

const hasIllness = (c: Character, t: string) => c.health.illnesses.some((i) => i.type === t && i.severity > 0.05);

/** Status effects are derived from the simulated body state every tick. */
export const STATUSES: StatusDef[] = [
  { id: 'starving', name: 'Starving', desc: 'Your reserves are gone. Health is failing.', tone: 'bad', test: (c) => c.needs.satiety <= 3 && c.needs.reserves < 10, mods: { speed: 0.75, work: 0.55, staminaRegen: 0.35, morale: -4, stress: 2 } },
  { id: 'famished', name: 'Famished', desc: 'An empty stomach. Your body is burning its reserves; you are weak.', tone: 'bad', test: (c) => c.needs.satiety <= 3 && c.needs.reserves >= 10, mods: { speed: 0.9, work: 0.75, staminaRegen: 0.6, morale: -2, stress: 1 } },
  { id: 'hungry', name: 'Hungry', desc: 'Your stomach is empty and you are getting weaker.', tone: 'warn', test: (c) => c.needs.satiety > 3 && c.needs.satiety < 25, mods: { work: 0.92, staminaRegen: 0.8, morale: -1 } },
  { id: 'underweight', name: 'Underweight', desc: 'Weeks of too little food. Everything is harder and colder.', tone: 'warn', test: (c) => c.needs.reserves < 30, mods: { work: 0.9, staminaRegen: 0.85, morale: -0.5 } },
  { id: 'dehydrated', name: 'Dehydrated', desc: 'Headache, weakness. Drink soon.', tone: 'bad', test: (c) => c.needs.hydration < 12, mods: { speed: 0.85, work: 0.7, staminaRegen: 0.5, stress: 2 } },
  { id: 'thirsty', name: 'Thirsty', desc: 'Your mouth is dry.', tone: 'warn', test: (c) => c.needs.hydration >= 12 && c.needs.hydration < 30, mods: { staminaRegen: 0.85 } },
  { id: 'exhausted', name: 'Exhausted', desc: 'You can barely keep your eyes open. Mistakes are likely.', tone: 'bad', test: (c) => c.needs.energy < 12, mods: { speed: 0.8, work: 0.6, staminaRegen: 0.5, accident: 2.5, stress: 1.5 } },
  { id: 'tired', name: 'Tired', desc: 'You need sleep.', tone: 'warn', test: (c) => c.needs.energy >= 12 && c.needs.energy < 30, mods: { work: 0.9, accident: 1.4 } },
  { id: 'rested', name: 'Well Rested', desc: 'A proper night of sleep.', tone: 'good', test: (c) => c.needs.energy > 85 && c.sleepQuality > 0.65 && c.awakeMinutes < 360, mods: { work: 1.1, morale: 0.5 } },
  { id: 'bursting', name: 'Needs the Toilet', desc: 'You really need to go.', tone: 'warn', test: (c) => c.needs.bladder > 80, mods: { work: 0.85, stress: 1 } },
  { id: 'filthy', name: 'Filthy', desc: 'Dirt and sweat raise the risk of infection and illness.', tone: 'warn', test: (c) => c.needs.hygiene < 20, mods: { morale: -1 } },
  { id: 'soaked', name: 'Soaked', desc: 'Wet clothes pull heat from your body.', tone: 'warn', test: (c) => c.needs.wetness > 60, mods: { speed: 0.95, morale: -1.5 } },
  { id: 'wet', name: 'Damp', desc: 'Your clothes are wet.', tone: 'info', test: (c) => c.needs.wetness > 20 && c.needs.wetness <= 60, mods: {} },
  { id: 'hypothermic', name: 'Hypothermia', desc: 'Dangerously cold. Get warm and dry now.', tone: 'bad', test: (c) => c.needs.bodyTemp < 35, mods: { speed: 0.7, work: 0.5, staminaRegen: 0.4, stress: 3 } },
  { id: 'cold', name: 'Cold', desc: 'Shivering. You burn more energy.', tone: 'warn', test: (c) => c.needs.bodyTemp >= 35 && c.needs.bodyTemp < 36.3, mods: { work: 0.85, morale: -1 } },
  { id: 'overheated', name: 'Overheated', desc: 'Sweating heavily. You lose water fast.', tone: 'warn', test: (c) => c.needs.bodyTemp > 37.8, mods: { speed: 0.9, work: 0.85 } },
  { id: 'warm', name: 'Warm', desc: 'Comfortable and warm.', tone: 'good', test: (c) => c.needs.bodyTemp >= 36.8 && c.needs.bodyTemp <= 37.4 && c.needs.wetness < 10, mods: { morale: 0.3 } },
  { id: 'bleeding', name: 'Bleeding', desc: 'An open wound is bleeding. Bandage it.', tone: 'bad', test: (c) => c.health.injuries.some((i) => i.bleeding > 0.02 && !i.bandaged), mods: { stress: 2 } },
  { id: 'injured', name: 'Injured', desc: 'Hurt. Work is slower and painful.', tone: 'warn', test: (c) => c.health.injuries.some((i) => i.severity > 0.25), mods: { speed: 0.9, work: 0.85 } },
  { id: 'infected', name: 'Infected Wound', desc: 'A wound is red and hot. Clean it and rest.', tone: 'bad', test: (c) => c.health.injuries.some((i) => i.infection > 0.3), mods: { work: 0.8, stress: 1 } },
  { id: 'sick', name: 'Sick', desc: 'Nausea and cramps. You lose fluids.', tone: 'bad', test: (c) => hasIllness(c, 'stomachBug') || hasIllness(c, 'foodPoisoning'), mods: { speed: 0.85, work: 0.7, morale: -2 } },
  { id: 'cold_illness', name: 'Head Cold', desc: 'Sniffles and aching limbs.', tone: 'warn', test: (c) => hasIllness(c, 'cold'), mods: { work: 0.85, staminaRegen: 0.8 } },
  { id: 'fever', name: 'Fever', desc: 'An infection has spread. You need rest, warmth and water.', tone: 'bad', test: (c) => hasIllness(c, 'infectionFever'), mods: { speed: 0.8, work: 0.5, staminaRegen: 0.5 } },
  { id: 'in_pain', name: 'In Pain', desc: 'Pain makes everything harder.', tone: 'warn', test: (c) => c.health.pain > 40, mods: { work: 0.85, stress: 1.5 } },
  { id: 'stressed', name: 'Stressed', desc: 'Anxious and on edge.', tone: 'warn', test: (c) => c.needs.stress > 70, mods: { work: 0.9, accident: 1.3 } },
  { id: 'grieving', name: 'Grieving', desc: 'Someone is gone.', tone: 'bad', test: (c) => c.memories.some((m) => m.kind === 'death' && m.weight < -20), mods: { work: 0.85, morale: -1 } },
];

export const statusById = (id: string): StatusDef | undefined => STATUSES.find((s) => s.id === id);
