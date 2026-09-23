import { isWater } from '@/content/terrain';
import type { Game } from './game';
import { daylight } from './clock';

interface HintDef {
  id: string;
  test: (g: Game) => boolean;
  text: string;
}

/**
 * Small contextual hints instead of a tutorial. Each appears once per world,
 * when the situation it explains actually occurs.
 */
const HINTS: HintDef[] = [
  {
    id: 'start',
    test: () => true,
    text: 'Walk up to the supply bag beside you and press E. The First steps list on the right shows what to do next. Press F1 any time for How to play.',
  },
  { id: 'thirsty', test: (g) => g.player.needs.hydration < 45, text: 'You are thirsty. Drink from a bottle in your inventory (I). Stream and pond water can make you sick unless it is boiled or treated.' },
  { id: 'hungry', test: (g) => g.player.needs.satiety < 40, text: 'You are hungry. The rations will not last: forage, fish, hunt and search abandoned buildings.' },
  { id: 'dark', test: (g) => daylight(g.state.time) < 0.4, text: 'It is getting dark. A fire gives light, warmth and keeps spirits up. Build one from the Build menu (B).' },
  { id: 'tired', test: (g) => g.player.needs.energy < 35, text: 'You are tired. Sleep (Z) restores you. A shelter, a sleeping bag and a nearby fire make for better rest. You will wake around sunrise.' },
  { id: 'bladder', test: (g) => g.player.needs.bladder > 70, text: 'You need the toilet (T, or use a latrine). Waste left in the open contaminates the area and nearby water.' },
  { id: 'cold', test: (g) => g.player.needs.bodyTemp < 36.3, text: 'You are getting cold. Get dry, get out of the wind and near a fire. Cold makes you burn food faster.' },
  { id: 'wet', test: (g) => g.player.needs.wetness > 45, text: 'Your clothes are wet. Wet cotton loses most of its warmth. Dry off by a fire or under shelter.' },
  {
    id: 'water_found',
    test: (g) => {
      if (g.state.homePin) return false;
      const p = g.player;
      return !!g.index.findTileNear(p.x, p.y, 5, (x, y) => isWater(g.index.terrainAt(x, y)));
    },
    text: 'Water is close. A dry spot near water is a good place for a camp. Press H to set the Home Pin here: the group will move to it.',
  },
  { id: 'homepin', test: (g) => !!g.state.homePin, text: 'The group will move to the new camp. Build a fire, a shelter and a latrine. Give broad orders in the Group panel (G).' },
  { id: 'dirty', test: (g) => g.player.needs.hygiene < 30, text: 'You are dirty. Wash in a stream or at a wash station. Poor hygiene raises the risk of illness and wound infection.' },
  { id: 'bleeding', test: (g) => g.player.health.injuries.some((i) => i.bleeding > 0.05 && !i.bandaged), text: 'You are bleeding. Use a bandage from your inventory, or ask a classmate for help.' },
  { id: 'night2', test: (g) => g.state.time > 60 * 24 * 1.2 && !g.state.homePin, text: 'Without a camp the group is scattered and exposed. Choose a place and set the Home Pin (H).' },
];

export function checkHints(game: Game): void {
  const shown = game.state.hints;
  for (const h of HINTS) {
    if (shown.includes(h.id)) continue;
    let ok = false;
    try {
      ok = h.test(game);
    } catch {
      ok = false;
    }
    if (ok) {
      shown.push(h.id);
      game.bus.emit('hint', { id: h.id, text: h.text });
      return; // one at a time
    }
  }
}
