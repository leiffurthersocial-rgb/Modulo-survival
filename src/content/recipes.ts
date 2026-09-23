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
  { id: 'stone_knife', name: 'Knap Stone Blade', inputs: { stone: 2, cordage: 1 }, outputs: { stone_knife: 1 }, minutes: 20, skill: 'crafting', desc: 'Strike flakes off a stone until one holds an edge, then wrap the grip.', difficulty: 2 },
  { id: 'stone_hammer', name: 'Lash Stone Hammer', inputs: { stone: 1, branch: 1, cordage: 1 }, outputs: { stone_hammer: 1 }, minutes: 20, skill: 'crafting', desc: 'Enough to drive nails or pegs.' },
  { id: 'bow_drill', name: 'Make Bow Drill', inputs: { branch: 2, cordage: 2 }, outputs: { bow_drill: 1 }, minutes: 30, skill: 'survival', tool: 'cut', desc: 'Fire without matches. Works best in dry weather.', difficulty: 3 },
  { id: 'gorge_hooks', name: 'Carve Gorge Hooks', inputs: { branch: 1 }, outputs: { fishing_hooks: 2 }, minutes: 15, skill: 'fishing', tool: 'cut', desc: 'Small sharpened slivers that lodge in a fish. Less reliable than steel hooks.' },
  { id: 'rope', name: 'Braid Rope', inputs: { cordage: 4 }, outputs: { rope: 1 }, minutes: 25, skill: 'crafting', desc: 'Braid cordage into a stronger rope.' },
  { id: 'bark_torch', name: 'Bind Fibre Torch', inputs: { branch: 1, fiber: 4 }, outputs: { torch: 1 }, minutes: 6, skill: 'crafting', desc: 'Dry fibre bound to a stick. Does not need cloth.' },
  { id: 'split_plank', name: 'Split a Plank', inputs: { log: 1 }, outputs: { plank: 1 }, minutes: 45, skill: 'construction', tool: 'chop', desc: 'Split and hew a rough board from a log. Slower and more wasteful than sawing.', difficulty: 2 },
  { id: 'wooden_pegs', name: 'Carve Wooden Pegs', inputs: { branch: 2 }, outputs: { wooden_pegs: 12 }, minutes: 20, skill: 'construction', tool: 'cut', desc: 'Pegs to hold boards together when there are no nails.' },
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
