export interface AnimalDef {
  id: string;
  name: string;
  hp: number;
  /** tiles per game minute */
  speed: number;
  fleeSpeed: number;
  /** distance at which it notices humans (tiles) */
  awareness: number;
  /** will charge instead of fleeing when threatened at close range */
  aggressive: number;
  damage: number;
  /** meat yield */
  meat: number;
  territory: number;
  groupSize: [number, number];
  /** population cap for the region */
  cap: number;
  /** yearly-ish births per animal per day */
  birthRate: number;
  night: boolean;
  size: number;
}

export const ANIMALS: Record<string, AnimalDef> = {
  deer: { id: 'deer', name: 'Roe Deer', hp: 60, speed: 2.2, fleeSpeed: 9, awareness: 9, aggressive: 0, damage: 0, meat: 8, territory: 40, groupSize: [2, 4], cap: 26, birthRate: 0.012, night: false, size: 1 },
  boar: { id: 'boar', name: 'Wild Boar', hp: 90, speed: 2, fleeSpeed: 7.5, awareness: 6, aggressive: 0.5, damage: 0.35, meat: 10, territory: 35, groupSize: [2, 5], cap: 22, birthRate: 0.015, night: true, size: 1 },
  fox: { id: 'fox', name: 'Red Fox', hp: 25, speed: 2.6, fleeSpeed: 9, awareness: 8, aggressive: 0, damage: 0, meat: 2, territory: 45, groupSize: [1, 1], cap: 8, birthRate: 0.01, night: true, size: 0.7 },
  hare: { id: 'hare', name: 'Hare', hp: 12, speed: 2.2, fleeSpeed: 11, awareness: 6, aggressive: 0, damage: 0, meat: 2, territory: 20, groupSize: [1, 2], cap: 40, birthRate: 0.03, night: false, size: 0.5 },
};

export const ANIMAL_IDS = Object.keys(ANIMALS);
