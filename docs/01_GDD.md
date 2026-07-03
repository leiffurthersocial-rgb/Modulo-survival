# Modulo: Survival — Game Design Document

**Version:** 1.0 (Phase 1)
**Owners:** Creative Director, Game Director, Lead Gameplay Designer

---

## 1. High Concept

Modulo: Survival is a first-person, ultra-realistic single-player survival game set in a vast handcrafted tropical rainforest. There are no monsters and no supernatural elements: the jungle itself — heat, storms, hunger, infection, predators, and the player's own mistakes — is the antagonist. The player fantasy is *earned competence*: arriving helpless, learning the land, and gradually becoming someone who can read the forest, live off it, and build a home inside it.

**Genre:** Realistic survival / exploration
**Perspective:** First-person (third-person considered post-launch; animation pipeline keeps a full-body avatar from day one, see §10)
**Platform:** PC (Steam), premium price point
**Engine:** Unreal Engine 5 (see TDD)
**Session shape:** Long-form sandbox; a full playthrough of the survival arc is 40–80 hours
**Player count:** Single-player at launch; all architecture multiplayer-compatible (co-op up to 4 is the design ceiling we architect for)

### Primary inspirations — what we take, and what we deliberately don't

| Game | What we learn from it | What we do NOT copy |
|---|---|---|
| Green Hell | Body-part inspection, layered health simulation, nutrition macros, "the jungle is the enemy" | Its story structure, its exact inspection UI, sanity hallucinations |
| Sons of the Forest | Seamless world immersion, diegetic UI (held GPS/book), naturalistic AI companions' *presentation* | Cannibals/mutants, procedural horror pacing |
| Red Dead Redemption 2 | Animation weight, environmental believability, slow deliberate interactions that build immersion | Cinematic mission structure, honor systems |
| Valheim | Building freedom, structural stability that is readable and fun | Its stylized look, procedural worlds, tiered biome-boss loop |

We study *why* these work: they all make the player feel physically present in a world that follows consistent rules. Every design decision below is tested against that principle.

---

## 2. Design Pillars

Every feature must serve at least one pillar and contradict none.

1. **Believability first.** Systems mirror real-world logic. If a real survivalist would do X, X should work. If it wouldn't work in reality, it shouldn't work in-game.
2. **The world teaches, not the HUD.** No quest markers, no tutorials that pause the game, no "press F to survive" popups. Knowledge is the real progression currency.
3. **AAA visual and audio fidelity.** Screenshot-quality moments should occur naturally every session.
4. **Survival that rewards mastery.** Difficulty comes from ignorance, not grind. A knowledgeable player thrives; punishment is always traceable to a player decision.
5. **Built to grow.** Companions, settlements, story, and co-op arrive later without rewrites; nothing we ship in v1 may structurally block them.

---

## 3. Core Gameplay Loop

Three nested loops, each feeding the next:

**Minute loop — Sustain:** monitor body state → gather/hunt/collect water → eat, drink, treat wounds → manage stamina/energy through the day-night cycle.

**Hour loop — Establish:** scout terrain → gather materials → craft tools → build/extend shelter → secure food & water sources → survive weather events and nights.

**Multi-session loop — Master:** explore deeper biomes → discover abandoned camps and hidden locations → unlock crafting knowledge through discovery → build advanced bases (treehouses, bridges, water systems) → transition from *surviving* the jungle to *living in* it.

**Failure loop:** death is meaningful but not run-ending by default. Default mode: respawn at last shelter with inventory dropped at death site (retrievable, decays over days). Optional permadeath mode for purists. Both modes ship at launch; the save architecture treats death rules as a policy, not a hardcode.

### The knowledge economy

The core progression currency is *player* knowledge, backed by an in-game **Field Journal** (diegetic, hand-drawn as the character learns):

- Crafting recipes unlock by handling/combining components ("you understand what a sharp stone and a stick could become") and by discovering examples in the world (an abandoned camp with a smoker teaches smoking meat).
- Plant/animal knowledge accrues through observation, consumption (risky), and found survivor notes.
- The map is blank until explored; the character sketches it (see UI plan).

This is progression without XP bars — consistent with Pillar 2.

---

## 4. The World

One large **handcrafted** open world. **No procedural world generation** — every vista, cave, and camp is authored. (Procedural *tools* — PCG foliage scattering, procedural placement assistance — are used at author-time as brushes, never as runtime world generation. The distinction: procedural tooling accelerates artists; the shipped world is fixed and hand-tuned.)

**Setting:** an uncharted tropical river basin — a valley system ringed by mountains, opening to a coast. Roughly **16 km² (4×4 km)** playable. Rationale: Green Hell's map is ~4 km² and feels dense; Sons of the Forest is ~16 km² and feels vast but has empty stretches. We target 16 km² with Green Hell's density in a core 2×2 km "heart" and graduated density outward — big enough for genuine expeditions, small enough to handcraft to AAA density with a focused team.

### Region map (macro layout)

- **The Coast (S edge):** beaches, mangroves, tidal pools, shipwreck debris — gentlest survival conditions; the tutorial-by-geography starting region. Fishing-forward.
- **Lowland Rainforest (center):** the heart. Dense canopy, rivers, the richest resource mix, most abandoned camps.
- **The River Network:** three rivers with waterfalls, rapids, and calm stretches; the world's natural highways and navigation datum. Rivers always lead somewhere meaningful.
- **The Swamp (SE):** parasites, disease pressure, leeches, unstable footing — high-risk, unique resources (medicinal plants, rare fish).
- **Highlands & Cliffs (N):** cooler temperatures introduce the cold-exposure system; caves, mining resources, panoramic vistas.
- **The Mountains (N rim):** endgame exploration; genuinely cold, requires full equipment progression. The summit is the game's crowning vista.
- **Caves (throughout):** hand-authored cave systems, pitch black, echo audio, unique resources (flint, crystals, guano for fertilizer), some connecting regions as discovered shortcuts.

### Environmental storytelling

No NPCs at launch, so the world's *previous occupants* carry the narrative: a failed research expedition, an older abandoned village, prior survivors' camps. Each authored site tells a wordless story through arrangement (a tent collapsed under a fallen branch; a journal page pinned under a rock; a smoker still standing next to a skeleton with a broken leg splint). Found notes teach real recipes/knowledge — story and progression fused. A light mystery thread (what happened to the expedition?) rewards completionists but is never mandatory. Full story mode is postponed; these sites are designed so a future story layer can be threaded through them without relocation.

### Exploration design rules

- **Weenies & sightlines:** every region has a visible landmark (waterfall, giant kapok tree, cliff arch) that pulls the eye; landmarks are visible from one another so players self-navigate.
- **No fast travel at launch.** Distance is content. Late-game river rafts (crafted, physical) compress travel time diegetically.
- **Gating by competence, not walls:** the swamp is "gated" by disease pressure, the mountains by cold — all technically enterable naked at minute one, survivable only with mastery.

---

## 5. Gameplay Philosophy & Difficulty

- **Never hold the player's hand.** The only mandatory instruction is the input reference. Everything else is discoverable.
- **Logical cause and effect, always.** Drinking swamp water → parasites. Sleeping in rain → cold + fatigue. Meat near shelter → predators visit.
- **Fair signaling:** every threat telegraphs (audio cues, visual state changes, body feedback) — the player who pays attention is safe; the player who ignores signals pays.
- **Difficulty modes** are simulation-depth presets, not damage multipliers:
  - **Explorer:** relaxed metabolism rates, no permadeath, disease simplified.
  - **Survivor (default):** full simulation as specced.
  - **Wilderness:** full simulation + permadeath option + no HUD vitals (body inspection only).
- All modes run the same systems with different tuning tables — one code path, data-driven tuning (see TDD).

---

## 6. Systems Summary

Full specifications live in dedicated docs; this section fixes scope and intent.

| System cluster | Scope at launch | Spec |
|---|---|---|
| Body simulation (hunger, hydration, macros, vitamins, energy, sleep, temperature, wetness, stamina, fatigue) | Full simulation, ~20 interacting attributes | [03_Systems_Survival.md](03_Systems_Survival.md) |
| Health & medical (blood loss, fractures, sprains, cuts, infection, poison, parasites, disease, healing, medicine) | Body-zone injury model with inspection | [03_Systems_Survival.md](03_Systems_Survival.md) |
| Fire, cooking, water purification | Fuel/heat simulation, recipe cooking, boiling/filtering | [03_Systems_Survival.md](03_Systems_Survival.md) |
| Crafting | Discovery-driven, ~120 recipes at launch across 6 tiers | [04_Systems_Crafting_Building.md](04_Systems_Crafting_Building.md) |
| Building | Modular free-placement + snap, structural stability, blueprint mode, upgrade/repair/destruction, weather damage | [04_Systems_Crafting_Building.md](04_Systems_Crafting_Building.md) |
| Wildlife | ~24 species, needs-driven AI (no scripted loops), food chains, danger memory | [05_Systems_World_Wildlife_Weather.md](05_Systems_World_Wildlife_Weather.md) |
| Weather & time | Dynamic weather state machine, full astronomical day/night, moon phases, seasons-lite (wet/dry cycle) | [05_Systems_World_Wildlife_Weather.md](05_Systems_World_Wildlife_Weather.md) |
| Hunting, tracking, fishing | Tracks/spoor system, wound tracking, three fishing methods | [05_Systems_World_Wildlife_Weather.md](05_Systems_World_Wildlife_Weather.md) |

---

## 7. Playable Characters

Eight playable characters, selectable at world creation. **All gameplay statistics are identical** — differences are purely cosmetic (model, voice grunts/efforts, hands in first person). This is a hard rule for launch; a future skill system is postponed and must not leak in.

| Character | Visual identity |
|---|---|
| **Robin** | Blonde, brown eyes, white shirt, short textured hair |
| **Leif** | Brown hair, grayish eyes, black shirt, medium textured hair (not shoulder-length) |
| **Jovan** | Taller than average, brown hair, brown eyes, white shirt, medium textured hair |
| **Leonidas** | Shorter than average, extremely muscular, styled brown hair, brown eyes |
| **Erim** | Black medium textured hair, black goatee, brown eyes, glasses |
| **Till** | Blonde, blue eyes, short textured hair |
| **Lenni** | Brown middle-part hairstyle, brown eyes, glasses, dark green shirt |
| **Tusya** | Brown skin, black hair, brown eyes |

Design notes:

- Height/build differences (Jovan, Leonidas) are **visual only** — collision capsule, camera height, reach, and movement stats are identical across all characters to avoid hidden gameplay asymmetry. First-person camera sits at one canonical height; third-person-visible proportions vary within a range that never changes silhouette-driven gameplay (cover, passability).
- Glasses (Erim, Lenni) are cosmetic attachments — they never fog, break, or affect vision at launch (documented as a *possible* future immersion toggle, off by default).
- All characters share one rig and one gameplay skeleton (see Animation Plan) so every animation, clothing item, and wetness/dirt/injury effect works on all eight from day one. Character-specific assets are limited to: head, hair groom, body morph within rig tolerances, default outfit, effort voice set.
- Character identity persists per-save. Future co-op: each player picks a character (duplicates allowed).

**Explicitly not designed yet (postponed):** NPC companions, skills, morale, settlement roles. The character data schema, however, reserves extension points (see TDD §Data) so these can attach later without migration pain.

---

## 8. UI Direction (summary)

Minimalist, diegetic-first. Vitals surface through the character (breathing, gait, vignette, audio) before any widget. What must be a widget is small, contextual, and fades. Full spec: [08_UI_UX_Plan.md](08_UI_UX_Plan.md).

## 9. Audio Direction (summary)

Ambience-dominant: the rainforest is the soundtrack. No background music during normal play; sparse, earned musical moments only at emotional peaks (first summit vista, near-death recovery). Full spec: [07_Pipelines.md §Audio](07_Pipelines.md).

## 10. Camera & Presentation

First-person with **full true-body** (player sees own legs, arms, shadow — RDR2-style presence). All animation authored on the full-body rig from day one; a separate arms-only rig is explicitly rejected because true-body sells immersion (Pillar 1/3) and keeps a future third-person or co-op view cheap. Slow, weighty, interruptible interactions: bandaging takes seconds and an animation, not an instant menu click.

## 11. Out of Scope at Launch (repeat for clarity)

NPC companions, settlement management, job assignments, character skills, morale, base population, story mode, vehicles (except craftable raft, which is classified as a "large held tool / platform," not a vehicle system). PvP. Procedural worlds. Console ports (architecture must not preclude them).
