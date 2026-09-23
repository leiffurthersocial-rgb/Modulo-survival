# Development notes

## Loop

1. Change a system.
2. `npm run typecheck` and `npm test`.
3. Run the game (`npm run dev`, open with `?debug`), play the change, watch the
   debug panel for errors, FPS and simulation time.
4. Check that saving and loading still works for the change.

## Conventions

- Simulation code (`src/sim`) must not touch the DOM or React. It communicates
  outward through `game.bus` events.
- New content goes into a registry in `src/content` first. Systems should read
  properties, not switch on ids, where practical.
- Game time is measured in game minutes. At 1x, one real second is one game
  minute. Movement speeds are tiles per game minute.
- Anything stored in `GameState` must survive `structuredClone` and the JSON
  export (typed arrays are handled by the save layer).
- If you change the shape of saved data, bump `CURRENT_SAVE_VERSION` in
  `src/save/migrations.ts` and add a migration. Do not invalidate existing
  worlds.
- Do not expose a feature in the UI until it works in the simulation.
- No emojis anywhere: UI, item names, dialogue, comments.
- Characters never comment on each other's appearance.

## Balancing tools

`window.__game` is the running session in the browser console. In `?debug`
mode the debug panel can advance time, change weather, toggle AI or fog of war,
heal, add items and inspect characters. Shift-click the map to teleport.
