# Optimization Plan

**Owner:** Optimization Engineer, with Lead Graphics Engineer
**Doctrine:** performance is a feature built continuously, not a Phase 4 rescue. Every expensive system ships with its scalability story (this doc names them). Budgets are enforced by CI perf gates from the first playable build.

---

## 1. Frame Budget (Recommended tier: RTX 3070, 1440p, High, 60 fps → 16.6 ms)

| Slice | Budget | Notes |
|---|---|---|
| Game thread | 8 ms | of which: AI 1.5, simulation subsystems 0.5 (bucketed off-frame mostly), physics 1.5, animation 2.5, streaming/misc 2 |
| Render thread + RHI | 8 ms | draw call ceiling via Nanite + ISM batching |
| GPU | 16 ms | Lumen 3.5, VSM 2.5, Nanite base pass 3, foliage/translucency 2.5, water 1, volumetrics+fog 1.5, Niagara 1, post+upscale 1 |
| Memory | 12 GB VRAM Epic / 8 GB High / 6 GB Low | texture pool + Nanite streaming tuned per tier |

Minimum tier (GTX 1080, 1080p/30): SW Lumen low, VSM → shadow map fallback per engine scalability, foliage density 60%, simulation untouched — **scalability never changes gameplay simulation**, only presentation.

## 2. Named expensive systems & their strategies

- **Jungle foliage (the #1 risk):** layered strategy — Nanite trunks; benchmarked leaf approach (M2.1 spike: Nanite masked vs LOD cards); HISM batching per PCG cell; density scalability knob (Epic 100% → Low 50% with silhouette-preserving culling order: floor detail culls first, canopy last); interactive-bend displacement field capped to 32 simultaneous influencers; harvestable actor-swap on proximity only (05 doc).
- **Lumen under canopy:** SW quality tuned per scenario lookbook; screen-probe budget clamps; HW-RT optional tier; fallback path CI-tested every build (a broken SW path discovered late = min-spec catastrophe).
- **Wildlife:** the 4-ring simulation LOD (05 doc §A4) is the strategy — full agents capped (~20 ring-0/1), animation budget via URO + IK culling; statistical layer beyond. Perception queries staggered; scent grid updates 2 Hz shared.
- **Weather/rain:** GPU Niagara with fixed particle ceilings per preset; splash spawn via depth-buffer collision (no CPU traces); wetness via one global RVT update pass, not per-material logic.
- **Building/bases:** ISM/HISM batching per base with promote-on-interaction (04 doc §B3); stability solver incremental, edit-time only; Phase 3 **mega-base gate**: authored 800-piece test base must hold budget on Recommended tier — failure blocks content expansion until fixed.
- **Water:** river tiles LOD by distance, flow-map complexity scales down; underwater post only when submerged.
- **World Partition streaming:** 256 m cells + HLOD tiers; streaming hitches watched by soak test (TDD §13); async loading, no synchronous loads permitted in gameplay code (CI grep + runtime ensure).
- **Save system:** capture-on-game-thread → serialize-on-worker (TDD §7); autosave must cost < 2 ms game-thread in the frame it triggers.

## 3. Process

- **Perf gates in CI:** automated flythrough + fixed-camera scenes (canopy noon, storm, night fire, mega-base, river vista) captured per build on reference hardware; regressions > 5% fail the build and page the owning team.
- **Budget ownership:** every feature PR states its budget slice; Optimization Engineer signs off on anything touching the named systems above.
- **Cadence:** weekly Insights/Unreal Insights trace review from Phase 2 M2 onward; monthly memory & shader-permutation audits (master-material policy keeps permutations sane — instance-only rule is also a perf rule).
- **Hitching doctrine:** 99th-percentile frame time is a first-class metric alongside average fps; PSO precaching from first playable; shader compilation stutter is treated as a ship-blocking bug class, not a nuisance.
