import { Rng } from '@/core/rng';
import { CLASS_ROSTER, type KnownCharacter } from '@/content/characters';
import { SKILL_IDS, TRAITS } from '@/content/skills';
import { itemDef } from '@/content/items';
import type {
  Appearance,
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

export function personalitySummary(traits: TraitId[]): string {
  const names = traits.map((t) => TRAITS[t].name.toLowerCase());
  if (names.length === 0) return 'Hard to read.';
  const last = names.pop();
  const s = names.length ? `${names.join(', ')} and ${last}` : last!;
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

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

function starterKit(rng: Rng, mode: GameMode, id: string): { inv: ItemStack[]; eq: Character['equipment'] } {
  const eq: Character['equipment'] = {
    torso: makeStack('tshirt'),
    legs: makeStack(rng.chance(0.65) ? 'jeans' : 'hiking_pants'),
    feet: makeStack(rng.chance(0.7) ? 'sneakers' : 'hiking_boots'),
    back: makeStack('school_backpack'),
  };
  const outer = rng.weighted([['hoodie', 4], ['rain_jacket', 2], ['none', 2]] as const);
  // everyone keeps their described look: no hats, and Leif in his black t-shirt
  if (outer !== 'none' && id !== 'leif') eq.outer = makeStack(outer);
  const inv: ItemStack[] = [];
  inv.push(makeStack('water_bottle', 1, { liquid: { ml: rng.int(500, 1000), contam: 0 } }));
  inv.push(makeStack('ration', mode === 'hardcore' ? 1 : 2));
  if (rng.chance(0.35)) inv.push(makeStack('pocket_knife'));
  if (rng.chance(0.25)) inv.push(makeStack('lighter', 1, { charge: rng.int(20, 80) }));
  if (rng.chance(0.25)) inv.push(makeStack('flashlight', 1, { charge: rng.int(40, 100) }));
  if (rng.chance(0.3)) inv.push(makeStack('chocolate'));
  if (rng.chance(0.2)) inv.push(makeStack('bandage', rng.int(1, 2)));
  return { inv, eq };
}

function emptyAI(): Character['ai'] {
  return { order: 'none', task: 'idle', taskLabel: 'Resting', nextThink: 0, stuck: 0, errors: 0 };
}

function skillsOf(k: KnownCharacter): Record<SkillId, number> {
  const s = {} as Record<SkillId, number>;
  for (const id of SKILL_IDS) s[id] = k.skills[id] ?? 1;
  return s;
}

export function buildCharacter(rng: Rng, mode: GameMode, k: KnownCharacter): Character {
  const kit = starterKit(rng, mode, k.id);
  const inventory: (ItemStack | null)[] = new Array(8 + 8).fill(null);
  kit.inv.forEach((s, i) => (inventory[i] = s));
  const appearance: Appearance = { ...k.appearance, description: k.description };
  return {
    id: k.id,
    name: k.name,
    sex: k.sex,
    age: 18,
    fixed: true,
    appearance,
    traits: [...k.traits],
    personalitySummary: personalitySummary(k.traits),
    background: k.background,
    attributes: { ...k.attributes },
    skills: skillsOf(k),
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
 * The full class of sixteen. Everyone's looks, personality, stats and skills
 * are fixed; the world seed only varies the starting kit and first needs.
 */
export function generateRoster(seed: number, mode: GameMode): Character[] {
  const rng = new Rng(seed ^ 0x51a55);
  return CLASS_ROSTER.map((k) => buildCharacter(rng, mode, k));
}
