import type { ToolTag } from './items';

export type ObjectKind =
  | 'tree'
  | 'plant'
  | 'rock'
  | 'resource'
  | 'furniture'
  | 'structure'
  | 'decor'
  | 'corpse'
  | 'carcass';

export type BuildCategory = 'fire' | 'shelter' | 'sanitation' | 'storage' | 'water' | 'food' | 'work' | 'construction';

export interface BuildDef {
  category: BuildCategory;
  materials: Record<string, number>;
  /** base work minutes at construction skill 3 */
  minutes: number;
  tool?: ToolTag;
  desc: string;
  /** placement rule */
  on?: 'ground' | 'floor' | 'soil' | 'nearWater';
  /** require this many tiles distance from water (warning only when negative) */
  warnNearWater?: number;
}

export interface ShelterProps {
  /** people who can sleep here */
  capacity: number;
  /** fraction of rain blocked */
  rain: number;
  /** fraction of wind blocked */
  wind: number;
  /** degrees C added to perceived temperature */
  warmth: number;
  /** sleep quality bonus 0..1 */
  sleep: number;
  /** radius in tiles considered "inside" */
  radius: number;
}

export interface ObjectDef {
  id: string;
  name: string;
  kind: ObjectKind;
  solid: boolean;
  w?: number;
  h?: number;
  flammable?: boolean;
  container?: number;
  fire?: { safe: boolean; maxFuel: number };
  shelter?: ShelterProps;
  build?: BuildDef;
  /** light radius in tiles when active */
  light?: number;
  /** multiplies movement speed when walking through */
  slow?: number;
  /** seats improve morale while sitting/socialising nearby */
  seat?: boolean;
}

const O: ObjectDef[] = [
  // Natural
  { id: 'spruce', name: 'Spruce', kind: 'tree', solid: true, flammable: true },
  { id: 'pine', name: 'Pine', kind: 'tree', solid: true, flammable: true },
  { id: 'beech', name: 'Beech', kind: 'tree', solid: true, flammable: true },
  { id: 'birch', name: 'Birch', kind: 'tree', solid: true, flammable: true },
  { id: 'oak', name: 'Oak', kind: 'tree', solid: true, flammable: true },
  { id: 'sapling', name: 'Sapling', kind: 'plant', solid: false, flammable: true },
  { id: 'stump', name: 'Stump', kind: 'decor', solid: true },
  { id: 'burnt_tree', name: 'Burnt Tree', kind: 'decor', solid: true },
  { id: 'fallen_log', name: 'Fallen Log', kind: 'resource', solid: true, flammable: true, w: 2 },
  { id: 'deadfall', name: 'Deadfall', kind: 'resource', solid: false, flammable: true },
  { id: 'rocks', name: 'Loose Stones', kind: 'resource', solid: false },
  { id: 'boulder', name: 'Boulder', kind: 'rock', solid: true },
  { id: 'bush', name: 'Bush', kind: 'plant', solid: false, flammable: true, slow: 0.6 },
  { id: 'fern', name: 'Ferns', kind: 'plant', solid: false, flammable: true, slow: 0.85 },
  { id: 'bilberry', name: 'Bilberry Shrub', kind: 'plant', solid: false, flammable: true, slow: 0.8 },
  { id: 'bramble', name: 'Bramble', kind: 'plant', solid: false, flammable: true, slow: 0.5 },
  { id: 'hazel', name: 'Hazel Bush', kind: 'plant', solid: true, flammable: true },
  { id: 'nettles', name: 'Nettles', kind: 'plant', solid: false, flammable: true, slow: 0.8 },
  { id: 'tall_grass', name: 'Tall Grass', kind: 'plant', solid: false, flammable: true, slow: 0.9 },
  { id: 'reeds', name: 'Reeds', kind: 'plant', solid: false, flammable: true, slow: 0.7 },
  { id: 'wild_garlic', name: 'Wild Garlic', kind: 'plant', solid: false },
  { id: 'mushrooms', name: 'Mushrooms', kind: 'plant', solid: false },
  { id: 'flowers', name: 'Wildflowers', kind: 'decor', solid: false },

  // Furniture / man-made remnants
  { id: 'cupboard', name: 'Cupboard', kind: 'furniture', solid: true, container: 8 },
  { id: 'shelf', name: 'Shelf', kind: 'furniture', solid: true, container: 8 },
  { id: 'toolbox', name: 'Toolbox', kind: 'furniture', solid: true, container: 6 },
  { id: 'fridge', name: 'Fridge', kind: 'furniture', solid: true, container: 6 },
  { id: 'crate', name: 'Crate', kind: 'furniture', solid: true, container: 8 },
  { id: 'wardrobe', name: 'Wardrobe', kind: 'furniture', solid: true, container: 8 },
  { id: 'car_wreck', name: 'Abandoned Car', kind: 'furniture', solid: true, container: 6, w: 2 },
  { id: 'bed', name: 'Old Bed', kind: 'furniture', solid: false, shelter: { capacity: 1, rain: 0, wind: 0, warmth: 1, sleep: 0.35, radius: 0.8 } },
  { id: 'table', name: 'Table', kind: 'furniture', solid: true },
  { id: 'stove', name: 'Wood Stove', kind: 'furniture', solid: true, fire: { safe: true, maxFuel: 480 }, light: 3 },
  { id: 'bench', name: 'Bench', kind: 'furniture', solid: false, seat: true },
  { id: 'fence', name: 'Fence', kind: 'decor', solid: true },
  { id: 'sign', name: 'Signpost', kind: 'decor', solid: true },
  { id: 'hay', name: 'Hay Bales', kind: 'furniture', solid: true, flammable: true },
  { id: 'corpse', name: 'Body', kind: 'corpse', solid: false, container: 24 },
  { id: 'carcass', name: 'Carcass', kind: 'carcass', solid: false },
  { id: 'pile', name: 'Dropped Items', kind: 'furniture', solid: false, container: 12 },
  { id: 'hunting_stand', name: 'Hunting Stand', kind: 'furniture', solid: true },
  { id: 'supply_bag', name: 'Group Supply Bag', kind: 'furniture', solid: false, container: 20 },

  // Player-buildable structures
  {
    id: 'campfire', name: 'Campfire', kind: 'structure', solid: true, flammable: false,
    fire: { safe: false, maxFuel: 240 }, light: 6,
    build: { category: 'fire', materials: { branch: 4 }, minutes: 6, desc: 'A quick fire on bare ground. Sparks can escape in dry, windy weather.' },
  },
  {
    id: 'fire_pit', name: 'Stone Fire Pit', kind: 'structure', solid: true,
    fire: { safe: true, maxFuel: 480 }, light: 6,
    build: { category: 'fire', materials: { stone: 8, branch: 3 }, minutes: 25, desc: 'A ring of stones. Holds more fuel and keeps sparks contained.' },
  },
  {
    id: 'lean_to', name: 'Lean-to', kind: 'structure', solid: false, w: 2, h: 1, flammable: true,
    shelter: { capacity: 2, rain: 0.85, wind: 0.6, warmth: 3, sleep: 0.25, radius: 1.3 },
    build: { category: 'shelter', materials: { branch: 12, fiber: 6 }, minutes: 60, desc: 'Branches propped on a ridge pole. Sleeps two, sheds most rain.' },
  },
  {
    id: 'tarp_shelter', name: 'Tarp Shelter', kind: 'structure', solid: false, w: 2, h: 2, flammable: true,
    shelter: { capacity: 4, rain: 0.95, wind: 0.7, warmth: 3.5, sleep: 0.3, radius: 1.6 },
    build: { category: 'shelter', materials: { tarp: 1, rope: 1, branch: 6 }, minutes: 45, desc: 'A tarp strung between poles. Dry sleeping for four.' },
  },
  {
    id: 'bough_bed', name: 'Bough Bed', kind: 'structure', solid: false, flammable: true,
    shelter: { capacity: 1, rain: 0, wind: 0.1, warmth: 1.5, sleep: 0.2, radius: 0.7 },
    build: { category: 'shelter', materials: { branch: 8 }, minutes: 20, desc: 'Springy spruce boughs keep you off the cold ground.' },
  },
  {
    id: 'latrine', name: 'Latrine', kind: 'structure', solid: false,
    build: { category: 'sanitation', materials: { branch: 4 }, minutes: 50, tool: 'dig', desc: 'A dug trench latrine. Keep it away from water.', warnNearWater: 12 },
  },
  {
    id: 'wash_station', name: 'Wash Station', kind: 'structure', solid: true,
    build: { category: 'sanitation', materials: { branch: 6, cordage: 2 }, minutes: 30, desc: 'A frame for a basin. Wash with stored water from camp.' },
  },
  {
    id: 'storage_cache', name: 'Storage Cache', kind: 'structure', solid: true, container: 16, flammable: true,
    build: { category: 'storage', materials: { log: 2, branch: 6 }, minutes: 40, desc: 'A raised log platform with a cover. Shared camp storage.' },
  },
  {
    id: 'wooden_crate', name: 'Wooden Crate', kind: 'structure', solid: true, container: 20, flammable: true,
    build: { category: 'storage', materials: { plank: 4, nails: 12 }, minutes: 30, tool: 'hammer', desc: 'A nailed crate. Keeps animals out of supplies.' },
  },
  {
    id: 'rain_collector', name: 'Rain Collector', kind: 'structure', solid: true,
    build: { category: 'water', materials: { tarp: 1, branch: 4, cordage: 2 }, minutes: 30, desc: 'A tarp funnel. Collects clean rainwater (up to 40 L).' },
  },
  {
    id: 'water_filter', name: 'Sand Filter', kind: 'structure', solid: true,
    build: { category: 'water', materials: { stone: 4, charcoal: 4, cloth: 2, branch: 4 }, minutes: 40, desc: 'Layers of cloth, sand and charcoal. Removes most contamination (not all).' },
  },
  {
    id: 'drying_rack', name: 'Drying Rack', kind: 'structure', solid: true, container: 8, flammable: true,
    build: { category: 'food', materials: { branch: 8, cordage: 2 }, minutes: 30, desc: 'Dries raw meat and fish for long storage. Needs dry weather or a nearby fire.' },
  },
  {
    id: 'garden_plot', name: 'Garden Plot', kind: 'structure', solid: false,
    build: { category: 'food', materials: {}, minutes: 40, tool: 'dig', on: 'soil', desc: 'Turned soil for planting.' },
  },
  {
    id: 'snare', name: 'Snare', kind: 'structure', solid: false,
    build: { category: 'food', materials: { cordage: 2, branch: 1 }, minutes: 15, desc: 'A wire-less cordage snare for small game. Best on forest edges.' },
  },
  {
    id: 'workbench', name: 'Workbench', kind: 'structure', solid: true,
    build: { category: 'work', materials: { log: 3, cordage: 2 }, minutes: 60, desc: 'A sturdy surface for better crafting.' },
  },
  {
    id: 'log_seat', name: 'Log Seat', kind: 'structure', solid: false, seat: true,
    build: { category: 'work', materials: { log: 1 }, minutes: 10, desc: 'Somewhere to sit by the fire.' },
  },
  {
    id: 'log_wall', name: 'Log Wall', kind: 'structure', solid: true, flammable: true,
    build: { category: 'construction', materials: { log: 2, cordage: 1 }, minutes: 35, desc: 'A section of stacked log wall.' },
  },
  {
    id: 'plank_floor', name: 'Plank Floor', kind: 'structure', solid: false,
    build: { category: 'construction', materials: { plank: 2, nails: 6 }, minutes: 20, tool: 'hammer', desc: 'A raised floor. Dry, clean ground inside a building.' },
  },
  {
    id: 'foundation', name: 'Stone Foundation', kind: 'structure', solid: false,
    build: { category: 'construction', materials: { stone: 4 }, minutes: 25, desc: 'Levelled stones. Floors and roofs can sit on it.' },
  },
  {
    id: 'roof', name: 'Roof Section', kind: 'structure', solid: false, flammable: true,
    shelter: { capacity: 1, rain: 0.9, wind: 0.3, warmth: 1.5, sleep: 0.1, radius: 0.6 },
    build: { category: 'construction', materials: { branch: 6, plank: 1 }, minutes: 30, on: 'floor', desc: 'A roof section over a floor or foundation tile.' },
  },
];

export const OBJECTS: Record<string, ObjectDef> = Object.fromEntries(O.map((d) => [d.id, d]));

export function objectDef(id: string): ObjectDef {
  return OBJECTS[id] ?? { id, name: id, kind: 'decor', solid: false };
}

export const BUILDABLE = O.filter((d) => d.build);

export const TREE_TYPES = ['spruce', 'pine', 'beech', 'birch', 'oak'] as const;
export const isTree = (t: string): boolean => (TREE_TYPES as readonly string[]).includes(t);
