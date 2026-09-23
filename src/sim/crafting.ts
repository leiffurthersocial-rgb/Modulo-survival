import { RECIPES, recipeById, type RecipeDef } from '@/content/recipes';
import { itemDef } from '@/content/items';
import type { Game } from './game';
import type { Character } from './types';
import { bestTool, countItem, liquidTotal } from './inventory';
import { startAction, workSpeed, campToolNear } from './actions';

export interface RecipeStatus {
  recipe: RecipeDef;
  can: boolean;
  missing: string[];
  stationOk: boolean;
  toolOk: boolean;
  minutes: number;
}

export function nearStation(game: Game, c: Character, station: RecipeDef['station']): boolean {
  if (!station) return true;
  if (station === 'fire') return !!game.index.nearestOfType(['campfire', 'fire_pit', 'stove'], c.x, c.y, 2.6, (o) => !!o.lit);
  return !!game.index.nearestOfType('workbench', c.x, c.y, 2.6, (o) => o.build === undefined);
}

export function recipeStatus(game: Game, c: Character, r: RecipeDef): RecipeStatus {
  const missing: string[] = [];
  for (const [id, n] of Object.entries(r.inputs)) {
    const have = countItem(c.inventory, id);
    if (have < n) missing.push(`${itemDef(id).name} ${have}/${n}`);
  }
  let toolOk = true;
  if (r.tool === 'boil') {
    toolOk = !!bestTool(c, 'boil') || !!campToolNear(game, c, 'boil');
    if (!toolOk) missing.push('Cooking pot');
    if (liquidTotal(c.inventory) < 500) missing.push('1 L of water');
  } else if (r.tool) {
    toolOk = !!bestTool(c, r.tool);
    if (!toolOk) missing.push(`Tool: ${r.tool === 'cut' ? 'knife' : r.tool === 'chop' ? 'axe' : r.tool}`);
  }
  const stationOk = nearStation(game, c, r.station);
  if (!stationOk) missing.push(r.station === 'fire' ? 'A lit fire nearby' : 'A workbench nearby');
  const minutes = r.minutes / workSpeed(c, r.skill);
  return { recipe: r, can: missing.length === 0, missing, stationOk, toolOk, minutes };
}

export function allRecipeStatus(game: Game, c: Character): RecipeStatus[] {
  return RECIPES.map((r) => recipeStatus(game, c, r));
}

export function startCraft(game: Game, c: Character, id: string): boolean {
  const r = recipeById(id);
  if (!r) return false;
  const st = recipeStatus(game, c, r);
  if (!st.can) {
    game.charMessage(c, `Cannot craft: ${st.missing.join(', ')}.`, 'warn');
    return false;
  }
  startAction(game, c, 'craft', st.minutes, { data: { recipe: id } });
  return true;
}
