# Pipelines — Asset, Graphics, Animation, Audio

**Owners:** Lead Graphics Engineer, Environment Artist, Character Artist, Animation Director, Audio Director

---

## 1. Asset Pipeline

- **DCC chain:** Blender/Maya (modeling, per-artist choice; exchange via FBX/USD with committed export presets) → Substance Painter/Designer (texturing) → SpeedTree or in-house + PCG for vegetation → Metahuman-derived pipeline for character heads (see §3) → UE.
- **Interchange rules (machine-validated on import):** scale 1uu=1cm, +X forward, ORM-packed textures (`_ORM`), power-of-two, per-category texel density targets (environment 512 px/m, hero props 1024 px/m, characters 2048 px/m equivalents), naming per Architecture doc. Import via committed Interchange pipeline assets so imports are reproducible.
- **Nanite policy:** on by default for opaque static geometry (rocks, trunks, ruins, building pieces); traditional LODs for skeletal meshes, foliage cards (pending M2.1 benchmark), translucents.
- **Quality gates:** every asset category has a reference "gold" asset approved by art direction before mass production begins (vertical-slice-first, see Roadmap). Review checklist: silhouette, texel density, material instance (not new master), collision, LOD/Nanite settings, thumbnail.
- **LFS hygiene:** binary types tracked; Tools/ script audits repo weekly for untracked binaries and orphaned assets.

## 2. Graphics Pipeline

**Look definition:** grounded photorealism — reference photography packs (Amazon/Congo basin field photos, film references: *Embrace of the Serpent*, *Apocalypto*, *The Lost City of Z*) assembled into a lookbook **before** vertical slice; every lighting scenario (noon canopy, golden hour river, storm, night fire, cave) gets an approved reference frame.

- **Lighting:** Lumen GI + reflections (HW RT where available, SW fallback path kept working at all times — every graphics feature must have its scalability story *at integration time*, not retrofitted). Fully dynamic time-of-day: no baked lighting anywhere. Virtual Shadow Maps; one directional sun + sky atmosphere + volumetric clouds as the only global lights; local lights (fire, torch) budgeted (see Optimization).
- **Materials:** strict **master-material library** (Environment, Foliage, Character Skin/Hair/Cloth, Water, Rock/Cliff-blend, Prop, Building, FX) — content uses instances only. Global systems threaded through masters from day one: **wetness** (weather-driven darkening/roughness/puddles via runtime virtual texture), **wind** (foliage pivot animation from weather params), **dirt/mud/blood accumulation** (character layer masks driven by gameplay state), distance blending, moss/water-line rules on rocks.
- **Water:** UE Water plugin base + custom surface shading (flow maps on rivers, SSR + Lumen reflections, depth-based absorption tuned to tropical sediment), underwater post volume, shoreline foam, interactive ripples (character/rain via fluid sim RT at low cost).
- **Volumetrics:** volumetric fog always on (density from weather), local fog volumes (swamp/dawn), light shafts under canopy (VSM + fog — the signature screenshot).
- **Post:** filmic but restrained — physical camera exposure ranges per scenario, subtle bloom, no aggressive vignette/CA by default (immersion > "cinematic" filters); LUT-free color pipeline (grade in-scene, not in post) to keep photoreal integrity.
- **Upscaling/AA:** TSR default; DLSS/FSR/XeSS integrated in Phase 2 settings menu.

## 3. Character Pipeline

- **Heads/bodies:** MetaHuman-based foundation, art-directed sculpts per character (avoid "MetaHuman sameface": custom sculpt passes, unique albedo/roughness maps, hand-tuned eye shaders). Groom hair (strand-based) with card fallback LOD for lower tiers. Eight characters share **one gameplay skeleton + rig** (GDD §7); body morphs within rig tolerance (Jovan taller / Leonidas shorter+muscular are visual morphs; identical capsule & camera).
- **Dynamic state layers (one system, all characters):** wetness (rain/swim masks with drying), sweat (metabolism-driven brow/back sheen), dirt/mud (accumulates from actions/terrain contact, washes in water — hygiene loop made visible), blood (own + prey), injury decals + persistent scars, cloth wetness darkening. All driven by a single `UCharacterAppearanceComponent` reading gameplay state — no per-feature hacks.
- **Clothing:** layered outfit slots (torso/legs/feet/accessory) with insulation/armor data; cloth sim (Chaos Cloth) on hero pieces only.

## 4. Animation Plan

**Owner:** Animation Director. Quality bar: RDR2-inspired weight and deliberateness (GDD).

- **Locomotion:** Motion Matching (PoseSearch) on a custom-captured/curated dataset: walk/jog/sprint with load variants (heavy carry changes gait), terrain variants (mud trudge, slope scramble, water wade), fatigue/injury gait layers (limp sets per leg-injury state, exhaustion slump). Game Animation Sample is the scaffolding reference; shipped dataset is our own.
- **True first-person:** full-body avatar (GDD §10); camera socketed to head with stabilization; separate aim/look layering via Control Rig. Every interaction has a full-body montage (crouch-to-harvest, kneel-to-drink, two-hand chop) — interactions are *performed*, not teleported.
- **Control Rig runtime:** foot IK (critical on jungle terrain), hand IK snapping to interactables/tools/building placement, look-at, procedural climbing hand/foot placement.
- **Interaction montage library plan (~90 montages at launch)** categorized: harvest (12), craft (16), fire (8), medical/self-care (14, incl. inspection poses per zone), eat/drink (10), tools (18), building (12), fishing/hunting (10). Each budgeted at production-quality with polish pass in Phase 4.
- **Animals:** per-guild rigs (feline, ungulate, reptile, avian, primate) with shared graph architecture: locomotion state machines + per-species gait data, needs-action montages (drink, graze, sleep, alert), predator kill pairs (2 per predator, positional), death/wounded states. Ring-1+ LODs drop IK and blend complexity (AI LOD doc).
- **Facial:** MetaHuman facial rig for pain/effort/cold/fever expressions driven by body state (no dialogue at launch — facial animation is a *survival feedback channel*).

## 5. Audio Plan

**Owner:** Audio Director. Principle: **the rainforest is the soundtrack** — no background music in normal play; sparse earned stingers at emotional peaks only (first summit, near-death recovery, storm survival), delivered as one-shot MetaSound events, days apart.

- **Ambience engine (MetaSounds):** procedural layered bed per region × time-of-day × weather: base biotope loop + stochastic spot emitters (bird calls, branch falls, insect clusters) placed by rules, not loops — so the forest never audibly repeats. Wildlife *actual* agents add their real calls on top (howler dawn chorus is the real monkeys, audible 1 km — diegetic information: fauna density, direction).
- **Weather audio:** rain on canopy vs on player shelter roof material (a *reward*: rain on your own thatch roof) vs on water; distance thunder with correct delay; wind through canopy layers.
- **Foley:** footsteps per surface (mud, leaf litter, rock, sand, shallow water, wood structures) × barefoot/shoe × gait, cloth movement, gear rattle by load, tool impacts per material, water interactions. Player loudness feeds AI hearing — audio and stealth are one system.
- **Caves/occlusion:** convolution or parametric reverb zones per cave shape, sound propagation/occlusion (storm heard muffled from cave depth; audio tells you the weather before you exit).
- **Body audio as UI:** heartbeat under blood loss + exertion, breathing ramps (cold shiver-breath, heat pant), stomach growls, teeth chatter — the diegetic feedback map in the survival spec is delivered chiefly through this layer.
- **Mix:** loudness-managed buses (ambience/foley/creatures/UI/stingers), night mix opens dynamic range (quieter floor → scarier transients), slider set incl. separate "creature proximity" accessibility boost.
