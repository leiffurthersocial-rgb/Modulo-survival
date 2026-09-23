/** Terrain registry. Terrain is stored per tile as a byte. */
export const T = {
  DEEP: 0,
  SHALLOW: 1,
  GRASS: 2,
  FOREST: 3,
  PATH: 4,
  ROAD: 5,
  MUD: 6,
  GRAVEL: 7,
  FIELD: 8,
  FLOOR: 9,
  WALL: 10,
  CONCRETE: 11,
  STREAM: 12,
  ROCK: 13,
} as const;
export type TerrainId = (typeof T)[keyof typeof T];

export interface TerrainDef {
  id: number;
  name: string;
  walkable: boolean;
  speed: number;
  /** water source kind if any */
  water?: 'pond' | 'stream' | 'lake';
  /** base contamination for water drawn here */
  contam?: number;
  buildable: boolean;
  /** makes feet wet / dirty */
  wets?: number;
  dirties?: number;
  soil?: boolean;
  indoor?: boolean;
}

export const TERRAIN: TerrainDef[] = [
  { id: T.DEEP, name: 'Deep Water', walkable: false, speed: 0, water: 'lake', contam: 0.35, buildable: false },
  { id: T.SHALLOW, name: 'Shallow Water', walkable: true, speed: 0.45, water: 'pond', contam: 0.45, buildable: false, wets: 1 },
  { id: T.GRASS, name: 'Meadow', walkable: true, speed: 1, buildable: true, soil: true },
  { id: T.FOREST, name: 'Forest Floor', walkable: true, speed: 0.92, buildable: true, soil: true },
  { id: T.PATH, name: 'Forest Path', walkable: true, speed: 1.1, buildable: true },
  { id: T.ROAD, name: 'Road', walkable: true, speed: 1.15, buildable: true },
  { id: T.MUD, name: 'Mud', walkable: true, speed: 0.7, buildable: false, dirties: 1, soil: true },
  { id: T.GRAVEL, name: 'Gravel', walkable: true, speed: 1, buildable: true },
  { id: T.FIELD, name: 'Old Field', walkable: true, speed: 0.95, buildable: true, soil: true },
  { id: T.FLOOR, name: 'Floorboards', walkable: true, speed: 1.05, buildable: true, indoor: true },
  { id: T.WALL, name: 'Wall', walkable: false, speed: 0, buildable: false },
  { id: T.CONCRETE, name: 'Concrete', walkable: true, speed: 1.1, buildable: true, indoor: true },
  { id: T.STREAM, name: 'Stream', walkable: true, speed: 0.55, water: 'stream', contam: 0.25, buildable: false, wets: 1 },
  { id: T.ROCK, name: 'Rocky Ground', walkable: true, speed: 0.9, buildable: true },
];

export const terrainDef = (id: number): TerrainDef => TERRAIN[id] ?? TERRAIN[T.GRASS];
export const isWater = (id: number): boolean => id === T.DEEP || id === T.SHALLOW || id === T.STREAM;
