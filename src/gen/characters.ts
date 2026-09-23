import { Rng } from '@/core/rng';
import { clamp } from '@/core/math';
import {
  BACKGROUNDS,
  GIRL_LOOKS,
  GIRL_NAMES,
  GIRL_STYLES,
  KNOWN_BOYS,
  PANTS_COLORS,
  SHIRT_COLORS,
  TRAIT_CONFLICTS,
} from '@/content/characters';
import { ATTR_IDS, SKILL_IDS, TRAITS, TRAIT_IDS } from '@/content/skills';
import { itemDef } from '@/content/items';
import type {
  Appearance,
  AttributeId,
  Character,
  GameMode,
  ItemStack,
  SkillId,
  TraitId,
} from '@/sim/types';

export const ATTRIBUTE_BUDGET = 30;

export function makeStack(id: string, qty = 1, extra: Partial<ItemStack> = {}): ItemStack {
  const d = itemDef(id);
  const s: ItemStack = { id, qty };
  if (d.food && d.food.spoilPerDay > 0) s.q = 1;
  if (d.tool && d.tool.wear > 0) s.q = 1;
  if (d.weapon && !d.tool) s.q = 1;
  if (d.charges !== undefined) s.charge = d.charges;
  if (d.liquidCapacity) s.liquid = { ml: 0, contam: 0 };
  if (d.containerSlots) s.contents = new Array(d.containerSlots).fill(null);
  return { ...s, ...extra };
}

function rollAttributes(rng: Rng, bias: Partial<Record<AttributeId, number>>): Record<AttributeId, number> {
  const raw: Record<string, number> = {};
  for (const a of ATTR_IDS) raw[a] = 5 + (bias[a] ?? 0) + rng.gauss(0, 1.2);
  // Normalise to a shared budget so no character is universally superior.
  const sum = ATTR_IDS.reduce((s, a) => s + raw[a], 0);
  const target = ATTRIBUTE_BUDGET + rng.range(-1, 1);
  const shift = (target - sum) / ATTR_IDS.length;
  const out = {} as Record<AttributeId, number>;
  for (const a of ATTR_IDS) out[a] = clamp(Math.round(raw[a] + shift), 2, 9);
  return out;
}

function rollSkills(rng: Rng, background: string): Record<SkillId, number> {
  const s = {} as Record<SkillId, number>;
  for (const id of SKILL_IDS) s[id] = rng.int(0, 2);
  // two or three areas of real competence
  const strong = rng.shuffle([...SKILL_IDS]).slice(0, rng.int(2, 3));
  for (const id of strong) s[id] = rng.int(4, 6);
  // backgrounds nudge skills so they read consistently
  const b = background.toLowerCase();
  const nudge = (id: SkillId, v: number) => (s[id] = clamp(s[id] + v, 0, 7));
  if (b.includes('farm') || b.includes('garden')) nudge('farming', 3);
  if (b.includes('scout')) (nudge('survival', 2), nudge('navigation', 2));
  if (b.includes('bakery') || b.includes('cooked')) nudge('cooking', 3);
  if (b.includes('medicine') || b.includes('samariter')) (nudge('firstAid', 3), nudge('medicine', 2));
  if (b.includes('fishing')) nudge('fishing', 3);
  if (b.includes('carpenter')) (nudge('construction', 3), nudge('crafting', 1));
  if (b.includes('plants')) nudge('foraging', 3);
  if (b.includes('hiked')) (nudge('navigation', 2), nudge('survival', 1));
  if (b.includes('garage')) nudge('mechanics', 3);
  return s;
}

function rollTraits(rng: Rng): TraitId[] {
  const out: TraitId[] = [];
  const pool = rng.shuffle([...TRAIT_IDS]);
  for (const t of pool) {
    if (out.length >= 3) break;
    const conflict = TRAIT_CONFLICTS.some(([a, b]) => (a === t && out.includes(b)) || (b === t && out.includes(a)));
    if (!conflict) out.push(t);
  }
  return out;
}

export function personalitySummary(traits: TraitId[]): string {
  const names = traits.map((t) => TRAITS[t].name.toLowerCase());
  if (names.length === 0) return 'Hard to read.';
  const last = names.pop();
  const s = names.length ? `${names.join(', ')} and ${last}` : last!;
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

function describe(a: Omit<Appearance, 'description'>, hairName: string): string {
  const h = a.height === 'average' ? 'Average height' : a.height === 'tall' ? 'Tall' : 'Shorter than average';
  const b = a.build === 'average' ? 'average build' : `${a.build} build`;
  const style = { long: 'long', ponytail: 'tied back', bun: 'in a bun', bob: 'in a bob', curly: 'curly', braid: 'in a braid' }[a.hairStyle as string] ?? '';
  return `${hairName} hair ${style}. ${h}, ${b}.`.replace('  ', ' ');
}

const HAIR_NAMES: Record<string, string> = {
  '#d8b45a': 'Blonde', '#b08a48': 'Dark blonde', '#8a5e36': 'Light brown', '#5e3c22': 'Brown',
  '#3e2716': 'Dark brown', '#1e1a1a': 'Black', '#8a3a22': 'Auburn', '#b0502a': 'Red',
};

function baseNeeds(rng: Rng) {
  return {
    satiety: rng.range(55, 75),
    reserves: rng.range(65, 85),
    hydration: rng.range(60, 80),
    energy: rng.range(78, 95),
    stamina: 100,
    bladder: rng.range(10, 40),
    hygiene: rng.range(55, 75),
    bodyTemp: 37,
    wetness: 0,
    stress: rng.range(30, 50),
    morale: rng.range(40, 60),
  };
}

function starterKit(rng: Rng, mode: GameMode, sex: string, build: string): { inv: ItemStack[]; eq: Character['equipment'] } {
  const eq: Character['equipment'] = {
    torso: makeStack('tshirt'),
    legs: makeStack(rng.chance(0.65) ? 'jeans' : 'hiking_pants'),
    feet: makeStack(rng.chance(0.7) ? 'sneakers' : 'hiking_boots'),
    back: makeStack('school_backpack'),
  };
  const outer = rng.weighted([['hoodie', 4], ['rain_jacket', 2], ['none', 2]] as const);
  if (outer !== 'none') eq.outer = makeStack(outer);
  if (rng.chance(0.2)) eq.head = makeStack('beanie');
  const inv: ItemStack[] = [];
  inv.push(makeStack('water_bottle', 1, { liquid: { ml: rng.int(500, 1000), contam: 0 } }));
  inv.push(makeStack('ration', mode === 'hardcore' ? 1 : 2));
  if (rng.chance(0.35)) inv.push(makeStack('pocket_knife'));
  if (rng.chance(0.25)) inv.push(makeStack('lighter', 1, { charge: rng.int(20, 80) }));
  if (rng.chance(0.25)) inv.push(makeStack('flashlight', 1, { charge: rng.int(40, 100) }));
  if (rng.chance(0.3)) inv.push(makeStack('chocolate'));
  if (rng.chance(0.2)) inv.push(makeStack('bandage', rng.int(1, 2)));
  void sex;
  void build;
  return { inv, eq };
}

function emptyAI(): Character['ai'] {
  return { order: 'none', task: 'idle', taskLabel: 'Resting', nextThink: 0, stuck: 0, errors: 0 };
}

export function buildCharacter(
  rng: Rng,
  mode: GameMode,
  id: string,
  name: string,
  sex: 'm' | 'f',
  fixed: boolean,
  appearance: Appearance,
  bias: Partial<Record<AttributeId, number>>,
): Character {
  const background = rng.pick(BACKGROUNDS);
  const traits = rollTraits(rng);
  const kit = starterKit(rng, mode, sex, appearance.build);
  const inventory: (ItemStack | null)[] = new Array(8 + 8).fill(null);
  kit.inv.forEach((s, i) => (inventory[i] = s));
  return {
    id,
    name,
    sex,
    age: 18,
    fixed,
    appearance,
    traits,
    personalitySummary: personalitySummary(traits),
    background,
    attributes: rollAttributes(rng, bias),
    skills: rollSkills(rng, background),
    needs: baseNeeds(rng),
    health: { hp: 100, injuries: [], illnesses: [], pain: 0 },
    statuses: [],
    inventory,
    equipment: kit.eq,
    x: 0,
    y: 0,
    facing: 'down',
    moving: false,
    sprinting: false,
    alive: true,
    sleeping: false,
    sleepQuality: 0.5,
    awakeMinutes: 600,
    ai: emptyAI(),
    memories: [],
    pendingReports: [],
    pendingExplored: [],
    exertion: 1,
  };
}

/**
 * Generates the full class: the eight fixed boys plus eight girls who are
 * generated once from the world seed and then stored in the save.
 */
export function generateRoster(seed: number, mode: GameMode): Character[] {
  const rng = new Rng(seed ^ 0x51a55);
  const out: Character[] = [];
  for (const k of KNOWN_BOYS) {
    const appearance: Appearance = { ...k.appearance, description: k.description };
    out.push(buildCharacter(rng, mode, k.id, k.name, 'm', true, appearance, k.attributeBias));
  }
  const names = rng.shuffle([...GIRL_NAMES]).slice(0, 8);
  const styles = rng.shuffle([...GIRL_STYLES]);
  for (let i = 0; i < 8; i++) {
    const look = rng.pick(GIRL_LOOKS);
    const hair = rng.pick(look.hair);
    const height = rng.weighted([['short', 3], ['average', 5], ['tall', 2]] as const);
    const build = rng.weighted([['slim', 3], ['average', 5], ['athletic', 3]] as const);
    const partial = {
      skin: look.skin,
      hairColor: hair,
      hairStyle: styles[i],
      eyeColor: rng.pick(look.eyes),
      height,
      build,
      glasses: rng.chance(0.2),
      facialHair: 'none' as const,
      shirtColor: rng.pick(SHIRT_COLORS),
      pantsColor: rng.pick(PANTS_COLORS),
      shoeColor: rng.pick(['#e8e4dc', '#2a2a2e', '#8a6a4a']),
    };
    const appearance: Appearance = { ...partial, description: describe(partial, HAIR_NAMES[hair] ?? 'Brown') };
    const bias: Partial<Record<AttributeId, number>> = {};
    if (build === 'athletic') (bias.endurance = 1, bias.agility = 1);
    if (build === 'slim') bias.agility = 1;
    if (height === 'tall') bias.strength = 0.5;
    const id = names[i].toLowerCase().replace(/[^a-z]/g, '') + '_' + i;
    out.push(buildCharacter(rng, mode, id, names[i], 'f', false, appearance, bias));
  }
  return out;
}
