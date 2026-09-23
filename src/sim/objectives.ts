import type { Game } from './game';
import { FIRE_TYPES, SHELTER_TYPES } from './environment';

/**
 * "First steps": a short checklist that walks a new player through the first
 * day. Each step is ticked off by what actually happens in the world, and a
 * ticked step stays ticked (stored in state.hints as "goal:<id>").
 */
export interface Objective {
  id: string;
  title: string;
  how: string;
  done: (g: Game) => boolean;
}

/** Record that the player did something (used by the checklist). */
export function notePlayerDid(game: Game, what: string): void {
  const k = `did:${what}`;
  if (!game.state.hints.includes(k)) game.state.hints.push(k);
}

const did = (g: Game, what: string) => g.state.hints.includes(`did:${what}`);

function nearHome(g: Game, types: string[], r: number, extra: (lit: boolean) => boolean = () => true): boolean {
  const h = g.state.homePin;
  if (!h) return false;
  for (const t of types) {
    const o = g.index.nearestOfType(t, h.x, h.y, r, (x) => x.build === undefined && extra(!!x.lit));
    if (o) return true;
  }
  return false;
}

export const OBJECTIVES: Objective[] = [
  {
    id: 'bag',
    title: 'Check the supply bag',
    how: 'The group bag lies next to you. Walk up to it and press E, then take what you need.',
    done: (g) => did(g, 'search') || did(g, 'pickupBag') || did(g, 'openBag'),
  },
  {
    id: 'drink',
    title: 'Drink something',
    how: 'Open your Bag (I) and double-click the water bottle, or face the stream and press E. Stream water can make you sick.',
    done: (g) => did(g, 'drinkItem') || did(g, 'drinkWater'),
  },
  {
    id: 'home',
    title: 'Choose a camp spot',
    how: 'Find a dry place near water and press H. The Home Pin tells the whole group where to make camp.',
    done: (g) => !!g.state.homePin,
  },
  {
    id: 'fire',
    title: 'Build a campfire at camp',
    how: 'Open Build (B), choose Fire > Campfire, place it with E or a click, then keep pressing E on the site until it is built.',
    done: (g) => nearHome(g, [...FIRE_TYPES], 14),
  },
  {
    id: 'light',
    title: 'Light the fire before dark',
    how: 'Gather branches (E on deadfall or a tree), add them to the fire, then light it with matches or a lighter from the supply bag.',
    done: (g) => nearHome(g, [...FIRE_TYPES], 14, (lit) => lit),
  },
  {
    id: 'shelter',
    title: 'Build a shelter',
    how: 'Build (B) > Shelter > Lean-to. A roof keeps rain off, and sleeping under it is much warmer.',
    done: (g) => nearHome(g, [...SHELTER_TYPES], 16),
  },
  {
    id: 'sleep',
    title: 'Sleep through the night',
    how: 'When the Rest bar gets low, press Z near the fire and shelter. Time runs faster while you sleep.',
    done: (g) => did(g, 'sleep'),
  },
];

export function objectiveDone(g: Game, id: string): boolean {
  return g.state.hints.includes(`goal:${id}`);
}

/** Tick off newly completed steps and announce them. */
export function checkObjectives(game: Game): void {
  const h = game.state.hints;
  if (h.includes('goals_done')) return;
  // saves from long-running games skip the beginner checklist
  if (game.state.time - (game.state.startTime ?? 0) > 3 * 1440) {
    h.push('goals_done');
    return;
  }
  let open = 0;
  for (const o of OBJECTIVES) {
    if (h.includes(`goal:${o.id}`)) continue;
    let ok = false;
    try {
      ok = o.done(game);
    } catch {
      ok = false;
    }
    if (ok) {
      h.push(`goal:${o.id}`);
      game.message(`Done: ${o.title}.`, 'good');
    } else open++;
  }
  if (open === 0) {
    h.push('goals_done');
    game.message('You made it through the first steps. From here on, the forest is yours to figure out.', 'good');
  }
}
