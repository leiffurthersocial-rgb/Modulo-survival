/**
 * Serializable game state. Everything in GameState must survive
 * JSON round-tripping (typed arrays are encoded by the save layer).
 */

export type Dir = 'down' | 'up' | 'left' | 'right';
export type Sex = 'm' | 'f';
export type GameMode = 'normal' | 'hardcore';
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherId = 'clear' | 'cloudy' | 'lightRain' | 'heavyRain' | 'fog' | 'snow' | 'thunderstorm';

export type SkillId =
  | 'survival'
  | 'foraging'
  | 'cooking'
  | 'crafting'
  | 'construction'
  | 'farming'
  | 'hunting'
  | 'fishing'
  | 'trapping'
  | 'medicine'
  | 'firstAid'
  | 'mechanics'
  | 'navigation';

export type AttributeId = 'strength' | 'endurance' | 'agility' | 'dexterity' | 'recovery' | 'constitution';

export type TraitId =
  | 'brave'
  | 'cautious'
  | 'hardworking'
  | 'lazy'
  | 'social'
  | 'introverted'
  | 'curious'
  | 'practical'
  | 'riskTaking'
  | 'compassionate'
  | 'independent'
  | 'optimistic'
  | 'anxious'
  | 'stubborn';

export type EquipSlot = 'head' | 'torso' | 'outer' | 'legs' | 'feet' | 'hands' | 'back' | 'hand';

export interface Liquid {
  /** millilitres */
  ml: number;
  /** 0 = safe, 1 = heavily contaminated */
  contam: number;
}

export interface ItemStack {
  id: string;
  qty: number;
  /** Freshness for food (1 fresh .. 0 rotten) or durability for tools (1 .. 0 broken). */
  q?: number;
  liquid?: Liquid;
  /** Remaining uses/charge for consumable-charge items (matches, lighter, flashlight). */
  charge?: number;
  /** For portable containers (duffel bag). */
  contents?: (ItemStack | null)[];
  /** Document id for readable notes. */
  doc?: string;
  /** Grime on clothing (0 clean .. 1 filthy). */
  dirt?: number;
}

export interface Appearance {
  skin: string;
  hairColor: string;
  hairStyle: HairStyle;
  eyeColor: string;
  height: 'short' | 'average' | 'tall';
  build: 'slim' | 'average' | 'athletic' | 'muscular';
  glasses: boolean;
  facialHair: 'none' | 'goatee' | 'stubble';
  shirtColor: string;
  pantsColor: string;
  shoeColor: string;
  /** Short plain-language description, used only in the character sheet. */
  description: string;
}

export type HairStyle =
  | 'short'
  | 'fluffy'
  | 'middlePart'
  | 'buzz'
  | 'long'
  | 'ponytail'
  | 'bun'
  | 'bob'
  | 'curly'
  | 'braid';

export interface Needs {
  /** 0 starving .. 100 full */
  satiety: number;
  /** long-term body reserves (fat), 0..100; burned when the stomach is empty */
  reserves: number;
  /** 0 dehydrated .. 100 hydrated */
  hydration: number;
  /** 0 exhausted .. 100 rested (sleep pressure inverse) */
  energy: number;
  /** short-term exertion 0..100 */
  stamina: number;
  /** 0 empty .. 100 urgent */
  bladder: number;
  /** 0 filthy .. 100 clean */
  hygiene: number;
  /** core body temperature in C */
  bodyTemp: number;
  /** 0 dry .. 100 soaked */
  wetness: number;
  /** 0 calm .. 100 overwhelmed */
  stress: number;
  /** 0 despair .. 100 good spirits */
  morale: number;
}

export type InjuryType = 'cut' | 'bruise' | 'sprain' | 'burn' | 'animalWound';
export interface Injury {
  id: number;
  type: InjuryType;
  /** 0..1 */
  severity: number;
  bleeding: number;
  bandaged: boolean;
  /** 0..1 infection progression */
  infection: number;
  /** game minutes since received */
  age: number;
}

export type IllnessType = 'stomachBug' | 'foodPoisoning' | 'cold' | 'hypothermia' | 'infectionFever';
export interface Illness {
  type: IllnessType;
  /** 0..1 */
  severity: number;
  /** game minutes */
  age: number;
}

export interface Health {
  hp: number;
  injuries: Injury[];
  illnesses: Illness[];
  pain: number;
}

export interface Memory {
  kind: MemoryKind;
  who?: string;
  day: number;
  /** signed emotional weight; decays */
  weight: number;
  text: string;
}
export type MemoryKind =
  | 'helped'
  | 'sharedFood'
  | 'argued'
  | 'injuredBy'
  | 'death'
  | 'discovery'
  | 'expedition'
  | 'campEvent'
  | 'talked'
  | 'breakup'
  | 'partnered';

export type OrderId =
  | 'none'
  | 'follow'
  | 'stay'
  | 'gatherWood'
  | 'gatherFood'
  | 'gatherWater'
  | 'build'
  | 'cook'
  | 'fish'
  | 'hunt'
  | 'explore'
  | 'watchCamp'
  | 'rest'
  | 'returnCamp';

export interface ActionState {
  type: string;
  /** game minutes */
  duration: number;
  elapsed: number;
  targetId?: number;
  tx?: number;
  ty?: number;
  data?: Record<string, unknown>;
}

export interface NpcAI {
  order: OrderId;
  orderX?: number;
  orderY?: number;
  task: string;
  taskLabel: string;
  targetX?: number;
  targetY?: number;
  targetId?: number;
  path?: number[];
  pathIndex?: number;
  /** game minute at which the NPC should reconsider */
  nextThink: number;
  expeditionId?: number;
  lastSpeech?: number;
  stuck: number;
  refusedUntil?: number;
  errors: number;
  /** task id -> game minute it last finished or failed */
  recent?: Record<string, number>;
  /** task id -> game minute until which the task is known to be impossible */
  blocked?: Record<string, number>;
}

export interface Character {
  id: string;
  name: string;
  sex: Sex;
  age: number;
  fixed: boolean;
  appearance: Appearance;
  traits: TraitId[];
  personalitySummary: string;
  background: string;
  attributes: Record<AttributeId, number>;
  skills: Record<SkillId, number>;
  needs: Needs;
  health: Health;
  statuses: string[];
  inventory: (ItemStack | null)[];
  equipment: Partial<Record<EquipSlot, ItemStack | null>>;
  x: number;
  y: number;
  facing: Dir;
  moving: boolean;
  sprinting: boolean;
  alive: boolean;
  death?: { day: number; cause: string; x: number; y: number };
  sleeping: boolean;
  sleepQuality: number;
  sleepStart?: number;
  /** minutes awake since last proper sleep */
  awakeMinutes: number;
  action?: ActionState;
  ai: NpcAI;
  memories: Memory[];
  lastSeen?: { x: number; y: number; t: number };
  /** Discovered tiles are tracked per group; NPCs keep a list of discoveries to report. */
  pendingReports: string[];
  pendingExplored: number[];
  /** Activity level in METs-like units for the last tick. */
  exertion: number;
  speech?: { text: string; from?: number; until: number };
  painkillerUntil?: number;
}

export interface WorldObject {
  id: number;
  type: string;
  x: number;
  y: number;
  /** generic numeric state (growth, uses, fuel minutes, hits taken...) */
  s?: number;
  /** secondary state */
  s2?: number;
  /** variant seed for rendering */
  v?: number;
  /** container contents */
  inv?: (ItemStack | null)[];
  /** container not yet generated */
  lootTable?: string;
  /** fire */
  lit?: boolean;
  /** game minute until which a burned-down fire still has live embers */
  embers?: number;
  burning?: number;
  /** construction progress (0..1); undefined when complete */
  build?: number;
  /** water stored in litres for water structures */
  water?: Liquid;
  /** farming */
  crop?: { id: string; growth: number; water: number; health: number; plantedDay: number };
  /** readable document */
  doc?: string;
  /** name for corpse objects */
  label?: string;
  /** game minute when regrowth completes */
  regrow?: number;
}

export interface BuildingPOI {
  id: number;
  kind: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  doorX: number;
  doorY: number;
  discovered: boolean;
}

export interface MapMarker {
  id: number;
  kind: MarkerKind;
  x: number;
  y: number;
  label: string;
}
export type MarkerKind = 'home' | 'water' | 'food' | 'danger' | 'loot' | 'hunting' | 'interesting' | 'unknown' | 'camp';

export interface WeatherState {
  current: WeatherId;
  /** game minute of last change */
  since: number;
  /** air temperature C */
  temp: number;
  /** multi-day anomaly (cold/warm periods) */
  anomaly: number;
  /** m/s */
  wind: number;
  windDir: number;
  /** 0..1 */
  precipitation: number;
  /** 0..1 */
  visibility: number;
  /** 0..1 ground dryness (fire risk) */
  dryness: number;
  /** cm */
  snowDepth: number;
  nextLightning: number;
}

export interface Animal {
  id: number;
  species: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  facing: Dir;
  state: 'idle' | 'graze' | 'wander' | 'flee' | 'drink' | 'sleep' | 'charge' | 'dead';
  tx?: number;
  ty?: number;
  hp: number;
  hunger: number;
  thirst: number;
  timer: number;
  fear: number;
  moving: boolean;
}

export interface Expedition {
  id: number;
  members: string[];
  objective: string;
  kind: 'explore' | 'forage' | 'fish' | 'hunt' | 'loot';
  targetX: number;
  targetY: number;
  targetName: string;
  departed: number;
  expectedReturn: number;
  status: 'outbound' | 'working' | 'returning' | 'sheltering' | 'returned' | 'lost';
  workUntil?: number;
  log: string[];
}

export interface Relationship {
  /** -100..100 */
  affinity: number;
  /** 0..100 */
  trust: number;
  /** 0..100 */
  romance: number;
  partners: boolean;
  rivals: boolean;
  interactions: number;
}

export interface JournalEntry {
  t: number;
  day: number;
  text: string;
  kind: 'event' | 'discovery' | 'social' | 'death' | 'camp' | 'expedition' | 'danger' | 'lore';
}

export interface Population {
  count: number;
  cap: number;
}

export interface GameState {
  saveVersion: number;
  seed: number;
  mode: GameMode;
  worldName: string;
  createdAt: number;
  /** total elapsed game minutes since world start (day 1, 06:00 is minute 0 offset) */
  time: number;
  /** game time when this world began */
  startTime: number;
  weather: WeatherState;
  width: number;
  height: number;
  terrain: Uint8Array;
  explored: Uint8Array;
  /** coarse sanitation contamination grid (CONTAM_CELL tiles per cell) */
  contamination: Float32Array;
  objects: Record<number, WorldObject>;
  buildings: BuildingPOI[];
  characters: Record<string, Character>;
  playerId: string;
  animals: Record<number, Animal>;
  populations: Record<string, Population>;
  fishStock: Record<string, number>;
  homePin?: { x: number; y: number };
  startPoint: { x: number; y: number };
  markers: MapMarker[];
  expeditions: Expedition[];
  relationships: Record<string, Relationship>;
  journal: JournalEntry[];
  lore: { cause: string; found: string[]; placed?: string[] };
  hints: string[];
  nextId: number;
  stats: { deaths: number; daysSurvived: number; structuresBuilt: number };
}
