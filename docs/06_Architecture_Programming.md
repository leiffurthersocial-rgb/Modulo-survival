# Architecture — Project Structure, Modules, Coding Standards, Data-Driven Design

**Owners:** Technical Director, Lead UE5 Engineer

---

## 1. Repository & Project Folder Structure

```
Modulo-survival/                     # repo root
├── README.md
├── docs/                            # living design documentation (this set)
├── Tools/                           # pipeline scripts (validation, LFS checks, build helpers)
└── Game/                            # UE project root (created at Phase 2 start)
    ├── Modulo.uproject
    ├── Config/                      # incl. DefaultGameplayTags.ini (source-controlled tag registry)
    ├── Source/
    │   ├── ModuloCore/              # module: shared types, tags, save/interact interfaces, utilities
    │   ├── ModuloSimulation/        # module: metabolism, body state, weather math, time, ecology stats
    │   ├── ModuloGameplay/          # module: character, movement, interaction, inventory, crafting, building
    │   ├── ModuloAI/                # module: animal brains, perception ext (scent), spawning
    │   ├── ModuloUI/                # module: HUD, menus, journal (view layer only)
    │   ├── ModuloGame/              # module: GameMode, GameInstance, glue, difficulty policy
    │   └── ModuloEditor/            # module: editor tooling, validators, debug panels
    ├── Plugins/
    │   └── GameFeatures/            # future: Companions, Settlements land here (pattern seeded in Ph2)
    └── Content/
        ├── Characters/{Shared,Robin,Leif,Jovan,Leonidas,Erim,Till,Lenni,Tusya}/
        ├── Items/{Definitions,Meshes,Icons}/          # UItemDefinition assets by category
        ├── Crafting/{Recipes,Stations}/
        ├── Building/{Pieces,Materials}/
        ├── Wildlife/{<Species>/..., Shared}/
        ├── World/{Maps,Regions,Landscape,Water,Foliage,PCG,NarrativeSites}/
        ├── Weather/  ├── Audio/{Ambience,Foley,Wildlife,UI,MetaSounds}/
        ├── VFX/      ├── UI/        ├── Animation/{Locomotion,Interactions,MotionMatching}/
        ├── Materials/{Master,Functions,Instances}/    # instances-of-masters policy, see Pipelines
        └── Core/{Input,Tuning,Debug}/                 # Enhanced Input assets, difficulty tuning DAs
```

Naming conventions: standard UE prefix scheme (`BP_`, `SM_`, `SK_`, `M_`/`MI_`/`MF_`, `T_` with suffix `_D/_N/_ORM`, `NS_`, `DA_`, `DT_`, `W_` for widgets, `ST_` for StateTrees, `IA_/IMC_` input). Asset names: `Prefix_Category_Descriptor_Variant` (e.g. `SM_Rock_Granite_Lg_A`). Enforced by an editor validator (`ModuloEditor`) that fails CI on violations — conventions that aren't machine-enforced don't survive production.

## 2. Module Dependency Rules (enforced via Build.cs)

```
ModuloCore ← ModuloSimulation ← ModuloGameplay ← ModuloAI
     ↖              ↖                 ↖            ↙
      ─────────── ModuloUI      ModuloGame (top; depends on all)
```

- Arrows = "may depend on". **Never** the reverse; no lateral AI↔UI dependency. `ModuloUI` reads models via interfaces/events only — it must be deletable without breaking simulation (the acid test for future dedicated-server builds).
- Cross-system, cross-module communication uses the **GameplayTag-keyed event bus** (`UModuloEventSubsystem`, in Core): publishers `Broadcast(Tag, Payload)`; subscribers register per tag. Payloads are `FInstancedStruct` — typed, extensible, BP-accessible. Direct component references allowed only *within* a module.

## 3. Runtime Composition (where logic lives)

| Owner | Systems |
|---|---|
| **GameInstance subsystems** (survive level travel) | `USaveSubsystem`, settings, `UModuloEventSubsystem` |
| **World subsystems** (per-world lifetime) | `UTimeSubsystem`, `UWeatherSubsystem`, `UEcologySubsystem`, `UStructureSubsystem`, `UWildlifeSpawnSubsystem` |
| **Character components** | `UBodyStateComponent` (GAS facade), `UMetabolismComponent`, `UInventoryComponent`, `UInteractionComponent`, `UEquipmentComponent`, `UJournalComponent`, `UModuloCharacterMovement` |
| **Actor components (world objects)** | `UInteractableComponent`, `UFireComponent`, `UContainerComponent`, `USaveableEntityComponent`, `UHarvestableComponent` |

Rules: subsystems own *world truth*; components own *per-actor state*; UI owns nothing. PlayerController holds input routing and camera only. Anything a future co-op client would need to observe lives in replicable locations (TDD §11).

**Tick discipline:** almost nothing ticks per frame. Simulation runs on timer buckets (metabolism 1 Hz, ecology 0.1 Hz, spoilage 1/30 Hz, weather blend 10 Hz for smooth visuals). A central `FSimulationScheduler` in ModuloSimulation staggers buckets to avoid frame spikes. Per-frame tick requires TD sign-off per class.

## 4. Coding Standards

- Epic C++ style (UE naming, `TObjectPtr<>`, IWYU). `clang-format` config committed; formatting CI-checked.
- Every public API commented with intent (*why*, contract, units — all physical quantities in SI, all times in seconds, documented in the signature).
- No magic numbers in logic: constants come from tuning Data Assets or named `constexpr` with rationale.
- Error handling: `ensure`/`check` for programmer errors; graceful degradation + structured log categories (`LogModuloSave`, `LogModuloSim`, …) for content errors. Content mistakes must never crash — they log and self-report via the editor validator.
- Each simulation-core class ships with automation tests in the same CL (TDD §13). Reviews require: tests present, no dependency-rule violations, no per-frame tick without sign-off.

## 5. Data-Driven Design

- **Primary Data Assets** for identity-bearing data: items (`UItemDefinition`), recipes (`URecipeDefinition`), building pieces, species (`USpeciesDefinition`: needs curves, perception ranges, harvest yields), weather states, sleep-quality tables, difficulty tuning.
- **Curves everywhere:** all response functions (temperature loss vs wetness, stamina vs fatigue, healing vs nutrition) are `UCurveFloat` assets — designers reshape behavior without code.
- **GameplayTags** are the shared vocabulary (TDD §3). Tag additions go through a registry review (weekly, TD-owned) to prevent taxonomy rot.
- **Extension point policy** (how postponed features attach later without migration): every major definition asset includes an `TArray<FInstancedStruct> ExtensionData` field, and every save record is versioned. Companion/settlement/skill systems will *add* data, never *reshape* existing schemas. This one policy is what makes "keep architecture flexible" concrete.

## 6. Debugging & Tooling (built in Phase 2, not later)

- **Gameplay Debugger categories** per system (body state, AI needs/memory, weather params, stability graph overlay).
- **Simulation console:** set time/weather/attributes, spawn species, teleport, god — behind a dev-build flag.
- **Time-scrub harness:** run N simulated days headless and dump attribute/ecology telemetry to CSV — the balancing workhorse (balance from data, not vibes).
- **Editor validators:** naming, tag usage, item/recipe referential integrity, save-record coverage (any `USaveableEntityComponent` actor missing save handlers fails validation).
