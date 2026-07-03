# Systems Spec — World, Wildlife AI, Weather & Time

**Owners:** Lead AI Programmer, Senior Systems Designer, Environment Artist, Game Director

---

# Part A — Wildlife

## A1. Philosophy

Animals are **agents with needs, not spawned props**. No scripted patrol loops. The test: an observing player who follows any animal for ten minutes should see a believable life — drinking, foraging, resting, reacting — and food-chain interactions that occur *whether or not the player watches* (within the streamed simulation bubble; statistically beyond it).

## A2. Species roster (launch, ~24)

| Guild | Species | Role |
|---|---|---|
| Apex predators | jaguar, black caiman | night/water danger, top of chains, territorial |
| Mid predators | ocelot, harpy eagle, anaconda | pressure on prey guilds, ambient drama |
| Large prey | peccary (herds), tapir, capybara (groups), deer | primary hunting targets, meat/hide economy |
| Small game | agouti, armadillo, iguana, cane rat | early-game protein, trap targets |
| Primates | howler monkeys, capuchins | canopy life, alarm-callers (they see you first — and predators), fruit competition |
| Birds | macaws, toucans, curassow, vultures | ambience, egg/feather resources, vultures signal carcasses (readable world info) |
| Aquatic | piranha, pacu, arapaima, river turtle | fishing economy, swimming risk zones |
| Hazards | pit viper, bushmaster, poison dart frog, scorpion, spider, leeches, mosquito swarms | environmental danger layer (mostly stationary/ambient systems, not full agents) |

Insects/mosquitoes are **Niagara + area-effect systems**, not agents. Snakes/spiders are "reactive hazards": minimal StateTree (ambush/flee/strike), placed by habitat rules.

## A3. Brain architecture

Per TDD: **StateTree brains + utility-scored need selection + EQS + perception**.

- **Needs model:** hunger, thirst, energy, safety, (herd) cohesion, territoriality — floating values per individual. A utility evaluator selects the active goal; StateTree hierarchically executes it (goal → tactic → action). Interrupts (threat perceived, prey spotted) re-evaluate cleanly via StateTree enter/exit conditions.
- **Knowledge & memory:** per-individual short-term memory (last threat location/type, decay hours) + species-level **danger map** per region (a coarse grid heat layer): repeated hunting near a waterhole makes that population skittish there — *animals remember danger*, as required, at population cost not per-agent cost.
- **Food chain:** predators treat prey guilds as food sources through the same needs pipeline the player's meat storage feeds into (dropped meat/carcasses emit scent stimuli). Kills produce carcasses → scavenger attraction → vulture circling (player-readable information loop).
- **Daily rhythm:** need curves modulated by time-of-day and weather per species (jaguar crepuscular/nocturnal; monkeys shelter and go quiet in storms; everything drinks at dawn/dusk — making waterholes the hunting hotspots they are in reality).
- **Perception:** UE AIPerception sight (light-level scaled at night) + hearing (footstep/surface loudness from movement system) + custom **scent**: wind-directional emitter/receptor model (player scent strength = f(sweat, blood, hygiene, carried raw meat); river-wading breaks scent trails). Scent is the system that makes hunting a *craft* — approach from downwind is learnable, real fieldcraft.

## A4. Simulation LOD (the scalability spine)

| Ring | Range | Fidelity |
|---|---|---|
| 0 — Full | ~100 m | full StateTree, animation, perception every frame |
| 1 — Near | 100–300 m | reduced tick (2–4 Hz), simplified animation (no IK), perception throttled |
| 2 — Bubble edge | 300 m–streaming edge | logical agents: position + active goal integrate at 0.5 Hz, no skeletal mesh (impostor if visible at distance) |
| 3 — Unstreamed | beyond | **statistical**: `UEcologySubsystem` per-region populations (counts, health trend, danger map) evolve on coarse timers; individuals materialize from statistics when regions stream in (spawned matching time-of-day behavior — drinking at dawn, not T-posing) |

Population dynamics run at ring 3 for everyone: birth/death rates, overhunting a region visibly depletes it for in-game weeks (recovery curves) — actions have ecological consequences, and it costs almost nothing at runtime.

## A5. Hunting, tracking & fishing

- **Tracks & spoor:** animals deposit typed track decals/props (prints by gait & substrate, droppings, feeding marks, wallows) with age states (fresh → old, weather-erased). Track inspection (interaction verb) reveals species/direction/age to the Journal-informed player. Rain erases tracks — hunt after rain is hard mode, another real dynamic.
- **Wounded game:** non-lethal hits apply bleed; animal flees leaving blood trail (droplet decals, density = wound severity); trailing wounded game is the intended bow-hunting loop. Wounded predators become more dangerous, not less.
- **Traps:** snare (small game), deadfall, fish trap (river placement, current-dependent), pit (large game, dug + covered). Traps work on the statistical layer too — set overnight, resolved by ecology odds against local population, so trapping doesn't require agents ticking all night.
- **Fishing:** spear (skill/timing in shallows), line & hook (bait-typed catches, tension-based hold mini-loop — no floating widgets), net (passive, river current placement), trap. Fish population per stretch depletes/recovers like land regions.

---

# Part B — Weather

## B1. Model

Regional weather driven by a **weather state machine + continuous parameter blend** (`UWeatherSubsystem`): states (Clear, Overcast, Light Rain, Heavy Rain, Thunderstorm, Fog Morning, Heat Haze) with authored transition graph, seasonal weighting (wet/dry season cycle over ~30 in-game days), and per-region modulation (coast windier; highlands colder + fog; swamp humid + fog; rain shadow on mountain lee). Parameters exported to all consumers: `RainIntensity, WindSpeed/Dir, Humidity, AirTemp, CloudCover, FogDensity, LightningRate`.

Storm fronts **approach visibly** (cloud wall, wind picks up, animals shelter, audio shifts) 5–10 minutes before arrival — weather is forecastable by observation, never an RNG slap. Thunderstorms: directional lightning w/ distance-correct thunder delay, rare strike events (tall exposed points, a reason not to summit in storms).

## B2. Gameplay coupling (every consumer reads the same parameter set)

wetness/temperature (survival), fire ignition/rain dousing, track erasure, river level rise after sustained rain (flood risk to low camps — build siting matters), animal behavior modes, sound propagation (rain masks player noise: storm hunting tradeoff), wind → foliage/particle/cloth response + scent propagation + structural creak/damage rolls, visibility (fog).

## B3. Visual delivery

Volumetric clouds (authored presets per state), Niagara rain (camera-attached volume + GPU splash spawning on surfaces, drip lines under canopy edges — "canopy rain lag" after rain stops), material-level global wetness (darkening/roughness/puddle accumulation via runtime virtual texture mask), heat haze post-process, exponential height fog + local fog volumes (swamp, dawn river). Full pipeline: [07_Pipelines.md](07_Pipelines.md).

---

# Part C — Time & Sky

- `UTimeSubsystem`: canonical world clock (default 1 real min = 12 game min ⇒ 2 h full day; sleeping/waiting accelerates coarse simulation, never skips it). Single source of time for every system; no system keeps its own clock.
- **Astronomy:** geographically plausible tropical sun path (near-vertical noon sun, fast twilight — tropical night falls *quickly*, a gameplay beat), moon with 8 phases affecting night light level (full-moon hunts vs new-moon dread), rotating star field with recognizable southern constellations (diegetic navigation aid, taught by a found note).
- **Night danger, honestly constructed:** predator activity peaks, perception advantage flips to animals, temperature drops (wet + night = hypothermia), player light sources reveal position. Darkness is *dark* (calibrated, with a no-cheat gamma policy in video settings — a floor on how much players can lift blacks) but firelight/torch/moon are luminous and beautiful — night must be scary *and* gorgeous, not gray mush.

---

# Part D — World Construction Plan (Environment Art)

- **Blockout-first:** full 4×4 km terrain + landmark macro blockout in Phase 3 M1 before any beautification; playtested for traversal times, sightlines, and region "pull" before art investment. No region gets final art until its blockout is fun to walk.
- **Terrain:** heightmap sculpted (external DCC + in-engine), World Partition, layered auto-material (slope/height rules: mud banks, rock faces, leaf litter) + hand-painted overrides everywhere players linger.
- **Rivers:** spline-driven water system (UE Water plugin as base, custom shading/flow maps; current forces affect swimming/raft/fish placement). Waterfalls: authored Niagara + mesh kits per site — hero moments, not a generic prefab.
- **Vegetation:** PCG biome brushes (canopy/understory/floor layers per region archetype) baked, then hand-tuned; interactive foliage (bend on contact via simple GPU displacement field around characters/animals), harvestable plants are placed *instances* swapped to interactable actors on proximity (density without actor cost).
- **Caves:** modular rock kit + hand-sculpt passes, Data-Layer-gated interiors, custom ambient/reverb zones, genuine darkness.
- **Set-dressing narrative sites** (abandoned camps etc.): kit-based + unique hero props, each site designed doc-first (one-paragraph story per site in the world content plan before placement).
