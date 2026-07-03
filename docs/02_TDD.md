# Modulo: Survival — Technical Design Document

**Version:** 1.0 (Phase 1)
**Owners:** Technical Director, Lead UE5 Engineer, Lead Graphics Engineer, Multiplayer Architect

This document records every foundational technology decision, the alternatives considered, and why the chosen option wins. Decisions here are binding for Phase 2 unless formally revised.

---

## 1. Engine & Toolchain

**Decision: Unreal Engine 5, latest stable release at Phase 2 start (5.5+), C++-primary with Blueprint for content glue.**

- Engine version policy: lock to one stable minor version per phase; upgrade only at phase boundaries after a dedicated upgrade spike on a branch. Never upgrade mid-milestone.
- Source control: Git with Git LFS for binary assets (`.uasset`, `.umap`, textures, audio). `.gitattributes` and a One-File-Per-Actor (OFPA) world setup minimize binary merge conflicts. If team size grows past ~5 concurrent content creators, evaluate Perforce; the repo layout (docs/ + Game/ project root) survives that migration.
- Build: standard UBT/UAT. CI (GitHub Actions with a self-hosted UE runner, Phase 2 task) compiles C++ and runs automation tests on every PR.

### C++ vs Blueprint split (binding rule)

| Layer | Language | Rationale |
|---|---|---|
| Simulation core (vitals, metabolism, weather math, stability solver, AI needs) | C++ | Performance, testability (automation tests), determinism for future MP |
| Framework (subsystems, save, inventory core, interaction core) | C++ | Stable API surface for content |
| Content behaviors (a specific plant's interaction, a UI screen's flow, one-off camp logic) | Blueprint subclassing C++ bases | Iteration speed for designers |
| Data (items, recipes, species, tuning) | Data Assets / Data Tables / curves | Designers tune without code |

Blueprint never implements per-tick simulation logic. Every Blueprint-facing C++ base class exposes `BlueprintNativeEvent` hooks rather than expecting BP to own logic.

---

## 2. Core UE5 Feature Adoption

| Feature | Adopt? | Notes |
|---|---|---|
| **Lumen GI + Reflections** | Yes (HW ray tracing optional, SW fallback) | Non-negotiable for jungle lighting under canopy. Budgeted in Optimization Plan. |
| **Nanite** | Yes — terrain-adjacent meshes, rocks, trunks, debris, buildings | Foliage: Nanite for trunks/branches; leaves evaluated per-asset (Nanite masked foliage is viable in 5.4+ but we benchmark vs. traditional LOD cards in M2.1 graphics spike) |
| **Virtual Shadow Maps** | Yes | Pairs with Nanite; required for canopy light shafts |
| **World Partition + HLODs + Data Layers** | Yes | One persistent 4×4 km level; Data Layers for interior cave states & future story layers |
| **PCG framework** | Yes, author-time only | Foliage/detail scattering as artist brushes baked into the handcrafted world; no runtime generation |
| **Chaos** | Yes | Destruction (building damage, tree felling), physics props |
| **Niagara** | Yes | Rain, waterfalls, insects, fire, blood, wind debris |
| **Motion Matching (PoseSearch)** | Yes | Locomotion foundation; Game Animation Sample as reference implementation, our own dataset (see Animation Plan) |
| **MetaSounds** | Yes | All runtime audio; procedural ambience engine |
| **Enhanced Input** | Yes | Context-stacked mappings (on-foot / building / menus) |
| **Control Rig** | Yes | Foot IK, hand IK for interactions, procedural climbing adjustments |
| **StateTree** | Yes | Animal brains (see §6) |
| **Behavior Trees + EQS** | EQS yes; BT limited | EQS for spatial queries from StateTree tasks; legacy BT only if a specific case fits it better |
| **Substrate** | Deferred, evaluate at Phase 3 | Substrate is powerful for layered materials (wet mud on skin) but still costs perf and pipeline churn; standard material layering achieves launch goals. Re-evaluate when engine version locks for Phase 3. |
| **Mover 2.0** | No (watch) | Experimental; CharacterMovementComponent chosen (§4) |
| **MassEntity** | Not at launch (watch) | Insect swarms/bird flocks use Niagara + lightweight logic; Mass revisited if ambient density needs grow |
| **Game Features / Modular Gameplay plugins** | Yes, selectively | Postponed systems (companions, settlements) will arrive as Game Feature plugins; launch game is plain modules + 2–3 seed plugins to prove the pattern |

---

## 3. Attribute & Effect System — the biggest single decision

The survival simulation is ~20 interacting body attributes plus dozens of status effects (infection, poison, buffs from food, temperature states). Three candidate architectures:

**Option A — Gameplay Ability System (GAS).**
Pros: battle-tested attribute/effect stacking, tags, prediction + replication built in (future co-op nearly free), designer-friendly GameplayEffects, periodic effects model diseases well.
Cons: heavyweight; ability-centric mental model is an awkward fit for "metabolism ticking 24/7"; steep learning curve; some boilerplate.

**Option B — Fully custom attribute component.**
Pros: exact fit, minimal overhead, simple to reason about.
Cons: we re-invent effect stacking, magnitude curves, tag immunities, and — critically — replication/prediction later for co-op. History shows custom stat systems grow into buggy in-house GAS clones.

**Option C — Hybrid (chosen): GAS as the attribute/effect substrate, custom metabolic driver on top.**

- All body attributes are GAS `AttributeSet` members. All statuses (infection, poison, wet, hypothermia stages, food buffs) are `GameplayEffect`s carrying `GameplayTag`s.
- A custom C++ `UMetabolismComponent` runs the continuous simulation (energy expenditure, temperature model, digestion) at a fixed 1 Hz simulation tick and applies results through GAS modifiers — so the *simulation math* lives in plain, unit-testable C++, while *stacking, immunity, UI queries, and replication* ride on GAS.
- Player "abilities" in the GAS sense stay minimal at launch (sprint, hold-breath, interactions are NOT abilities). We adopt GAS for its effect/attribute machinery, not to force ability-ification of everything.

**Why C wins:** it buys GAS's hardest-to-rebuild parts (effect aggregation + replication) for the future co-op requirement, while keeping the always-on simulation in purpose-built code where GAS's per-effect overhead would hurt. Risk (GAS learning curve) is mitigated by containing GAS behind our own facade: gameplay code queries `UBodyStateComponent` (our API), never raw ASC, so if we ever must swap the substrate, the blast radius is one layer.

**GameplayTags are the universal vocabulary** — items, statuses, surfaces, weather states, AI stimuli, recipe requirements all speak tags. A single source-controlled tag registry (`Config/DefaultGameplayTags.ini` + native tags in C++) is maintained from Phase 2 day one.

---

## 4. Character Movement

**Decision: CharacterMovementComponent (CMC), extended via custom movement modes; Mover 2.0 rejected for now.**

CMC is mature, networked (client prediction proven for future co-op), and Motion-Matching-compatible (the Game Animation Sample runs on CMC). Mover 2.0 remains experimental with an unstable API. We isolate movement configuration behind `UModuloCharacterMovement` so a future migration is contained. Custom movement modes planned: swimming (river current forces), climbing (ledge/rock, Control-Rig assisted), crawling (cave squeezes), raft-riding (physics platform).

Movement feel targets (from GDD): weighty, momentum-based, terrain-reactive (mud slows and accumulates, slopes matter, wet rock slips). Terrain response is driven by physical-material `GameplayTag`s so it's data, not special cases.

## 5. Interaction System

**Decision: component-based, verb-driven.** `UInteractableComponent` on any actor advertises verbs (`Interact.Pickup`, `Interact.Harvest`, `Interact.Inspect`, …) with per-verb requirements (tool tags, duration, animation montage handle). The player's `UInteractionComponent` traces (capsule sweep + focus scoring), surfaces the prompt, and orchestrates timed/held interactions with full-body animation. All interactions are interruptible and latency-tolerant (request/confirm pattern) so co-op needs no redesign. One system for pickups, harvesting, building sockets, doors, and device UIs — no parallel interaction paths, ever.

## 6. AI Architecture (Wildlife)

**Decision: StateTree brains + utility-scored needs + EQS + smart-object-style resource claims. No scripted behavior loops.**

Compared: classic Behavior Trees (mature but poor at interrupt-heavy, needs-driven behavior and prone to spaghetti at this ambition level) vs StateTree (designed for exactly this: hierarchical states, enter/exit conditions, clean re-evaluation) vs pure custom utility AI (max control, zero tooling). StateTree with utility-based selectors at decision points gives designer-visible structure plus emergent behavior. Details, LOD strategy, and species matrix: [05_Systems_World_Wildlife_Weather.md](05_Systems_World_Wildlife_Weather.md). Perception: UE AIPerception (sight/hearing/damage) + custom scent propagation.

## 7. Save System

Robust, versioned, multiplayer-compatible. Three candidates:

- **Vanilla `USaveGame` snapshots:** trivially easy, but monolithic, unversioned, and collapses under a 16 km² persistent world (dropped items, built structures, animal populations, ecology state).
- **Third-party (e.g. SPUD-style plugins):** good ideas, but core save tech must not be a dependency we can't fix.
- **Custom subsystem (chosen), designed once, properly:**
  - `USaveSubsystem` (GameInstance subsystem) orchestrates; each participating system implements `IModuloSaveable` (`SaveState(FModuloSaveContext&)` / `LoadState(...)`).
  - **Record-based, versioned format:** every record = `{SystemId, Version, Payload}`; per-record version migration functions; unknown records preserved (forward compatibility).
  - World deltas only: the handcrafted world is the baseline; saves store *differences* (felled tree IDs, built structures, moved/dropped items, container contents, per-region wildlife population state, discovered-map fog, journal state).
  - Persistent actors carry `FGuid` stable IDs (`USaveableEntityComponent`) assigned at author time or spawn.
  - Async save (fork the state capture on game thread into serialization on worker thread), atomic write (temp file + rename), rolling backups (last 3), autosave on sleep + interval, corruption detection via checksum + recovery to newest valid backup.
  - **Multiplayer-ready:** save owned by "world authority" (listen server later); player-specific records (body state, inventory, journal) keyed by character/player ID so a co-op world can hold N player records today.
- Screenshot + metadata header (playtime, day count, character) readable without full deserialization for the load menu.

## 8. Items & Inventory

- **Item definitions:** `UItemDefinition : UPrimaryDataAsset` (asset-manager scannable). Static data: tags, mesh, weight, volume class, base durability, nutrition payload (optional `FInstancedStruct` extensions).
- **Item instances:** lightweight `FItemInstance` structs (definition ref + quantity + mutable state via `FInstancedStruct` payloads: durability, spoilage timestamp, water fill, poison coating…). Struct-based instances (not UObjects-per-item) keep saves small and future replication cheap; `FInstancedStruct` gives typed extensibility without definition-class explosion.
- **Inventory:** weight + slot hybrid (see GDD/UI). `UInventoryComponent` is pure model (events out, commands in); UI binds to events. Containers, corpses, and the player use the same component.
- Spoilage/wetness of carried items handled by a single inventory-owned timer pass (1/30 Hz), not per-item ticking.

## 9. World Streaming & Persistence

- One persistent World-Partitioned level; runtime grid ~256 m cells, HLOD layers for distant canopy/terrain.
- Built structures are runtime-spawned actors registered with World Partition streaming via our `UStructureSubsystem` (buildings must stream like native content; large bases stress-tested in Phase 3 perf gates).
- Ecology & weather are **region-abstracted when unstreamed**: animals near the player are full actors; distant populations are statistical (per-region counts + need trends) via `UEcologySubsystem`. This "two-tier simulation" is the only scalable pattern for a 16 km² living world.

## 10. Module / Subsystem Architecture (summary)

Game code splits into C++ modules with enforced dependency direction (details & diagram: [06_Architecture_Programming.md](06_Architecture_Programming.md)):

`ModuloCore` (types, tags, save interfaces) ← `ModuloSimulation` (body, metabolism, weather math, ecology) ← `ModuloGameplay` (character, interaction, inventory, crafting, building) ← `ModuloUI` / `ModuloAI` ← `ModuloGame` (game mode, glue). Postponed features land as Game Feature plugins on top.

Cross-system communication: **GameplayTag-keyed event bus** (`UModuloEventSubsystem`) for loose coupling (e.g., Building doesn't know Audio exists; both speak events). Direct references only within a module.

## 11. Multiplayer-Compatibility Rules (enforced now, used later)

Launch is single-player, but every Phase 2 system obeys:

1. Simulation state lives in components/subsystems, never in UI or PlayerController-local caches.
2. All state mutation flows through command-style APIs (no direct field pokes from UI/BP).
3. GAS effects and CMC give us replication paths on the two hardest systems for free.
4. No logic assumes "the player" is singular — systems take an actor/character handle.
5. Save format keys player data by player ID (§7).
6. RNG: seeded streams per system (determinism aids both debugging and future networking).

**Explicitly deferred:** actual replication markup, net relevancy tuning, server build targets. Cost of these rules now: ~5–10% overhead. Cost of retrofitting later: a rewrite. This is the scalability-over-shortcut choice.

## 12. Performance Targets (summary — full budgets in Optimization Plan)

| Tier | Hardware anchor | Target |
|---|---|---|
| Recommended | RTX 3070 / RX 6800, 1440p | 60 fps, High preset (Lumen SW/HW auto) |
| Minimum | GTX 1080 / RX 5700, 1080p | 30 fps, Low preset (Lumen SW, reduced foliage density) |
| Enthusiast | RTX 4080+, 4K + upscaler | 60+ fps, Epic, HW Lumen |

Frame budget ownership, profiling cadence, and per-system budgets: [09_Optimization_Plan.md](09_Optimization_Plan.md). Upscalers (DLSS/FSR/XeSS + TSR default) integrated in Phase 2 graphics settings, not bolted on late.

## 13. Testing Strategy

- **Unit/automation tests (C++):** metabolism math, stability solver, save round-trips, recipe resolution — every simulation-core system ships with tests; CI-gated.
- **Functional tests:** Gauntlet-driven smoke map (spawn, interact, craft, build, save/load, sleep cycle) per PR.
- **Soak tests:** automated 8-hour play simulation (bot wanders, systems tick) watching memory/streaming — weekly in Phase 3+.
- **QA process:** test plans per milestone (QA Lead), bug triage board, crash reporting (in-engine + Sentry-class backend) from first internal build.
