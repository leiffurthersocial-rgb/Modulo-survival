/** Semi-procedural loot. Contents are rolled once per container per world, then persisted. */
export type LootEntry = [item: string, weight: number, min: number, max: number];

export interface LootTable {
  rolls: [number, number];
  entries: LootEntry[];
  /** chance that a document is placed here */
  doc?: number;
}

export const LOOT: Record<string, LootTable> = {
  kitchen: {
    rolls: [1, 4],
    doc: 0.25,
    entries: [
      ['canned_beans', 6, 1, 2], ['pasta', 4, 1, 1], ['crackers', 4, 1, 2], ['chocolate', 2, 1, 1],
      ['cooking_pot', 2, 1, 1], ['water_bottle', 3, 1, 2], ['matches', 3, 1, 1], ['cloth', 3, 1, 3],
      ['soap', 2, 1, 1], ['purify_tablets', 1, 2, 6],
    ],
  },
  fridge: { rolls: [0, 2], entries: [['canned_beans', 2, 1, 1], ['chocolate', 1, 1, 1], ['water_bottle', 2, 1, 1]] },
  wardrobe: {
    rolls: [1, 3],
    doc: 0.15,
    entries: [
      ['wool_sweater', 3, 1, 1], ['hoodie', 3, 1, 1], ['rain_jacket', 2, 1, 1], ['winter_jacket', 1.5, 1, 1],
      ['hiking_pants', 2, 1, 1], ['beanie', 3, 1, 1], ['gloves', 2, 1, 1], ['tshirt', 3, 1, 2], ['hiking_boots', 1, 1, 1],
      ['sleeping_bag', 1, 1, 1], ['cloth', 2, 2, 4],
    ],
  },
  tools: {
    rolls: [1, 3],
    entries: [
      ['hatchet', 2, 1, 1], ['folding_saw', 2, 1, 1], ['hammer', 3, 1, 1], ['nails', 5, 10, 40], ['rope', 3, 1, 1],
      ['folding_shovel', 1.5, 1, 1], ['scrap_metal', 3, 1, 3], ['gloves', 2, 1, 1], ['flashlight', 1, 1, 1], ['tarp', 1.5, 1, 1],
    ],
  },
  shed: {
    rolls: [2, 4],
    doc: 0.2,
    entries: [
      ['plank', 4, 1, 4], ['nails', 3, 10, 30], ['rope', 3, 1, 1], ['tarp', 2, 1, 1], ['jerrycan', 1.5, 1, 1],
      ['hatchet', 1.5, 1, 1], ['folding_saw', 1.5, 1, 1], ['gloves', 2, 1, 1], ['scrap_metal', 2, 1, 2],
    ],
  },
  farm_shelf: {
    rolls: [1, 4],
    doc: 0.2,
    entries: [
      ['seed_potatoes', 4, 3, 8], ['bean_seeds', 3, 5, 12], ['carrot_seeds', 3, 5, 12], ['potato', 3, 2, 6],
      ['jerrycan', 1, 1, 1], ['folding_shovel', 1, 1, 1], ['rope', 2, 1, 1], ['cloth', 2, 1, 3],
    ],
  },
  barn: {
    rolls: [1, 3],
    entries: [['plank', 3, 2, 4], ['tarp', 2, 1, 1], ['rope', 2, 1, 1], ['nails', 2, 10, 20], ['potato', 2, 2, 5], ['seed_potatoes', 2, 2, 6]],
  },
  car: {
    rolls: [0, 3],
    doc: 0.3,
    entries: [
      ['water_bottle', 3, 1, 1], ['crackers', 2, 1, 1], ['chocolate', 2, 1, 1], ['bandage', 2, 1, 3], ['flashlight', 1, 1, 1],
      ['rain_jacket', 1, 1, 1], ['painkillers', 2, 2, 6], ['lighter', 1, 1, 1],
    ],
  },
  camp_crate: {
    rolls: [1, 3],
    doc: 0.8,
    entries: [['ration', 3, 1, 2], ['canned_beans', 2, 1, 1], ['rope', 2, 1, 1], ['bandage', 2, 1, 2], ['purify_tablets', 2, 2, 5], ['matches', 2, 1, 1], ['fishing_hooks', 1, 2, 4]],
  },
  industrial: {
    rolls: [1, 3],
    doc: 0.4,
    entries: [['scrap_metal', 4, 1, 3], ['gloves', 2, 1, 1], ['flashlight', 1.5, 1, 1], ['rope', 2, 1, 1], ['jerrycan', 1, 1, 1], ['antiseptic', 1, 1, 1], ['bandage', 2, 1, 3], ['hammer', 1, 1, 1]],
  },
  cabin: {
    rolls: [1, 3],
    doc: 0.35,
    entries: [
      ['canned_beans', 3, 1, 2], ['matches', 2, 1, 1], ['fishing_hooks', 2, 2, 5], ['hunting_knife', 1, 1, 1],
      ['wool_sweater', 1.5, 1, 1], ['antiseptic', 1, 1, 1], ['bandage', 2, 1, 3], 
      ['steel_bottle', 2, 1, 1], ['radio', 0.6, 1, 1], ['rope', 2, 1, 1], ['hiking_backpack', 0.7, 1, 1],
    ],
  },
  first_aid: {
    rolls: [1, 3],
    entries: [['bandage', 4, 1, 4], ['antiseptic', 2, 1, 1], ['painkillers', 3, 2, 8], ['purify_tablets', 2, 4, 10]],
  },
};
