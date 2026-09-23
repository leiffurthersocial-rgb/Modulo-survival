import type { Appearance, AttributeId, HairStyle, TraitId } from '@/sim/types';

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
  appearance: Omit<Appearance, 'description'>;
  description: string;
  /** attribute biases from build; final values are rolled around these */
  attributeBias: Partial<Record<AttributeId, number>>;
}

const base = { facialHair: 'none' as const, glasses: false, shoeColor: '#e8e4dc' };

/** The eight known boys. Their appearance is fixed across every world. */
export const KNOWN_BOYS: KnownCharacter[] = [
  {
    id: 'robin', name: 'Robin', description: 'Blonde hair, brown eyes. Average height and build.',
    appearance: { ...base, skin: SKIN.light, hairColor: HAIR.blonde, hairStyle: 'short', eyeColor: EYES.brown, height: 'average', build: 'average', shirtColor: '#3a5a8a', pantsColor: '#2e3a52' },
    attributeBias: {},
  },
  {
    id: 'leif', name: 'Leif', description: 'Brown, fluffy hair and blue eyes. Average height, athletic build. Black t-shirt.',
    appearance: { ...base, skin: SKIN.light, hairColor: HAIR.lightBrown, hairStyle: 'fluffy', eyeColor: EYES.blue, height: 'average', build: 'athletic', shirtColor: '#1c1c20', pantsColor: '#3a4150', shoeColor: '#2a2a2e' },
    attributeBias: { strength: 1.5, endurance: 1, agility: 0.5 },
  },
  {
    id: 'jovan', name: 'Jovan', description: 'Brown hair, brown eyes. Tall with a slim, athletic build.',
    appearance: { ...base, skin: SKIN.medium, hairColor: HAIR.brown, hairStyle: 'short', eyeColor: EYES.brown, height: 'tall', build: 'slim', shirtColor: '#6a2a2a', pantsColor: '#2a2e38' },
    attributeBias: { agility: 2, endurance: 1, strength: -0.5 },
  },
  {
    id: 'leonidas', name: 'Leonidas', description: 'Brown hair, brown eyes. A little shorter than average, very muscular.',
    appearance: { ...base, skin: SKIN.olive, hairColor: HAIR.darkBrown, hairStyle: 'buzz', eyeColor: EYES.brown, height: 'short', build: 'muscular', shirtColor: '#4a5a3a', pantsColor: '#30343c' },
    attributeBias: { strength: 3, agility: -1, endurance: 0.5 },
  },
  {
    id: 'erim', name: 'Erim', description: 'Black hair, brown eyes, glasses and a goatee. Average height and build.',
    appearance: { ...base, skin: SKIN.medium, hairColor: HAIR.black, hairStyle: 'short', eyeColor: EYES.brown, height: 'average', build: 'average', glasses: true, facialHair: 'goatee', shirtColor: '#5a5a62', pantsColor: '#262a32' },
    attributeBias: { dexterity: 1.5 },
  },
  {
    id: 'lennard', name: 'Lennard', description: 'Brown hair in a middle part, brown eyes. Average height and build.',
    appearance: { ...base, skin: SKIN.light, hairColor: HAIR.brown, hairStyle: 'middlePart', eyeColor: EYES.brown, height: 'average', build: 'average', shirtColor: '#c8c0b0', pantsColor: '#3c4a64' },
    attributeBias: {},
  },
  {
    id: 'till', name: 'Till', description: 'Blonde hair, blue eyes. Average height and build.',
    appearance: { ...base, skin: SKIN.fair, hairColor: HAIR.darkBlonde, hairStyle: 'short', eyeColor: EYES.blue, height: 'average', build: 'average', shirtColor: '#2a5a4a', pantsColor: '#3a3a40' },
    attributeBias: {},
  },
  {
    id: 'tusya', name: 'Tusya', description: 'Brown skin, black hair, brown eyes. Average height and build.',
    appearance: { ...base, skin: SKIN.brown, hairColor: HAIR.black, hairStyle: 'short', eyeColor: EYES.brown, height: 'average', build: 'average', shirtColor: '#8a6a2a', pantsColor: '#2a2e38' },
    attributeBias: {},
  },
];

/** Name pool for the generated girls: names plausible for a Zurich-area class. */
export const GIRL_NAMES = [
  'Lea', 'Mia', 'Nora', 'Selina', 'Alina', 'Jana', 'Chiara', 'Lara', 'Elena', 'Sara', 'Leonie', 'Lina',
  'Noemi', 'Livia', 'Ronja', 'Aylin', 'Mira', 'Elif', 'Julia', 'Jasmin', 'Seraina', 'Flurina', 'Ladina',
  'Anja', 'Vanessa', 'Melina', 'Amina', 'Luana', 'Nina', 'Valentina', 'Emma', 'Zoe', 'Hana', 'Ilaria',
];

/** Plausible combinations of skin / hair colour so generation avoids absurd results. */
export const GIRL_LOOKS: { skin: string; hair: string[]; eyes: string[] }[] = [
  { skin: SKIN.fair, hair: [HAIR.blonde, HAIR.darkBlonde, HAIR.auburn, HAIR.red, HAIR.lightBrown], eyes: [EYES.blue, EYES.green, EYES.grey] },
  { skin: SKIN.light, hair: [HAIR.darkBlonde, HAIR.lightBrown, HAIR.brown, HAIR.blonde], eyes: [EYES.blue, EYES.brown, EYES.hazel, EYES.green] },
  { skin: SKIN.medium, hair: [HAIR.brown, HAIR.darkBrown, HAIR.black], eyes: [EYES.brown, EYES.hazel] },
  { skin: SKIN.olive, hair: [HAIR.darkBrown, HAIR.black], eyes: [EYES.brown, EYES.hazel] },
  { skin: SKIN.tan, hair: [HAIR.darkBrown, HAIR.black], eyes: [EYES.brown] },
  { skin: SKIN.brown, hair: [HAIR.black, HAIR.darkBrown], eyes: [EYES.brown] },
  { skin: SKIN.dark, hair: [HAIR.black], eyes: [EYES.brown] },
];

export const GIRL_STYLES: HairStyle[] = ['long', 'ponytail', 'bun', 'bob', 'curly', 'braid', 'long', 'ponytail'];

export const SHIRT_COLORS = ['#7a3a4a', '#3a4a6a', '#5a6a4a', '#8a7a5a', '#4a3a5a', '#2a4a4a', '#9a5a3a', '#c8c0b0', '#3a3a42', '#6a4a3a'];
export const PANTS_COLORS = ['#2e3a52', '#2a2a30', '#3c4a64', '#4a4238', '#34302c'];

export const BACKGROUNDS = [
  'Spent summers helping on an uncle\'s farm near Rafz.',
  'Was a scout leader in the Pfadi for three years.',
  'Worked weekends in a bakery in Bülach.',
  'Wanted to study medicine; volunteered with the Samariterverein.',
  'Plays handball and was the class organiser for every trip.',
  'Spent a lot of time fishing with a grandfather on the Rhine.',
  'Grew up in a flat in Glattbrugg; had never slept outdoors before.',
  'Did an apprenticeship taster week as a carpenter.',
  'Knows plants from a mother who kept a large garden.',
  'Climbed and hiked with family in Graubünden most holidays.',
  'Was the quiet one who always had a book.',
  'Helped at a family garage after school.',
  'Cooked for younger siblings most evenings.',
  'Ran cross-country for the school team.',
];

/** Trait pairs that should never be combined. */
export const TRAIT_CONFLICTS: [TraitId, TraitId][] = [
  ['brave', 'cautious'],
  ['hardworking', 'lazy'],
  ['social', 'introverted'],
  ['optimistic', 'anxious'],
  ['riskTaking', 'cautious'],
];
