# Development Roadmap — Four Phases

**Owner:** Project Manager, with all leads
**Rule:** a phase does not begin until the previous phase's **exit criteria** are met and formally reviewed. Complexity scale: S / M / L / XL (relative engineering+content effort).

---

## Phase 1 — Planning (CURRENT)

**Objectives:** complete, production-ready design & technical documentation; all foundational architecture decisions made with rationale; roadmap and risk register established.

**Deliverables:** this documentation set (README + docs 01–12): GDD, TDD, systems specs (survival, crafting/building, world/wildlife/weather), architecture & folder structure, pipelines (asset/graphics/animation/audio), UI plan, optimization plan, progression design, roadmap, risk analysis.

**Milestones:** M1.1 vision & GDD ✅ · M1.2 TDD & architecture decisions ✅ · M1.3 systems specs ✅ · M1.4 pipeline/UI/optimization plans ✅ · M1.5 roadmap + risks ✅ · **M1.6 stakeholder review & sign-off (open)**.

**Dependencies:** none. **Complexity:** M. **Risks:** over-specification vs. discovery during implementation — mitigated by treating docs as living (change-controlled, not frozen).

**Verification / exit criteria:** every doc reviewed; every "Decision:" line in the TDD has stated alternatives + rationale; no system in Phase 2 scope lacks a spec; postponed features have explicit extension points documented; sign-off recorded.

---

## Phase 2 — Core Framework

**Objectives:** the playable systemic skeleton on a small greybox test map — every foundational system working end-to-end at framework quality, architecture rules proven under real code.

**Deliverables:** UE project + module scaffold + CI · Enhanced Input & character controller (Motion-Matched locomotion on greybox terrain, swim/climb prototypes) · interaction system · inventory & items · crafting (tier 0–2 vertical) · GAS body-state + metabolism core (hunger/hydration/energy/temperature/stamina) · health/injury framework (cuts, bleeding, bandaging, inspection mode v1) · fire + basic cooking + water drinking/boiling · save/load v1 (versioned records, async, backups) · main menu, settings (full graphics options + upscalers), HUD v1 · basic building (10 pieces, snap, stability graph, blueprint mode v1) · weather framework (state machine, rain, parameters wired to wetness/temp) · time system + day/night sky · debug tooling & time-scrub harness.

**Milestones:**
- **M2.1 Foundations** — project/modules/CI/tag registry; graphics spike: foliage benchmark (Nanite leaves vs cards) + Lumen SW/HW scenario tests → locks graphics approach.
- **M2.2 The Body** — character controller + body simulation + diegetic feedback v1; *gate:* survive/die believably on an empty map.
- **M2.3 Hands** — interaction + inventory + crafting + fire/cooking/water; *gate:* the minute-loop is fun in greybox.
- **M2.4 Home** — building + save/load + weather/time; *gate:* build shelter, survive scripted storm night, quit/reload losslessly.
- **M2.5 Framework Complete** — menus/settings/HUD, test coverage, perf gates live; full hour-loop playable.

**Dependencies:** Phase 1 sign-off; M2.1 blocks all; M2.2/M2.3 parallelizable after M2.1; M2.4 needs M2.3.
**Complexity:** XL. **Risks (top):** GAS learning curve (mitigate: facade + early spike), Motion Matching dataset availability (mitigate: Game Animation Sample interim), scope creep into content (mitigate: greybox-only rule — zero production art in Phase 2 except graphics-spike scenes).

**Verification / exit criteria:** 2-hour greybox playtest passes (external testers complete the hour-loop unprompted); all simulation-core automation tests green; save round-trip property test green; perf gates running in CI with baseline numbers; architecture review confirms module rules held (no dependency violations); every Phase 2 system has its Gameplay Debugger category.

---

## Phase 3 — World & Content Expansion

**Objectives:** the real game — full handcrafted world, complete wildlife/ecology, all survival systems to full spec, environmental storytelling, production art/audio/animation quality, complete crafting/building content, graphics at lookbook quality.

**Deliverables:** 4×4 km world (blockout → region production: Coast → Lowland → River/Swamp → Highlands/Caves → Mountains) · all 24 species w/ ecology + simulation LOD · full medical/disease/nutrition depth · hunting/tracking/fishing complete · full crafting (T0–T5, ~120 recipes) + building set + treehouses/bridges/raft · all 8 characters production quality w/ appearance state system · narrative sites & note/knowledge content · Journal complete · full ambience/foley audio · storms/floods/seasonal cycle · vertical slice then region-by-region content completion.

**Milestones:**
- **M3.1 World Blockout** — full-map traversable blockout, playtested for pacing/sightlines; *gate:* blockout walk is engaging before beautification.
- **M3.2 Vertical Slice** — Coast region at final quality (art/audio/systems/first-hour experience); *gate:* the "is this AAA?" review — slice must screenshot- and playtest-compete with genre leaders; establishes all production benchmarks & costs (informs schedule realism for remaining regions).
- **M3.3 Ecology Alive** — all species + statistical ecology live world-wide; mega-base + wildlife perf gates pass.
- **M3.4 Systems Complete** — every launch system at full spec; feature freeze.
- **M3.5 World Complete** — all regions to slice quality, all content placed; content freeze.

**Dependencies:** Phase 2 exit; M3.2 needs M3.1 + character/asset pipelines proven; M3.3 parallel with region production after M3.2.
**Complexity:** XL+ (the longest phase by far). **Risks (top):** content scale underestimation (mitigate: M3.2 measures true region cost → scope adjust *then*, cutting map density before quality), foliage/Lumen perf wall (mitigate: budgets enforced from M3.1), ecology emergent-bug tail (mitigate: soak tests + telemetry from M3.3).

**Verification / exit criteria:** full-map playtests of the entire arc (Act I–IV) by fresh external testers hitting the intended pacing (10 doc §1) within ±40%; all perf gates green incl. mega-base & max-wildlife scenes; zero blocker/critical bugs open; art director sign-off per region vs lookbook; feature-complete build tagged.

---

## Phase 4 — Polish, Optimization & Ship Readiness

**Objectives:** ship quality — performance across the hardware matrix, balance from telemetry, accessibility complete, stability, Steam readiness.

**Deliverables:** optimization passes to final budgets on min/rec/enthusiast matrices · balancing from time-scrub telemetry + playtest data (all three difficulty modes) · full bug-fix cycles (beta program) · accessibility feature completion (08 doc §5) · localization pass (text is externalized from Phase 2; launch languages TBD by publisher decision) · Steam integration (achievements, cloud saves, Deck verification pass, store assets, wishlisting build/demo decision) · final QA certification cycles · launch candidate.

**Milestones:** M4.1 optimization complete (all tiers hit targets) → M4.2 balance lock (post-beta feedback) → M4.3 content-complete release candidate 1 → M4.4 zero-blocker RC + Steam review pass → **M4.5 GOLD**.

**Dependencies:** Phase 3 exit; beta program needs M4.1.
**Complexity:** L. **Risks:** long-tail perf outliers on min spec (mitigate: min-spec hardware in CI matrix from Phase 3), balance churn (mitigate: data-driven tuning means balance changes never require code).

**Verification / exit criteria:** 8-hour soak zero-leak/zero-crash on all tiers; crash rate < 0.5% sessions in beta; 99th-percentile frame time within budget on Recommended; accessibility checklist complete; Steam build review passed; QA sign-off; leads' go/no-go unanimous.

---

## Cross-phase task breakdown (top-level WBS)

1. **Engineering** — 1.1 project/CI · 1.2 core modules & event bus · 1.3 GAS/body sim · 1.4 character/movement · 1.5 interaction · 1.6 inventory/items · 1.7 crafting · 1.8 building/stability · 1.9 save · 1.10 weather/time · 1.11 wildlife AI/ecology · 1.12 audio systems · 1.13 UI framework · 1.14 settings/graphics options · 1.15 debug/telemetry tools · 1.16 Steam/platform.
2. **Art** — 2.1 lookbook · 2.2 material library · 2.3 characters ×8 · 2.4 vegetation library · 2.5 terrain/regions ×6 · 2.6 water/waterfalls · 2.7 items/props (~200) · 2.8 building pieces (~60) · 2.9 wildlife ×24 · 2.10 VFX library · 2.11 narrative sites (~25).
3. **Animation** — 3.1 MM locomotion dataset · 3.2 interaction montages (~90) · 3.3 animal sets ×5 guilds · 3.4 facial/body-state · 3.5 Control Rig runtime.
4. **Audio** — 4.1 ambience engine · 4.2 biotope libraries ×6 · 4.3 foley · 4.4 wildlife voices · 4.5 weather · 4.6 body/UI · 4.7 stingers · 4.8 mix.
5. **Design** — 5.1 tuning tables & curves · 5.2 recipe/item data (~120/~200) · 5.3 species behavior data · 5.4 world content plan & note writing · 5.5 balancing · 5.6 playtest program.
6. **QA** — 6.1 test plans per milestone · 6.2 automation suite stewardship · 6.3 beta program · 6.4 certification.

Detailed per-milestone task tickets are generated at each phase kickoff (PM-owned), not pre-written here — task granularity below milestone level would be fiction this early, and we don't plan with fiction.
