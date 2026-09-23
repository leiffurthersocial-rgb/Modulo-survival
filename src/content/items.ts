import type { EquipSlot } from '@/sim/types';

export type ItemCategory =
  | 'food'
  | 'water'
  | 'tool'
  | 'weapon'
  | 'clothing'
  | 'material'
  | 'medical'
  | 'light'
  | 'misc'
  | 'document'
  | 'seed'
  | 'container';

export type ToolTag = 'cut' | 'chop' | 'saw' | 'dig' | 'hammer' | 'ignite' | 'fish' | 'boil' | 'open';

export interface FoodProps {
  kcal: number;
  /** hydration points restored */
  hydration?: number;
  /** freshness lost per day at 15C (0 = does not spoil) */
  spoilPerDay: number;
  /** chance of food poisoning when eaten (scaled by freshness and cooking skill) */
  risk?: number;
  /** morale gained */
  morale?: number;
  /** warms the body when eaten */
  warming?: number;
  /** eating takes this many game minutes */
  eatMinutes?: number;
  /** needs a cutting/opening tool to eat */
  needsOpen?: boolean;
}

export interface ClothingProps {
  slot: EquipSlot;
  /** insulation contribution in "clo-like" points */
  warmth: number;
  /** 0..1 */
  waterproof: number;
  /** 0..1 reduces injury severity */
  protection: number;
  color?: string;
  visual?: 'tshirt' | 'hoodie' | 'jacket' | 'raincoat' | 'sweater' | 'beanie' | 'gloves' | 'boots' | 'sneakers' | 'jeans' | 'pants';
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  category: ItemCategory;
  /** kg per unit */
  weight: number;
  maxStack: number;
  food?: FoodProps;
  /** container capacity in ml */
  liquidCapacity?: number;
  tool?: { tags: ToolTag[]; power: number; wear: number };
  weapon?: { damage: number; reach: number };
  clothing?: ClothingProps;
  backpack?: { slots: number; carry: number };
  medical?: 'bandage' | 'antiseptic' | 'painkiller' | 'purify';
  light?: { radius: number; drainPerHour: number };
  /** minutes of burn time when added to a fire */
  fuel?: number;
  /** default charges (matches count, lighter uses, battery %) */
  charges?: number;
  seed?: string;
  /** placeable as structure */
  places?: string;
  /** portable container slots */
  containerSlots?: number;
}

const I: ItemDef[] = [
  // --- Materials -----------------------------------------------------------
  { id: 'log', name: 'Log', desc: 'A heavy length of trunk. Split it for firewood or use it to build.', category: 'material', weight: 6, maxStack: 4, fuel: 240 },
  { id: 'firewood', name: 'Firewood', desc: 'Split wood. Burns long and steady.', category: 'material', weight: 1.5, maxStack: 10, fuel: 80 },
  { id: 'branch', name: 'Branches', desc: 'Dead branches and sticks. Kindling, frames, handles.', category: 'material', weight: 0.4, maxStack: 20, fuel: 20 },
  { id: 'stone', name: 'Stone', desc: 'A fist-sized stone.', category: 'material', weight: 1, maxStack: 10 },
  { id: 'fiber', name: 'Plant Fibre', desc: 'Stringy fibre stripped from nettles and tall grass.', category: 'material', weight: 0.05, maxStack: 30, fuel: 3 },
  { id: 'cordage', name: 'Cordage', desc: 'Twisted plant fibre. Weak but useful.', category: 'material', weight: 0.05, maxStack: 20 },
  { id: 'rope', name: 'Rope', desc: 'Ten metres of nylon rope.', category: 'material', weight: 0.5, maxStack: 5 },
  { id: 'tarp', name: 'Tarp', desc: 'A green plastic tarp. Keeps rain off.', category: 'material', weight: 1.2, maxStack: 3 },
  { id: 'cloth', name: 'Cloth', desc: 'Scraps of fabric.', category: 'material', weight: 0.15, maxStack: 20, fuel: 5 },
  { id: 'nails', name: 'Nails', desc: 'Steel nails.', category: 'material', weight: 0.01, maxStack: 100 },
  { id: 'plank', name: 'Plank', desc: 'A salvaged or sawn board.', category: 'material', weight: 2, maxStack: 8, fuel: 60 },
  { id: 'scrap_metal', name: 'Scrap Metal', desc: 'Sheet metal and brackets.', category: 'material', weight: 1, maxStack: 10 },
  { id: 'charcoal', name: 'Charcoal', desc: 'Black remains of a hot fire. Useful for filtering water.', category: 'material', weight: 0.1, maxStack: 20, fuel: 30 },

  // --- Food ----------------------------------------------------------------
  { id: 'ration', name: 'Emergency Ration', desc: 'A dense compressed ration bar. Tastes of flour and fat.', category: 'food', weight: 0.13, maxStack: 10, food: { kcal: 500, spoilPerDay: 0, eatMinutes: 5 } },
  { id: 'canned_beans', name: 'Canned Beans', desc: 'Beans in tomato sauce. Needs a knife to open.', category: 'food', weight: 0.45, maxStack: 6, food: { kcal: 420, hydration: 6, spoilPerDay: 0, eatMinutes: 10, needsOpen: true, morale: 2 } },
  { id: 'crackers', name: 'Crackers', desc: 'A pack of crackers. A little stale.', category: 'food', weight: 0.2, maxStack: 6, food: { kcal: 380, hydration: -4, spoilPerDay: 0.005, eatMinutes: 5 } },
  { id: 'chocolate', name: 'Chocolate', desc: 'A bar of Swiss milk chocolate.', category: 'food', weight: 0.1, maxStack: 6, food: { kcal: 530, spoilPerDay: 0.002, eatMinutes: 3, morale: 8 } },
  { id: 'pasta', name: 'Dry Pasta', desc: 'Needs boiling.', category: 'food', weight: 0.5, maxStack: 4, food: { kcal: 1750, spoilPerDay: 0, eatMinutes: 20, risk: 0.35, morale: -5 } },
  { id: 'cooked_pasta', name: 'Pasta', desc: 'Boiled pasta. Filling and warm.', category: 'food', weight: 0.9, maxStack: 2, food: { kcal: 1750, hydration: 10, spoilPerDay: 0.5, eatMinutes: 20, morale: 10, warming: 1 } },
  { id: 'bilberries', name: 'Bilberries', desc: 'A handful of small forest berries.', category: 'food', weight: 0.1, maxStack: 20, food: { kcal: 45, hydration: 3, spoilPerDay: 0.35, eatMinutes: 2, morale: 1 } },
  { id: 'blackberries', name: 'Blackberries', desc: 'Sweet bramble berries.', category: 'food', weight: 0.1, maxStack: 20, food: { kcal: 50, hydration: 3, spoilPerDay: 0.35, eatMinutes: 2, morale: 1 } },
  { id: 'hazelnuts', name: 'Hazelnuts', desc: 'Shelled hazelnuts. Rich and slow to spoil.', category: 'food', weight: 0.1, maxStack: 20, food: { kcal: 160, spoilPerDay: 0.01, eatMinutes: 3 } },
  { id: 'wild_garlic', name: 'Wild Garlic', desc: 'Bärlauch leaves. Pungent, a little nourishing.', category: 'food', weight: 0.05, maxStack: 20, food: { kcal: 12, hydration: 1, spoilPerDay: 0.4, eatMinutes: 1 } },
  { id: 'chanterelles', name: 'Chanterelles', desc: 'Golden forest mushrooms. Best cooked.', category: 'food', weight: 0.1, maxStack: 20, food: { kcal: 20, spoilPerDay: 0.3, eatMinutes: 2, risk: 0.08 } },
  { id: 'mushrooms_unknown', name: 'Unidentified Mushrooms', desc: 'You are not sure what these are.', category: 'food', weight: 0.1, maxStack: 20, food: { kcal: 20, spoilPerDay: 0.3, eatMinutes: 2, risk: 0.45 } },
  { id: 'roasted_mushrooms', name: 'Roasted Mushrooms', desc: 'Mushrooms seared over a fire.', category: 'food', weight: 0.1, maxStack: 20, food: { kcal: 30, spoilPerDay: 0.4, eatMinutes: 3, morale: 2, warming: 0.3 } },
  { id: 'raw_meat', name: 'Raw Meat', desc: 'Fresh game meat. Cook it before eating.', category: 'food', weight: 0.5, maxStack: 10, food: { kcal: 300, spoilPerDay: 0.55, eatMinutes: 10, risk: 0.5, morale: -6 } },
  { id: 'cooked_meat', name: 'Cooked Meat', desc: 'Roasted game meat.', category: 'food', weight: 0.4, maxStack: 10, food: { kcal: 360, hydration: 2, spoilPerDay: 0.3, eatMinutes: 10, morale: 8, warming: 0.8 } },
  { id: 'dried_meat', name: 'Dried Meat', desc: 'Lean strips dried on a rack. Keeps for weeks.', category: 'food', weight: 0.2, maxStack: 20, food: { kcal: 330, hydration: -3, spoilPerDay: 0.025, eatMinutes: 8, morale: 3 } },
  { id: 'raw_fish', name: 'Raw Fish', desc: 'A freshly caught trout or perch.', category: 'food', weight: 0.35, maxStack: 10, food: { kcal: 160, hydration: 2, spoilPerDay: 0.7, eatMinutes: 8, risk: 0.35, morale: -4 } },
  { id: 'cooked_fish', name: 'Cooked Fish', desc: 'Fish roasted on a stick.', category: 'food', weight: 0.3, maxStack: 10, food: { kcal: 190, hydration: 2, spoilPerDay: 0.35, eatMinutes: 8, morale: 7, warming: 0.6 } },
  { id: 'dried_fish', name: 'Dried Fish', desc: 'Dried fish fillets.', category: 'food', weight: 0.15, maxStack: 20, food: { kcal: 180, hydration: -3, spoilPerDay: 0.03, eatMinutes: 6, morale: 2 } },
  { id: 'potato', name: 'Potato', desc: 'A raw potato. Much better cooked.', category: 'food', weight: 0.2, maxStack: 20, food: { kcal: 110, spoilPerDay: 0.02, eatMinutes: 4, risk: 0.1, morale: -2 } },
  { id: 'baked_potato', name: 'Baked Potato', desc: 'A potato baked in the embers.', category: 'food', weight: 0.2, maxStack: 20, food: { kcal: 140, hydration: 1, spoilPerDay: 0.3, eatMinutes: 5, morale: 5, warming: 0.4 } },
  { id: 'carrot', name: 'Carrot', desc: 'Crunchy and sweet.', category: 'food', weight: 0.1, maxStack: 20, food: { kcal: 40, hydration: 3, spoilPerDay: 0.05, eatMinutes: 2, morale: 1 } },
  { id: 'beans_dry', name: 'Dry Beans', desc: 'Harvested beans. Need cooking.', category: 'food', weight: 0.2, maxStack: 20, food: { kcal: 200, spoilPerDay: 0.005, eatMinutes: 6, risk: 0.5, morale: -5 } },
  { id: 'bean_stew', name: 'Bean Stew', desc: 'Beans simmered with whatever was at hand.', category: 'food', weight: 0.4, maxStack: 6, food: { kcal: 380, hydration: 8, spoilPerDay: 0.4, eatMinutes: 12, morale: 10, warming: 1.2 } },

  // --- Water containers ----------------------------------------------------
  { id: 'water_bottle', name: 'Plastic Bottle', desc: 'A one-litre plastic bottle.', category: 'water', weight: 0.05, maxStack: 1, liquidCapacity: 1000 },
  { id: 'steel_bottle', name: 'Steel Bottle', desc: 'A 750 ml steel bottle.', category: 'water', weight: 0.25, maxStack: 1, liquidCapacity: 750 },
  { id: 'cooking_pot', name: 'Cooking Pot', desc: 'A dented 2 litre pot. Used to boil water and cook.', category: 'water', weight: 0.7, maxStack: 1, liquidCapacity: 2000, tool: { tags: ['boil'], power: 1, wear: 0 } },
  { id: 'jerrycan', name: 'Water Canister', desc: 'A 10 litre plastic canister.', category: 'water', weight: 0.6, maxStack: 1, liquidCapacity: 10000 },

  // --- Tools ---------------------------------------------------------------
  { id: 'pocket_knife', name: 'Pocket Knife', desc: 'A red Swiss pocket knife. Blade, saw, can opener.', category: 'tool', weight: 0.1, maxStack: 1, tool: { tags: ['cut', 'open'], power: 0.6, wear: 0.002 }, weapon: { damage: 6, reach: 1 } },
  { id: 'hunting_knife', name: 'Hunting Knife', desc: 'A fixed-blade knife.', category: 'tool', weight: 0.3, maxStack: 1, tool: { tags: ['cut', 'open'], power: 1, wear: 0.0015 }, weapon: { damage: 12, reach: 1 } },
  { id: 'hatchet', name: 'Hatchet', desc: 'A small forest axe.', category: 'tool', weight: 0.9, maxStack: 1, tool: { tags: ['chop', 'cut'], power: 1, wear: 0.004 }, weapon: { damage: 16, reach: 1.1 } },
  { id: 'stone_axe', name: 'Stone Axe', desc: 'A sharp stone lashed to a handle. Crude.', category: 'tool', weight: 1.1, maxStack: 1, tool: { tags: ['chop'], power: 0.5, wear: 0.012 }, weapon: { damage: 10, reach: 1.1 } },
  { id: 'folding_saw', name: 'Folding Saw', desc: 'A pruning saw with a folding blade.', category: 'tool', weight: 0.3, maxStack: 1, tool: { tags: ['saw', 'cut'], power: 1, wear: 0.003 } },
  { id: 'folding_shovel', name: 'Folding Shovel', desc: 'A compact entrenching tool.', category: 'tool', weight: 1, maxStack: 1, tool: { tags: ['dig'], power: 1, wear: 0.003 }, weapon: { damage: 9, reach: 1.1 } },
  { id: 'digging_stick', name: 'Digging Stick', desc: 'A sharpened stick. Slow, but it digs.', category: 'tool', weight: 0.4, maxStack: 1, tool: { tags: ['dig'], power: 0.35, wear: 0.02 } },
  { id: 'hammer', name: 'Hammer', desc: 'A claw hammer.', category: 'tool', weight: 0.6, maxStack: 1, tool: { tags: ['hammer'], power: 1, wear: 0.001 }, weapon: { damage: 8, reach: 1 } },
  { id: 'fishing_hooks', name: 'Fishing Hooks', desc: 'Small hooks and a spool of line.', category: 'material', weight: 0.01, maxStack: 20 },
  { id: 'fishing_rod', name: 'Fishing Rod', desc: 'A branch rod with line and hook.', category: 'tool', weight: 0.4, maxStack: 1, tool: { tags: ['fish'], power: 1, wear: 0.01 } },
  { id: 'spear', name: 'Spear', desc: 'A long straight branch, fire-hardened and sharpened.', category: 'weapon', weight: 1.2, maxStack: 1, weapon: { damage: 22, reach: 1.8 }, tool: { tags: [], power: 1, wear: 0.02 } },
  { id: 'matches', name: 'Matches', desc: 'A box of matches. Damp matches rarely strike.', category: 'tool', weight: 0.02, maxStack: 1, charges: 30, tool: { tags: ['ignite'], power: 0.8, wear: 0 } },
  { id: 'lighter', name: 'Lighter', desc: 'A disposable lighter.', category: 'tool', weight: 0.02, maxStack: 1, charges: 120, tool: { tags: ['ignite'], power: 1, wear: 0 } },

  // --- Light ---------------------------------------------------------------
  { id: 'flashlight', name: 'Flashlight', desc: 'A small LED flashlight. The batteries will not last forever.', category: 'light', weight: 0.2, maxStack: 1, charges: 100, light: { radius: 7, drainPerHour: 6 } },
  { id: 'torch', name: 'Torch', desc: 'A branch wrapped in cloth. Burns for about an hour.', category: 'light', weight: 0.5, maxStack: 1, charges: 100, light: { radius: 5, drainPerHour: 100 } },

  // --- Medical and hygiene -------------------------------------------------
  { id: 'bandage', name: 'Bandage', desc: 'Stops bleeding and protects a wound.', category: 'medical', weight: 0.03, maxStack: 10, medical: 'bandage' },
  { id: 'antiseptic', name: 'Antiseptic', desc: 'Disinfectant for wounds. Several uses.', category: 'medical', weight: 0.1, maxStack: 1, charges: 8, medical: 'antiseptic' },
  { id: 'painkillers', name: 'Painkillers', desc: 'Ibuprofen tablets.', category: 'medical', weight: 0.01, maxStack: 20, medical: 'painkiller' },
  { id: 'purify_tablets', name: 'Purification Tablets', desc: 'Chlorine tablets. One treats a container of water.', category: 'medical', weight: 0.005, maxStack: 30, medical: 'purify' },
  { id: 'soap', name: 'Soap', desc: 'A bar of soap. Makes washing far more effective.', category: 'misc', weight: 0.1, maxStack: 1, charges: 30 },

  // --- Clothing ------------------------------------------------------------
  { id: 'tshirt', name: 'T-Shirt', desc: 'A cotton t-shirt.', category: 'clothing', weight: 0.2, maxStack: 1, clothing: { slot: 'torso', warmth: 1, waterproof: 0, protection: 0, visual: 'tshirt' } },
  { id: 'hoodie', name: 'Hoodie', desc: 'A cotton hoodie. Warm while dry, miserable when wet.', category: 'clothing', weight: 0.6, maxStack: 1, clothing: { slot: 'outer', warmth: 3, waterproof: 0.05, protection: 0.05, visual: 'hoodie' } },
  { id: 'wool_sweater', name: 'Wool Sweater', desc: 'A thick wool sweater. Stays warm when damp.', category: 'clothing', weight: 0.8, maxStack: 1, clothing: { slot: 'outer', warmth: 4, waterproof: 0.2, protection: 0.05, visual: 'sweater', color: '#7a5a3a' } },
  { id: 'rain_jacket', name: 'Rain Jacket', desc: 'A thin waterproof shell.', category: 'clothing', weight: 0.4, maxStack: 1, clothing: { slot: 'outer', warmth: 1.5, waterproof: 0.85, protection: 0.05, visual: 'raincoat' } },
  { id: 'winter_jacket', name: 'Winter Jacket', desc: 'A padded winter jacket.', category: 'clothing', weight: 1.3, maxStack: 1, clothing: { slot: 'outer', warmth: 7, waterproof: 0.6, protection: 0.15, visual: 'jacket' } },
  { id: 'jeans', name: 'Jeans', desc: 'Denim. Durable, but cold and heavy when wet.', category: 'clothing', weight: 0.7, maxStack: 1, clothing: { slot: 'legs', warmth: 1.5, waterproof: 0.05, protection: 0.15, visual: 'jeans' } },
  { id: 'hiking_pants', name: 'Hiking Pants', desc: 'Quick-drying synthetic trousers.', category: 'clothing', weight: 0.4, maxStack: 1, clothing: { slot: 'legs', warmth: 1.5, waterproof: 0.35, protection: 0.1, visual: 'pants' } },
  { id: 'sneakers', name: 'Sneakers', desc: 'Everyday trainers. Not made for the forest.', category: 'clothing', weight: 0.6, maxStack: 1, clothing: { slot: 'feet', warmth: 0.5, waterproof: 0.1, protection: 0.05, visual: 'sneakers' } },
  { id: 'hiking_boots', name: 'Hiking Boots', desc: 'Sturdy waterproof boots.', category: 'clothing', weight: 1.2, maxStack: 1, clothing: { slot: 'feet', warmth: 1.2, waterproof: 0.8, protection: 0.25, visual: 'boots' } },
  { id: 'beanie', name: 'Beanie', desc: 'A knitted hat.', category: 'clothing', weight: 0.1, maxStack: 1, clothing: { slot: 'head', warmth: 1.2, waterproof: 0.1, protection: 0, visual: 'beanie' } },
  { id: 'gloves', name: 'Work Gloves', desc: 'Leather work gloves. Protect hands.', category: 'clothing', weight: 0.2, maxStack: 1, clothing: { slot: 'hands', warmth: 0.8, waterproof: 0.3, protection: 0.3, visual: 'gloves' } },
  { id: 'school_backpack', name: 'School Backpack', desc: 'A school backpack. Not built for heavy loads.', category: 'clothing', weight: 0.6, maxStack: 1, backpack: { slots: 8, carry: 4 } },
  { id: 'hiking_backpack', name: 'Hiking Backpack', desc: 'A 50 litre pack with a hip belt.', category: 'clothing', weight: 1.6, maxStack: 1, backpack: { slots: 14, carry: 12 } },
  { id: 'sleeping_bag', name: 'Sleeping Bag', desc: 'Makes sleeping on the ground bearable.', category: 'misc', weight: 1.4, maxStack: 1 },

  // --- Containers, seeds, misc ---------------------------------------------
  { id: 'duffel_bag', name: 'Group Supply Bag', desc: 'A heavy duffel bag with the class supplies. Set it down to store it.', category: 'container', weight: 1.5, maxStack: 1, containerSlots: 20, places: 'supply_bag' },
  { id: 'seed_potatoes', name: 'Seed Potatoes', desc: 'Sprouting potatoes, ready for planting.', category: 'seed', weight: 0.2, maxStack: 20, seed: 'potato' },
  { id: 'bean_seeds', name: 'Bean Seeds', desc: 'A paper bag of bean seeds.', category: 'seed', weight: 0.02, maxStack: 30, seed: 'bean' },
  { id: 'carrot_seeds', name: 'Carrot Seeds', desc: 'A packet of carrot seeds.', category: 'seed', weight: 0.01, maxStack: 30, seed: 'carrot' },
  { id: 'map', name: 'Hiking Map', desc: 'A 1:25 000 hiking map of the Hardwald area. Blank where you have not been.', category: 'misc', weight: 0.05, maxStack: 1 },
  { id: 'note', name: 'Paper', desc: 'Something written by someone else.', category: 'document', weight: 0.01, maxStack: 1 },
  { id: 'radio', name: 'Crank Radio', desc: 'A hand-crank emergency radio.', category: 'misc', weight: 0.4, maxStack: 1 },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(I.map((d) => [d.id, d]));

export function itemDef(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) {
    // Unknown items degrade gracefully to a generic placeholder instead of crashing.
    return { id, name: `Unknown (${id})`, desc: 'Unrecognised item.', category: 'misc', weight: 0.1, maxStack: 1 };
  }
  return d;
}
