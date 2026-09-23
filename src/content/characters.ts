import type { Appearance, AttributeId, SkillId, TraitId } from '@/sim/types';

export const SKIN = {
  fair: '#f2d0b0',
  light: '#e8bf98',
  medium: '#d4a077',
  olive: '#c08a5e',
  tan: '#a8714a',
  brown: '#8a5a3a',
  dark: '#5e3b26',
} as const;

export const HAIR = {
  blonde: '#d8b45a',
  darkBlonde: '#b08a48',
  lightBrown: '#8a5e36',
  brown: '#5e3c22',
  darkBrown: '#3e2716',
  black: '#1e1a1a',
  auburn: '#8a3a22',
  red: '#b0502a',
} as const;

export const EYES = { brown: '#4a2c1a', blue: '#3a6ea8', green: '#4a7a3a', hazel: '#6a5a2a', grey: '#6a7078' } as const;

export interface KnownCharacter {
  id: string;
  name: string;
  sex: 'm' | 'f';
  appearance: Omit<Appearance, 'description'>;
  description: string;
  /** Personality: always three traits, never a conflicting pair. */
  traits: TraitId[];
  background: string;
  /** Attributes 2..9, summing to ATTRIBUTE_BUDGET so nobody is strictly better. */
  attributes: Record<AttributeId, number>;
  /** Skills that differ from the baseline of 1. */
  skills: Partial<Record<SkillId, number>>;
}

const base = { facialHair: 'none' as const, glasses: false, shoeColor: '#e8e4dc' };
const attrs = (strength: number, endurance: number, agility: number, dexterity: number, recovery: number, constitution: number) => ({
  strength, endurance, agility, dexterity, recovery, constitution,
});

/**
 * The whole class: sixteen fixed classmates. Looks, personality, stats and
 * skills are the same in every world; only the world and starting kit vary.
 */
export const KNOWN_BOYS: KnownCharacter[] = [
  {
    id: 'robin', name: 'Robin', sex: 'm', description: 'Blonde hair, brown eyes. Average height and build.',
    appearance: { ...base, skin: SKIN.light, hairColor: HAIR.blonde, hairStyle: 'short', eyeColor: EYES.brown, height: 'average', build: 'average', shirtColor: '#3a5a8a', pantsColor: '#2e3a52' },
    traits: ['social', 'practical', 'anxious'],
    background: 'Plays handball and was the class organiser for every trip.',
    attributes: attrs(5, 5, 5, 5, 5, 5),
    skills: { navigation: 4, cooking: 4, firstAid: 3 },
  },
  {
    id: 'leif', name: 'Leif', sex: 'm', description: 'Brown, fluffy hair and blue eyes. Average height, athletic build. Black t-shirt.',
    appearance: { ...base, skin: SKIN.light, hairColor: HAIR.lightBrown, hairStyle: 'fluffy', eyeColor: EYES.blue, height: 'average', build: 'athletic', shirtColor: '#1c1c20', pantsColor: '#3a4150', shoeColor: '#2a2a2e' },
    traits: ['curious', 'independent', 'brave'],
    background: 'Climbed and hiked with family in Graubünden most holidays.',
    attributes: attrs(7, 6, 6, 4, 4, 3),
    skills: { survival: 5, navigation: 5, construction: 3 },
  },
  {
    id: 'jovan', name: 'Jovan', sex: 'm', description: 'Brown hair, brown eyes. Tall with a slim, athletic build.',
    appearance: { ...base, skin: SKIN.medium, hairColor: HAIR.brown, hairStyle: 'short', eyeColor: EYES.brown, height: 'tall', build: 'slim', shirtColor: '#6a2a2a', pantsColor: '#2a2e38' },
    traits: ['practical', 'cautious', 'introverted'],
    background: 'Ran cross-country for the school team.',
    attributes: attrs(4, 7, 7, 5, 4, 3),
    skills: { foraging: 4, hunting: 4, trapping: 3 },
  },
  {
    id: 'leonidas', name: 'Leonidas', sex: 'm', description: 'Brown hair, brown eyes. A little shorter than average, very muscular.',
    appearance: { ...base, skin: SKIN.olive, hairColor: HAIR.darkBrown, hairStyle: 'buzz', eyeColor: EYES.brown, height: 'short', build: 'muscular', shirtColor: '#4a5a3a', pantsColor: '#30343c' },
    traits: ['stubborn', 'brave', 'hardworking'],
    background: 'Did an apprenticeship taster week as a carpenter.',
    attributes: attrs(9, 6, 3, 4, 4, 4),
    skills: { construction: 5, crafting: 4 },
  },
  {
    id: 'erim', name: 'Erim', sex: 'm', description: 'Black hair, brown eyes, glasses and a goatee. Average height and build.',
    appearance: { ...base, skin: SKIN.medium, hairColor: HAIR.black, hairStyle: 'short', eyeColor: EYES.brown, height: 'average', build: 'average', glasses: true, facialHair: 'goatee', shirtColor: '#5a5a62', pantsColor: '#262a32' },
    traits: ['curious', 'practical', 'optimistic'],
    background: 'Helped at a family garage after school.',
    attributes: attrs(4, 4, 5, 8, 4, 5),
    skills: { mechanics: 6, crafting: 5, construction: 2 },
  },
  {
    id: 'lennard', name: 'Lennard', sex: 'm', description: 'Brown hair in a middle part, brown eyes. Average height and build.',
    appearance: { ...base, skin: SKIN.light, hairColor: HAIR.brown, hairStyle: 'middlePart', eyeColor: EYES.brown, height: 'average', build: 'average', shirtColor: '#c8c0b0', pantsColor: '#3c4a64' },
    traits: ['optimistic', 'social', 'lazy'],
    background: 'Grew up in a flat in Glattbrugg; had never slept outdoors before.',
    attributes: attrs(5, 4, 5, 5, 6, 5),
    skills: { cooking: 5, firstAid: 3 },
  },
  {
    id: 'till', name: 'Till', sex: 'm', description: 'Blonde hair, blue eyes. Average height and build.',
    appearance: { ...base, skin: SKIN.fair, hairColor: HAIR.darkBlonde, hairStyle: 'short', eyeColor: EYES.blue, height: 'average', build: 'average', shirtColor: '#2a5a4a', pantsColor: '#3a3a40' },
    traits: ['compassionate', 'hardworking', 'anxious'],
    background: 'Wanted to study medicine; volunteered with the Samariterverein.',
    attributes: attrs(4, 5, 5, 6, 5, 5),
    skills: { firstAid: 6, medicine: 4 },
  },
  {
    id: 'tusya', name: 'Tusya', sex: 'm', description: 'Brown skin, black hair, brown eyes. Average height and build.',
    appearance: { ...base, skin: SKIN.brown, hairColor: HAIR.black, hairStyle: 'short', eyeColor: EYES.brown, height: 'average', build: 'average', shirtColor: '#8a6a2a', pantsColor: '#2a2e38' },
    traits: ['introverted', 'cautious', 'stubborn'],
    background: 'Spent a lot of time fishing with a grandfather on the Rhine.',
    attributes: attrs(5, 6, 5, 6, 4, 4),
    skills: { fishing: 6, trapping: 4, survival: 2 },
  },
];

export const KNOWN_GIRLS: KnownCharacter[] = [
  {
    id: 'mia', name: 'Mia', sex: 'f', description: 'Dark blonde hair tied back, green eyes. Average height, athletic build.',
    appearance: { ...base, skin: SKIN.light, hairColor: HAIR.darkBlonde, hairStyle: 'ponytail', eyeColor: EYES.green, height: 'average', build: 'athletic', shirtColor: '#5a6a4a', pantsColor: '#4a4238', shoeColor: '#8a6a4a' },
    traits: ['brave', 'riskTaking', 'hardworking'],
    background: 'Was a scout leader in the Pfadi for three years.',
    attributes: attrs(5, 7, 6, 4, 4, 4),
    skills: { survival: 6, navigation: 4, hunting: 2 },
  },
  {
    id: 'nora', name: 'Nora', sex: 'f', description: 'Curly red hair, green eyes. Shorter than average, slim build.',
    appearance: { ...base, skin: SKIN.fair, hairColor: HAIR.red, hairStyle: 'curly', eyeColor: EYES.green, height: 'short', build: 'slim', shirtColor: '#c8c0b0', pantsColor: '#2e3a52' },
    traits: ['curious', 'optimistic', 'social'],
    background: 'Knows plants from a mother who kept a large garden.',
    attributes: attrs(3, 5, 6, 6, 5, 5),
    skills: { foraging: 6, farming: 4, cooking: 2 },
  },
  {
    id: 'seraina', name: 'Seraina', sex: 'f', description: 'Brown hair in a braid, blue eyes. Tall, athletic build.',
    appearance: { ...base, skin: SKIN.light, hairColor: HAIR.brown, hairStyle: 'braid', eyeColor: EYES.blue, height: 'tall', build: 'athletic', shirtColor: '#7a3a4a', pantsColor: '#34302c', shoeColor: '#8a6a4a' },
    traits: ['hardworking', 'practical', 'stubborn'],
    background: 'Spent summers helping on an uncle\'s farm near Rafz.',
    attributes: attrs(7, 6, 4, 4, 4, 5),
    skills: { farming: 6, construction: 3, hunting: 3 },
  },
  {
    id: 'alina', name: 'Alina', sex: 'f', description: 'Long black hair, brown eyes. Average height and build.',
    appearance: { ...base, skin: SKIN.tan, hairColor: HAIR.black, hairStyle: 'long', eyeColor: EYES.brown, height: 'average', build: 'average', shirtColor: '#3a4a6a', pantsColor: '#2a2a30' },
    traits: ['compassionate', 'cautious', 'introverted'],
    background: 'Cooked for younger siblings most evenings.',
    attributes: attrs(4, 5, 4, 6, 6, 5),
    skills: { cooking: 6, medicine: 3, foraging: 2 },
  },
  {
    id: 'livia', name: 'Livia', sex: 'f', description: 'Dark brown hair in a bun, hazel eyes, glasses. Average height, slim build.',
    appearance: { ...base, skin: SKIN.olive, hairColor: HAIR.darkBrown, hairStyle: 'bun', eyeColor: EYES.hazel, height: 'average', build: 'slim', glasses: true, shirtColor: '#4a3a5a', pantsColor: '#3c4a64', shoeColor: '#2a2a2e' },
    traits: ['curious', 'introverted', 'anxious'],
    background: 'Was the quiet one who always had a book.',
    attributes: attrs(3, 4, 5, 7, 5, 6),
    skills: { medicine: 5, navigation: 3, crafting: 3 },
  },
  {
    id: 'chiara', name: 'Chiara', sex: 'f', description: 'Curly dark brown hair, brown eyes. Shorter than average, average build.',
    appearance: { ...base, skin: SKIN.medium, hairColor: HAIR.darkBrown, hairStyle: 'curly', eyeColor: EYES.brown, height: 'short', build: 'average', shirtColor: '#9a5a3a', pantsColor: '#2e3a52' },
    traits: ['social', 'optimistic', 'riskTaking'],
    background: 'Worked weekends in a bakery in Bülach.',
    attributes: attrs(5, 5, 6, 5, 5, 4),
    skills: { cooking: 4, trapping: 3, fishing: 3 },
  },
  {
    id: 'julia', name: 'Julia', sex: 'f', description: 'Long blonde hair, blue eyes. Tall, slim build.',
    appearance: { ...base, skin: SKIN.fair, hairColor: HAIR.blonde, hairStyle: 'long', eyeColor: EYES.blue, height: 'tall', build: 'slim', shirtColor: '#2a4a4a', pantsColor: '#2a2a30', shoeColor: '#2a2a2e' },
    traits: ['independent', 'brave', 'practical'],
    background: 'Rode at a stable near Eglisau and is at ease around animals.',
    attributes: attrs(5, 7, 6, 4, 4, 4),
    skills: { hunting: 4, trapping: 4, survival: 3 },
  },
  {
    id: 'noemi', name: 'Noemi', sex: 'f', description: 'Black hair in a bob, brown eyes. Average height, athletic build.',
    appearance: { ...base, skin: SKIN.dark, hairColor: HAIR.black, hairStyle: 'bob', eyeColor: EYES.brown, height: 'average', build: 'athletic', shirtColor: '#8a7a5a', pantsColor: '#34302c' },
    traits: ['hardworking', 'social', 'compassionate'],
    background: 'Built treehouses and rafts with older cousins every summer.',
    attributes: attrs(6, 6, 5, 5, 4, 4),
    skills: { construction: 5, crafting: 4, fishing: 2 },
  },
];

export const CLASS_ROSTER: KnownCharacter[] = [...KNOWN_BOYS, ...KNOWN_GIRLS];

/** Trait pairs that should never be combined. */
export const TRAIT_CONFLICTS: [TraitId, TraitId][] = [
  ['brave', 'cautious'],
  ['hardworking', 'lazy'],
  ['social', 'introverted'],
  ['optimistic', 'anxious'],
  ['riskTaking', 'cautious'],
];
