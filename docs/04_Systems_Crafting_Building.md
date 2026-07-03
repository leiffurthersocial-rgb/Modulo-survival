# Systems Spec — Crafting & Building

**Owners:** Lead Gameplay Designer, Senior Systems Designer, Technical Director

---

# Part A — Crafting

## A1. Philosophy

Crafting is **discovery-driven and diegetic**. No global recipe list unlocked by levels. The player learns recipes by:

1. **Insight** — holding/combining plausible components suggests a recipe ("these could become…") when the combination is close to valid.
2. **Observation** — examining crafted objects in the world (abandoned camps) teaches their recipe.
3. **Notes** — found survivor/expedition notes teach advanced recipes (ties progression to exploration).

Learned recipes are recorded in the **Field Journal** with hand-drawn sketches. Every item has a clear gameplay purpose (GDD rule); if a proposed item's purpose can't be stated in one sentence, it's cut.

## A2. Mechanics

- **Crafting surface:** a physical, diegetic crafting space — items laid on the ground/mat in front of the crouching character (Green Hell-inspired but with our own free-arrangement presentation). No abstract crafting menu for handcrafts.
- **Stations gate tiers:** hands → crafting mat → fire (thermal recipes) → drying rack → workbench (lashed frame) → forge-less "hard tool" station (stone grinding slab). Stations are built structures — crafting and building progressions interlock.
- **Recipe resolution:** tag-based. A recipe requires component *tags* (`Material.Wood.Stick`, `Material.Fiber.Rope`, `Tool.Cutting` present-but-not-consumed), not specific items — any rope works. This is the key extensibility decision: new items automatically participate in old recipes via tags.
- **Quality:** output durability/effectiveness varies slightly with component condition (dry vs damp wood, fresh vs brittle fiber). No RNG crit-crafting — quality is traceable to inputs.
- **Durability & repair:** tools wear by use class; repairable at cost of materials + a repair-count cap (visible wear states on mesh: pristine → worn → cracked). Encourages toolkit redundancy on expeditions.

## A3. Tier overview (~120 recipes at launch; full tree in [10_Progression.md](10_Progression.md))

| Tier | Unlocked by | Representative outputs |
|---|---|---|
| 0 — Bare hands | start | picked stones, sticks, leaves; stone-on-stone sharp flake |
| 1 — Primitive | insight | stone blade, stone axe, cordage from bark/vines, hand-drill fire kit, leaf bandage, sleeping pile, spear |
| 2 — Camp | crafting mat + fire | bow drill, cooking skewer, water leaf-funnel, basic traps (snare), fishing spear, bone hooks/needles, hide scraping |
| 3 — Homestead | workbench | bow & arrows, bamboo canteen, smoker, drying racks, char-sand water filter, compound tools (axe/adze), mud bricks |
| 4 — Established | grinding slab + notes | polished tools, tailored hide clothing/armor layers, advanced medicine preparations, fishing rod & net, raft components |
| 5 — Mastery | expedition notes (deep exploration) | metal salvage reworking (from wreck sites — no smelting-from-ore at launch), solar still, precision tools, mountain cold-weather gear |

Weapons remain survival-plausible throughout: spears, bows, knives, slings. No firearms at launch (a found flare gun with scarce ammo is the single "modern" exception — a panic button vs predators, telegraphing our no-combat-power-fantasy stance).

---

# Part B — Building

## B1. Philosophy & requirements

Modular, satisfying, physical. Requirements from vision: free placement, optional grid/snap, structural stability, blueprint mode, upgrades, repair, destruction, weather damage, material variety, future expansion support.

## B2. Architecture

**Piece-and-socket modular system with a structural integrity graph.** Compared alternatives:

- *Pure freeform (Rust-style sockets only):* fast to build in, weak for irregular terrain creativity.
- *Pure free placement (Green Hell-style shelters as monolith blueprints):* immersive but shallow building depth — fails the Valheim-inspired "building freedom" pillar.
- **Chosen hybrid:** structural *pieces* (foundation, pillar, beam, floor, wall, window wall, doorway, roof segments, stairs, ramp, railing, platform) snap via typed sockets when near valid connections; snap can be toggled off for free placement of *props* and decorative/utility items (racks, containers, furniture, fire pits). Grid assist is an optional toggle, default off.

### Structural stability

Valheim-style **support propagation graph**, chosen for readability over true physics simulation (Chaos-simulated statics would be expensive and opaque to players):

- Each piece type has support capacity per material; support flows from grounded pieces through connections with per-hop attenuation.
- **Visual language:** brief color pulse on placement preview (grounded=blue → safe=green → marginal=yellow → invalid=red) plus persistent *diegetic* cues (marginal beams creak in wind, sag slightly). Numbers never shown.
- Overloaded/orphaned pieces break realistically via Chaos (pre-fractured pieces, physics debris that becomes reclaimable material).
- Trees are anchors: **treehouse platforms** attach to qualifying trunks (trunk radius check) with dedicated socket rings — a headline feature, planned from day one, not retrofitted.

### Blueprint mode

Place a ghost structure (full snap/stability validation at ghost time), then deliver materials to it over time; each delivery advances visible construction stages with build animations. Ghosts persist in saves, are cancellable (refund delivered mats), and are the natural future co-op cooperation surface.

### Materials & upgrades

Material lanes: **lashed wood → hardwood/bamboo → mud brick/wattle-daub → stone** (+ thatch/hide/bark roofing). In-place upgrade path (wall → reinforced wall) preserving layout. Material choice matters: insulation value (temperature system), rain proofing, fire vulnerability (thatch + fire pit indoors = ignition risk via ember events), weight (stability graph), predator resistance.

### Damage, weather & repair

- Structures take damage from: storms (roof/wall exposure rolls during storm events, mitigated by material tier and wind shelter from terrain), floods near riverbanks (build siting matters), large-animal impacts, fire spread, and neglect (slow decay only for the lowest lashed tier — maintained bases don't rot away; we punish abandonment, not play).
- Damage states are visual (intact → damaged → critical) and repaired with a fraction of build materials via the repair tool (mallet).
- Destruction drops a material fraction — demolishing your own pieces is deliberate (hold-to-confirm) and refunds most materials.

## B3. Technical notes

- `UStructureSubsystem` owns the piece registry, stability graph (incremental recompute on graph edits only — never per-tick), streaming registration (TDD §9), and save records (piece type + transform + material + HP + owner).
- Pieces are ISM/HISM-batched per base region for rendering; promoted to unique actors only while interacted with/destructing. This is the make-or-break perf decision for large bases — designed in from the start, verified by the Phase 3 "mega-base" stress gate.
- Placement validation (terrain slope, overlap, water, socket rules) runs in a single shared validator used by both live placement and blueprint ghosts — one code path, no drift.
- **Future expansion hooks (build now, use later):** piece ownership field (co-op), functional-piece interface (`IStructureFunction` — rain collector, smoker, bed all implement it) so future settlement logic can enumerate base capabilities without new plumbing.

## B4. Utility & furniture set (launch)

Storage (baskets, chests, raised food cache), beds (tiers per sleep quality), rain collectors, drying/smoking racks, fire pits (open/ringed/roofed), water filter structure, benches/tables/trophies (comfort + Journal decoration value), torch sconces, ladders, rope bridges (anchor-to-anchor spans with sag — flagship craftable), raft (buildable on water edge; physics platform with pole/paddle propulsion).
