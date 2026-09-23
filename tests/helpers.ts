import { generateWorld } from '@/gen/world';
import { Game } from '@/sim/game';

let cached: ReturnType<typeof generateWorld> | undefined;

/** A fresh game on a fixed seed. World generation is cached and deep-cloned for speed. */
export function newGame(seed = 1234): Game {
  if (!cached || cached.seed !== seed) cached = generateWorld({ seed, mode: 'normal', playerId: 'robin' });
  return new Game(structuredClone(cached));
}
