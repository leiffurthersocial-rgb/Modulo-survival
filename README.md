# Modulo: Survival

An ultra-realistic, handcrafted open-world survival game built in Unreal Engine 5.
The environment itself is the greatest threat — no zombies, no monsters, no magic.

**Status: Phase 1 — Planning (no implementation code exists yet, by design).**

## Design Pillars

1. **Believability first** — every system has logical cause and effect.
2. **The world teaches, not the HUD** — players learn through observation and experimentation.
3. **AAA visual fidelity** — Lumen, Nanite, photoreal rainforest, cinematic lighting.
4. **Survival that rewards mastery** — depth without frustration.
5. **Built to grow** — architecture supports multiplayer, companions, and settlements later without rewrites.

## Documentation Index (Phase 1 Deliverables)

| Doc | Contents |
|---|---|
| [docs/01_GDD.md](docs/01_GDD.md) | Game Design Document — vision, core loop, world, characters, gameplay philosophy |
| [docs/02_TDD.md](docs/02_TDD.md) | Technical Design Document — engine choices, core tech decisions with rationale |
| [docs/03_Systems_Survival.md](docs/03_Systems_Survival.md) | Survival simulation spec — vitals, nutrition, injuries, disease, temperature |
| [docs/04_Systems_Crafting_Building.md](docs/04_Systems_Crafting_Building.md) | Crafting and modular building system specs |
| [docs/05_Systems_World_Wildlife_Weather.md](docs/05_Systems_World_Wildlife_Weather.md) | World design, wildlife AI, weather, and time systems |
| [docs/06_Architecture_Programming.md](docs/06_Architecture_Programming.md) | Project/folder structure, module architecture, coding standards, data-driven design |
| [docs/07_Pipelines.md](docs/07_Pipelines.md) | Asset, graphics, animation, and audio pipelines |
| [docs/08_UI_UX_Plan.md](docs/08_UI_UX_Plan.md) | UI/UX philosophy, HUD design, menu flows |
| [docs/09_Optimization_Plan.md](docs/09_Optimization_Plan.md) | Performance budgets and optimization strategy |
| [docs/10_Progression.md](docs/10_Progression.md) | Gameplay and crafting progression design |
| [docs/11_Roadmap.md](docs/11_Roadmap.md) | Four-phase development roadmap, milestones, task breakdown, verification criteria |
| [docs/12_Risk_Analysis.md](docs/12_Risk_Analysis.md) | Risk register with mitigations |

## Development Phases

- **Phase 1 — Planning** (current): complete design & technical documentation. No code.
- **Phase 2 — Core Framework**: character controller, interaction, inventory, crafting, health, save system, menus, input, basic building, weather/time frameworks.
- **Phase 3 — World & Content**: handcrafted open world, wildlife, advanced survival systems, environmental storytelling, graphics polish.
- **Phase 4 — Ship Readiness**: optimization, balancing, accessibility, QA, Steam readiness.

No phase begins until the previous phase's exit criteria (defined in the roadmap) are met and reviewed.

## Deliberately Postponed (architecture stays flexible for these)

NPC companions · settlement management · job assignments · character skills · morale · base population · story mode · vehicles
