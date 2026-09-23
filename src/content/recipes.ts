import type { SkillId } from '@/sim/types';
import type { ToolTag } from './items';

export interface RecipeDef {
  id: string;
  name: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  /** base minutes at skill 3 */
  minutes: number;
  skill: SkillId;
  tool?: ToolTag;
  station?: 'fire' | 'workbench';
  desc: string;
  /** skill level below which quality/yield suffers */
  difficulty?: number;
}

export const RECIPES: RecipeDef[] = [
  { id: 'cordage', name: 'Twist Cordage', inputs: { fiber: 3 }, outputs: { cordage: 1 }, minutes: 8, skill: 'crafting', desc: 'Twist plant fibre into cord.' },
  { id: 'bandage', name: 'Tear Bandages', inputs: { cloth: 1 }, outputs: { bandage: 2 }, minutes: 5, skill: 'firstAid', desc: 'Rough bandages from cloth. Cleaner if boiled first.' },
  { id: 'torch', name: 'Make Torch', inputs: { branch: 1, cloth: 1 }, outputs: { torch: 1 }, minutes: 5, skill: 'crafting', desc: 'Burns for about an hour.' },
  { id: 'digging_stick', name: 'Sharpen Digging Stick', inputs: { branch: 1 }, outputs: { digging_stick: 1 }, minutes: 15, skill: 'crafting', tool: 'cut', desc: 'Slow, but enough to dig a latrine or turn soil.' },
  { id: 'spear', name: 'Carve Spear', inputs: { branch: 2 }, outputs: { spear: 1 }, minutes: 30, skill: 'crafting', tool: 'cut', desc: 'A long hunting spear.' },
  { id: 'stone_axe', name: 'Lash Stone Axe', inputs: { branch: 1, stone: 1, cordage: 2 }, outputs: { stone_axe: 1 }, minutes: 35, skill: 'crafting', desc: 'Crude, but it will fell a tree eventually.', difficulty: 2 },
  { id: 'fishing_rod', name: 'Make Fishing Rod', inputs: { branch: 1, fishing_hooks: 1, cordage: 1 }, outputs: { fishing_rod: 1 }, minutes: 15, skill: 'crafting', desc: 'A simple rod with line and hook.' },
  { id: 'firewood', name: 'Split Firewood', inputs: { log: 1 }, outputs: { firewood: 4 }, minutes: 12, skill: 'construction', tool: 'chop', desc: 'Split a log into firewood.' },
  { id: 'planks', name: 'Saw Planks', inputs: { log: 1 }, outputs: { plank: 2 }, minutes: 40, skill: 'construction', tool: 'saw', station: 'workbench', desc: 'Slow work with a hand saw.', difficulty: 3 },
  { id: 'cloth_from_clothes', name: 'Cut Up T-Shirt', inputs: { tshirt: 1 }, outputs: { cloth: 4 }, minutes: 5, skill: 'crafting', tool: 'cut', desc: 'Cut a spare shirt into rags.' },
  // cooking at a fire
  { id: 'cook_meat', name: 'Roast Meat', inputs: { raw_meat: 1 }, outputs: { cooked_meat: 1 }, minutes: 20, skill: 'cooking', station: 'fire', desc: 'Cook meat through to make it safe.' },
  { id: 'cook_fish', name: 'Roast Fish', inputs: { raw_fish: 1 }, outputs: { cooked_fish: 1 }, minutes: 15, skill: 'cooking', station: 'fire', desc: 'Fish on a stick over the coals.' },
  { id: 'bake_potato', name: 'Bake Potatoes', inputs: { potato: 2 }, outputs: { baked_potato: 2 }, minutes: 30, skill: 'cooking', station: 'fire', desc: 'Bury them in the embers.' },
  { id: 'roast_mushrooms', name: 'Roast Mushrooms', inputs: { chanterelles: 3 }, outputs: { roasted_mushrooms: 3 }, minutes: 10, skill: 'cooking', station: 'fire', desc: 'Cooking reduces risk from edible mushrooms.' },
  { id: 'boil_pasta', name: 'Boil Pasta', inputs: { pasta: 1 }, outputs: { cooked_pasta: 1 }, minutes: 20, skill: 'cooking', station: 'fire', tool: 'boil', desc: 'Needs a pot and about a litre of water.' },
  { id: 'bean_stew', name: 'Cook Bean Stew', inputs: { beans_dry: 2 }, outputs: { bean_stew: 2 }, minutes: 60, skill: 'cooking', station: 'fire', tool: 'boil', desc: 'Slow-cooked beans. Needs a pot and water.' },
];

export const recipeById = (id: string): RecipeDef | undefined => RECIPES.find((r) => r.id === id);
