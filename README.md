# Modulo: Survival

A single-player, top-down, pixel-art survival simulation. Sixteen 18-year-old
classmates have escaped into the forest near Bülach, Switzerland, after an
unexplained collapse. There is no story to finish and no boss. The goal is to
survive: find water, make camp, get through the nights, and turn a temporary
camp into a place to live, while the other fifteen live their own lives.

It runs entirely in the browser (desktop and iPad) and deploys as a static site.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run soak       # 10-day headless balance run (SEED=1234 to pick a world)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

Node 20 or newer is required. There is no backend and no environment
configuration; nothing needs secrets.

### Deploying to Vercel

Import the repository in Vercel. `vercel.json` sets the Vite framework preset,
the build command (`npm run build`), the output directory (`dist`), long-term
caching for hashed assets, and a rewrite so any route falls back to
`index.html`.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move (Shift to sprint) |
| E / Space | Use the thing directly in front of you, if within reach (opens a numbered menu if there are several options; press 1-9) |
| Mouse click | Interact with a nearby object, classmate or animal |
| F | Strike at the nearest animal |
| I / Tab | Inventory, equipment and open containers |
| K | Crafting (cooking appears near a lit fire) |
| B | Build menu; place with click or E, cancel with right-click or P |
| M | Map with fog of war and your own markers |
| G | Group: classmates, orders, expeditions |
| O | Camp overview |
| C | Character sheet |
| J | Journal, found documents, calendar |
| Z | Sleep / wake up |
| T | Relieve yourself (uses a latrine if you stand at one) |
| H | Set the Home Pin (the group makes camp there) |
| L | Hold or put away a flashlight or torch |
| P (or Esc) | Close a window, or open the pause menu: save, load, export, settings |
| ? | How to play |

The layout works on an iPad keyboard, which has no Esc or function keys.
Letter keys follow the character printed on the key, so they stay correct on
Swiss and German QWERTZ layouts; WASD movement uses key positions.

Touch controls (joystick and buttons) are off by default and can be enabled in
Settings. Debug tools are only available with `?debug` in the URL (or in dev
builds): press F3 or the backtick key.

## What is in the game

Everything listed here works in the game and affects the simulation.

- **World**: a 320x320-tile seeded forest (Hardwald near Bülach) with meadows,
  a lake feeding a stream, ponds, a rocky outcrop, a farm with a barn and old
  fields, a forest hut, a forestry shed, a pumping station, a forest barbecue
  spot, an earlier survivors' camp, hunting stands, roads and abandoned cars.
  Trees, plants, containers and buildings persist; felled trees stay stumps and
  slowly regrow.
- **Characters**: a fixed class of sixteen: the eight known boys and eight
  girls (Mia, Nora, Seraina, Alina, Livia, Chiara, Julia, Noemi). Everyone's
  looks, traits, skills, attributes and background are the same in every
  world; the seed only changes the forest and what people carry. Attributes
  add up to the same budget for everyone, so nobody is strictly better.
- **Onboarding**: a new world opens with a short welcome card. A First steps
  checklist on the HUD walks you through the first day (supply bag, water,
  camp spot, fire, shelter, sleep) and ticks itself off from what happens in
  the world. A full How to play guide is on the title screen, in the pause
  menu and on F1 or ?.
- **Body simulation**: calories (stomach plus longer-term body reserves),
  thirst, sleep pressure and sleep quality, stamina, toilet, hygiene, core body
  temperature (air, wind, rain, wetness, clothing, shelter, fire, activity,
  huddling; people shed layers and sweat when warm), stress, morale, injuries (bleeding, infection, bandaging), and
  illnesses (contaminated water, spoiled or raw food, cold exposure, infection
  fever). Status effects derived from these change speed, work rate and
  accident risk.
- **Clothing**: worn clothes get dirty with work and time. Filthy clothes
  insulate a little worse and make you dirtier faster. Wash them at the water
  or at a wash station; they come back clean and damp, so pick a mild midday
  or stand by a fire.
- **Sleep**: you wake around sunrise or when rested, or earlier because of
  cold, rain, thirst or pain. Time runs faster while you sleep.
- **Water**: streams, ponds and the lake carry different contamination; waste
  left in the open contaminates the area and water nearby. Boiling (fire and
  pot), purification tablets, a charcoal sand filter and rain collectors.
- **Fire**: fuel burns down faster in wind and rain, rain can put fires out,
  embers can be revived, skilled survivors can try a friction fire, open fires
  can throw sparks into dry vegetation and spread, and people near flames get
  burned. Fire gives heat, light, drying, cooking and boiling.
- **Food**: spoilage by temperature, cooking, food poisoning, foraging by season
  (wild garlic, berries, hazelnuts, mushrooms that need identifying), fishing
  with stocks per water body, hunting (deer, boar, fox, hare) with butchering,
  snares, drying racks for preservation, and a garden with potatoes, beans and
  carrots that need water and fear frost.
- **Crafting and building**: data-driven recipes and structures (fires, lean-to,
  tarp shelter, bough bed, latrine, wash station, storage, rain collector, sand
  filter, drying rack, garden plot, snare, workbench, seating, log walls, floors,
  foundations, roofs). Placement checks terrain, space, reach and materials;
  sites need work and suitable tools.
- **Weather and seasons**: a Markov weather model (clear, overcast, light and
  heavy rain, fog, snow, thunderstorms) with multi-day cold and warm spells,
  wind, ground dryness and snow cover. Four seasons change temperature, day
  length, vegetation, foraging, crops and animal behaviour.
- **Wildlife**: animals with territories, hunger, thirst, sleep cycles, fear of
  noise and people; boars can charge. Populations shrink with hunting and grow
  back in spring and summer.
- **NPCs**: the fifteen classmates decide for themselves with a utility model:
  survival needs first, then camp needs, skills and personality. They drink,
  eat, cook, sleep in shelters, use the latrine, make and tend the fire, build
  shelters and a latrine on their own, fetch and boil water, gather wood and
  food, craft fishing rods and spears, fish, hunt, socialise, and go on
  expeditions (with delays for weather and nights out) whose findings reach the
  shared map when they return. Orders set priorities but never override
  self-preservation, and people may refuse dangerous or unwanted orders.
- **Relationships**: affinity, trust, rivalry, romance between NPCs (couples and
  breakups), arguments and conversations, grief after deaths, and memories of
  who helped or argued with whom. Nobody comments on anyone's appearance.
- **Death**: permanent for NPCs and for your character, whose body and
  belongings stay in the world. You continue as another survivor. Normal and
  Hardcore modes.
- **Exploration and mystery**: fog-of-war map with custom markers, a Home Pin
  compass whose accuracy depends on navigation skill, semi-procedural loot by
  location, and documents and radio fragments hinting at one of several possible
  causes of the collapse, chosen per world.
- **Saves**: autosave, three manual slots, export and import of save files,
  IndexedDB storage, versioned saves with a migration path.
- **Presentation**: procedural original pixel art (terrain chunks, trees by
  season, characters built from their appearance and clothing, animals,
  buildings, items), day and night lighting with fire and torch light, rain,
  snow, fog and lightning, synthesized placeholder audio (wind, rain, fire,
  birds, owls, footsteps, work sounds, quiet generative music).

## Architecture

```
src/
  core/      seeded RNG, noise, math, logger, event bus
  content/   data registries: items, recipes, objects/structures, terrain,
             skills and traits, seasons, weather, statuses, animals, crops,
             loot tables, lore, characters
  gen/       world generation and character generation
  sim/       the simulation (no DOM): game orchestrator and clock, body,
             environment, actions, NPC AI, pathfinding, social, wildlife,
             ecology (spoilage, regrowth, crops, traps), fire, weather,
             building, crafting, interactions, loot, hints
  render/    Canvas renderer: terrain chunk cache, procedural sprites,
             lighting and weather effects
  audio/     audio manager (file-or-synth by sound id)
  input/     keyboard bindings, shared with touch controls
  save/      serialization, migrations, IndexedDB storage, export/import
  ui/        React UI: screens, HUD, panels, game session loop
tests/       vitest tests for the critical systems
```

Key decisions:

- **Simulation is independent of rendering and React.** `Game` advances in
  fixed sub-steps from a single clock. React only reads state through a version
  counter published about seven times a second, so UI never drives the
  simulation and panels do not re-render every frame.
- **Tiered simulation.** Near the player, NPCs path-find (grid A* with an
  expansion budget, cached per task) and collide; far away they travel
  abstractly and their bodies update in coarser steps. Wildlife works the same
  way. Hourly processes (regrowth, crops, fish stocks) and daily processes
  (populations, memories) run on low-frequency ticks.
- **Rendering at 1x into a low-resolution buffer**, then scaled up by an integer
  factor, keeps pixels consistent and fill cost low. Terrain is baked per chunk
  and cached; lighting uses a small overlay.
- **Content is data.** Items, recipes, structures, weather, seasons, statuses
  and animals are registries; systems read their properties.
- **Deterministic generation.** The world seed drives terrain, placement,
  starting kits, loot tables and the cause of the collapse. The full state
  (including every character) is stored in the save.
- **Robustness.** Each NPC update is isolated so one failing entity is reset
  instead of crashing the world; errors go to the logger and the debug panel.
  Saves are validated on load, and unknown items or weather states degrade
  gracefully.

## Adding art and audio

All art is generated procedurally from code in `src/render/`. Replacing a
sprite means changing its drawing function or returning an image from the same
function; gameplay code never references pixels. Audio ids are listed in
`src/audio/audio.ts`; drop `public/assets/audio/<id>.ogg` (or `.mp3`) to replace
a placeholder without code changes.

## Not implemented yet

These are deliberately absent from the game and not exposed in the UI:
livestock, electricity, vehicles and boats, player romance, human enemies,
advanced farming (soil quality, pests), more regions beyond the Hardwald, and
cloud saves or multiplayer (not planned).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
