# Risk Analysis & Register

**Owner:** Project Manager, Technical Director, QA Lead
**Scale:** Likelihood × Impact, 1–5 each; score = L×I. Reviewed at every milestone; owners named per risk.

| # | Risk | L | I | Score | Mitigation | Trigger/early warning | Owner |
|---|---|---|---|---|---|---|---|
| R1 | **Content scale underestimation** — 16 km² handcrafted world at AAA density exceeds capacity | 4 | 5 | 20 | Vertical slice (M3.2) measures true cost per region *before* committing; pre-agreed descope ladder: shrink map perimeter density → merge Highland/Mountain content → never cut core-region quality | Slice takes >130% of estimate | PM |
| R2 | **Jungle rendering perf wall** — dense foliage + Lumen + VSM misses budgets on target HW | 4 | 5 | 20 | M2.1 graphics spike locks approach early; CI perf gates from first build; scalability designed per feature at integration (09 doc) | Spike scenes miss budget; gate regressions trend up | Lead Graphics |
| R3 | **Ecology/AI emergent bugs** — needs-driven AI produces degenerate behaviors (extinction spirals, predator camping spawn) | 4 | 3 | 12 | Statistical-layer clamps (population floors/ceilings); telemetry dashboards from M3.3; soak tests; danger-map caps | Soak telemetry shows population collapse / behavior loops | Lead AI |
| R4 | **GAS misfit** — hybrid attribute architecture fights us | 2 | 4 | 8 | Early M2.2 spike proves the pattern; facade isolation caps blast radius (TDD §3) | Spike friction; effect count perf issues | Lead Engineer |
| R5 | **Save-system corruption/complexity** — world-delta persistence bugs destroy player trust | 3 | 5 | 15 | Versioned records + property-based round-trip tests in CI from v1; atomic writes + rolling backups; save/load QA in every test plan | Any round-trip test flake; QA save bugs | Lead Engineer |
| R6 | **Motion Matching dataset gap** — can't source/produce animation data at RDR2-adjacent quality | 3 | 3 | 9 | Game Animation Sample as functional floor; budget mocap sessions in Phase 3; dataset needs specced in Animation Plan | MM locomotion still "floaty" at M2.5 | Animation Dir |
| R7 | **Engine version churn** — needed features (Substrate, Nanite foliage) mature mid-project | 3 | 2 | 6 | Phase-boundary upgrade policy w/ spike branch (TDD §1); adopt-when-stable stance already taken on Substrate/Mover/Mass | Upgrade spike reveals breakage > 1 week | Tech Director |
| R8 | **Simulation opacity** — realistic depth reads as unfair/confusing to players (the Green Hell onboarding cliff) | 3 | 4 | 12 | Diegetic feedback map is a *requirement* per state (03 doc §8); Explorer mode; first-hour geography-as-tutorial design; external playtests from Phase 2 greybox onward | Playtesters die without knowing why | Game Director |
| R9 | **Scope creep from postponed features** — companions/settlements/story pressure leaks into launch scope | 3 | 4 | 12 | Hard "postponed" list in GDD; extension-point policy channels the urge into data hooks, not systems; PM enforces at milestone reviews | Design docs start speccing postponed systems | PM |
| R10 | **Single-code-path difficulty breaks** — modes drift into separate logic | 2 | 3 | 6 | Architecture rule: tuning-data-only differences (03 doc §7); code review checklist item | Any `if (Difficulty==...)` in logic PRs | Tech Director |
| R11 | **Team scaling / binary workflow friction** — Git LFS + many content creators = merge pain | 3 | 3 | 9 | OFPA world; category-owner asset zones; weekly LFS audit; pre-agreed Perforce migration path (TDD §1) | Binary conflicts > 2/week | Tech Director |
| R12 | **Night/darkness rejection** — genuinely dark nights frustrate a segment of players | 3 | 2 | 6 | Moon-phase variance, luminous firelight, accessibility brightness floor *distinct from* gameplay darkness policy; playtest the mix | Playtest complaints cluster on night | Game Director |
| R13 | **Multiplayer-readiness tax abandoned under pressure** — teams bypass MP-compat rules when rushed | 3 | 4 | 12 | Rules are cheap & concrete (TDD §11); architecture review at every milestone; violations are refactor-now debts | Review finds UI-owned state / singular-player assumptions | Multiplayer Architect |
| R14 | **Audio ambience repetition** — procedural bed exposes patterns over 40–80 h playthroughs | 2 | 3 | 6 | Stochastic emitter architecture (07 doc §5); long-session listening QA; variant pool sizes specced per biotope | QA hears repeats within a session | Audio Director |
| R15 | **Steam Deck / min-spec long tail** — late discovery of unshippable low-tier perf | 2 | 4 | 8 | Min-spec + Deck hardware in CI matrix from Phase 3; simulation-vs-presentation scalability split (09 doc) | Tier gap widening in gate trends | Optimization Eng |

## Standing risk-review process

- Register reviewed at every milestone gate; scores re-assessed, new risks added, retired risks archived with outcome notes (institutional memory).
- Any risk hitting score ≥ 16 gets a named mitigation sprint in the current milestone, not a note.
- Postmortem discipline: every triggered risk gets a one-page "why didn't we see it" write-up feeding back into this register's early-warning column.
