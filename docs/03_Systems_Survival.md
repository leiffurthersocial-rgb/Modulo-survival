# Systems Spec — Body Simulation, Health & Medical, Fire/Cooking/Water

**Owners:** Senior Systems Designer, Lead Gameplay Designer
**Tech substrate:** GAS attributes + `UMetabolismComponent` @ 1 Hz (TDD §3). All constants live in tuning Data Assets (per difficulty mode), never in code.

Design intent: a *legible* simulation. Depth comes from interactions between simple, individually understandable rules — never from hidden math the player can't reason about. Every state must be (a) diagnosable in-world, (b) traceable to a cause, (c) treatable through a logical action.

---

## 1. Attribute Map

### 1.1 Vitals (primary, player-facing)

| Attribute | Range | Drains by | Restored by | Key effects when low |
|---|---|---|---|---|
| **Hydration** | 0–100 | time, heat, exertion, sweat | drinking safe water, watery foods | stamina cap ↓, energy drain ↑, death at 0 (after grace period of collapse) |
| **Calories (energy store)** | 0–100 (maps to kcal reserve) | BMR + activity | eating | stamina regen ↓, carry effectiveness ↓, muscle loss over days |
| **Energy (wakefulness)** | 0–100 | time awake, physical/mental fatigue | sleep (quality-scaled), rest, some foods | slower actions, blurred focus at night, forced micro-sleeps at 0 |
| **Health (composite)** | 0–100 | injuries, sickness, organ stress | derived — recovers only when contributing causes are treated | death at 0 |

Health is **computed, not a pool**: `Health = f(blood level, infection load, organ stress from starvation/dehydration/toxins, untreated trauma)`. You cannot "heal" health directly; you treat causes. This is the single most important divergence from arcade survival.

### 1.2 Nutrition macros (second layer, inspected in Journal)

- **Protein** — muscle maintenance; deficiency: stamina max ↓, wound healing speed ↓.
- **Fat** — cold resistance buffer, slow calorie reserve; deficiency: temperature vulnerability ↑.
- **Carbohydrates** — fast energy; deficiency: stamina regen ↓; excess without activity: none (we don't simulate weight gain at launch).
- **Vitamins** (single aggregate "micronutrients" channel at launch; per-vitamin split is data-ready but not surfaced): deficiency after ~5 in-game days of monotone diet → immune response ↓ (infection risk ↑), energy recovery ↓.

Rationale: Green Hell proved 4 macro channels are learnable; more channels than that punishes without teaching. Variety of diet is the intended dominant strategy.

### 1.3 Condition modifiers

- **Body Temperature** (core °C, 35–40 band): driven by air temp, wetness, wind, clothing insulation, activity heat, fire proximity, shade, altitude, time of day. Hypothermia stages (shiver → stamina penalty → health drain) and hyperthermia stages (sweat rate ↑↑ → exhaustion → collapse). The **wet + wind + night** combination is the classic killer, as in reality.
- **Wetness** (0–100, per clothing layer): rain exposure, swimming, sweat. Dries by ambient heat/fire/wind; wet clothing multiplies cold loss and causes skin issues after prolonged exposure (chafing debuff).
- **Sweat**: visible on character, increases hydration drain, attracts insects, washes off (river bathing = hygiene loop).
- **Physical Fatigue** (muscle): accumulates from sprinting, chopping, carrying overweight; lowers stamina ceiling; clears with rest even while awake.
- **Mental Fatigue**: accumulates from prolonged darkness, pain, hunger, monotone diet, sleepless nights; effects are *perceptual* (audio dulling, slight desaturation, heavier camera sway) — never hallucinated threats (no supernatural, no fake enemies). Cleared by quality sleep, cooked meals, fire comfort, sunrise.
- **Stamina** (short-term action resource): standard drain/regen; ceiling = f(fatigue, calories, hydration, temperature). Stamina is the *convergence gauge* where all mismanagement becomes tangible moment-to-moment.

### 1.4 Metabolism model (how it ties together)

1 Hz tick: `EnergyExpenditure = BMR + ActivityCost(movement mode, load, slope) + ThermoregulationCost(temp delta)`. Expenditure drains calories & hydration (sweat) with rates modulated by weather. Digestion: eaten food enters a stomach buffer, releasing macros over 30–90 in-game minutes (eating ≠ instant fix; plan meals before expeditions). Overeating → sluggish debuff. All rates tuned so the *default day* (moderate activity, adequate diet) is comfortably survivable — pressure comes from ambition (expeditions, storms, injuries), not the idle clock.

---

## 2. Health & Medical — Body-Zone Model

### 2.1 Zones

Head, torso, left/right arm, left/right leg. Each zone holds **local conditions**; the **Inspection mode** (hold key → character examines body, camera + animation) is the diagnostic interface — a signature immersion feature (GDD Pillar 2).

### 2.2 Condition catalog (launch)

| Condition | Cause | Untreated course | Treatment |
|---|---|---|---|
| **Cut / laceration** | blades, rocks, animal claws, thorns | bleeding (rate by severity) → infection risk while open | pressure → bandage (cloth/leaf), clean water rinse first lowers infection chance |
| **Deep wound** | predator bites, falls onto rocks | heavy bleed, cannot self-close | needs dressing + stitching (bone needle + fiber) later stages |
| **Blood loss** | any bleed | stamina/energy ↓, pallor, unconsciousness, death | stop bleed; blood level regenerates over days, faster with protein + hydration |
| **Fracture** | falls, large animal hits | zone unusable (leg: no sprint/jump, heavy limp; arm: no two-hand tools, slow craft) | splint (sticks + rope/bandage) → healing over in-game days, re-injury if abused |
| **Sprain** | falls, misjudged jumps, mud slips | milder, temporary limp/grip penalty | rest, compression wrap accelerates |
| **Infection (wound)** | dirty/unbandaged wounds, dirty bandages | local → systemic: fever (temp regulation disrupted), energy drain, health decay | clean + antiseptic dressing (boiled water, ash, honey, medicinal plants); systemic stage needs fever management (hydration, rest, cooling) |
| **Poison** | misidentified plants, spoiled food, snakes, spiders | vomiting (dehydration spiral), tunnel vision, health drain by toxin class | activated charcoal, antidote plants (species-matched), time |
| **Parasites** | unpurified lowland/swamp water, undercooked meat, leeches | calorie & vitamin theft (eat more, gain less), visible symptoms after incubation | antiparasitic plant preparations; leeches removed manually in inspection |
| **Disease (launch set: fever "jungle flu", food poisoning, heat stroke, dysentery)** | exposure + low immunity, bad food/water | each has incubation → symptomatic curve → recovery/critical | rest, diet, hydration, plant medicine; prevention is the real cure |

Infection risk is a *probability roll at wound events* modified by hygiene state, not constant micromanagement. Visible progression (redness → swelling → discoloration in inspection view) always precedes systemic danger — fair signaling.

### 2.3 Healing philosophy

Wounds heal in stages with visible states (fresh → dressed → scabbed → scarred). Healing speed = f(nutrition [protein], rest, hydration, zone strain). Scars persist cosmetically on the character permanently (cheap, high-value personalization of a playthrough).

---

## 3. Fire System

Fire is a **simulated device**, not a toggle: `UFireComponent` holds fuel mass, burn rate (fuel type), heat output curve, and state (unlit → smoldering → burning → embers → cold ash).

- **Ignition:** hand drill (stamina + time + skill-expressed minigame-free timing), fire plow, bow drill (faster, craftable), flint & steel (reliable, late tier). Ignition chance = f(tinder quality, wood dryness, rain/wind exposure). Fire in rain requires shelter or roofed fire pit — logical cause and effect.
- **Fuel:** tinder → kindling → logs; wet wood smokes heavily (visible, attracts attention radius, poor heat), dries near an existing fire (racks craftable).
- **Heat propagation:** radial warmth (temperature system input), cooking capability zones, light source (AI-visible), ember hazard (structures can ignite — see building weather damage; player clothing can singe).
- Embers persist hours; restarting from embers is cheap — encourages fire stewardship, a real survival rhythm.

## 4. Cooking & Food

- Food items carry: macro payload, spoilage clock (heat-accelerated), contamination flags (raw meat, parasite-risk), and **cook states** (raw → cooked → burnt) per method.
- **Methods:** open-flame roasting (stick), stone cooking (flat rock: no skewer loss, slower), boiling (pot/coconut/turtle shell: soups combine ingredients, hydration + macros), **smoking** (rack over low fire: long preservation), drying (sun rack: slow, weather-dependent).
- Recipes are discovered, not menu-given: combining ingredients in a pot yields results by rule (broth = water + protein + plant), Journal records successes. Spoiled/burnt food is still edible — with consequences.
- Storage: raised containers and smoke-preserved food resist spoilage; meat left in the open attracts scavengers and predators to your camp (systemic link to wildlife AI — intended emergent pressure).

## 5. Water & Purification

- **Sources ranked by risk:** rain catch (safe) > flowing highland water (low) > lowland river (parasite chance) > standing/swamp (high parasite + disease) > coastal brackish (dehydrating, must distill).
- **Purification:** boiling (kills biologicals; needs vessel + fire), cloth pre-filter (sediment only — players must learn filtering ≠ purifying), char/sand filter structure (mid tier), solar still (late tier, also desalinates).
- **Carry:** improvised (folded leaf: one sip, drips), coconut flask, bamboo canteen, crafted waterskin (animal hide). Water containers track fill + contamination state (dirty container re-contaminates clean water — hygiene matters).
- Rain collectors (building module) make base water logistics an infrastructure achievement.

## 6. Sleep System

- Sleep restores Energy scaled by **sleep quality**: bed type (ground < leaf pile < bamboo bed < treehouse bed), shelter (rain/wind exposure ruins sleep), warmth (fire nearby), safety (interruptions from wildlife wake events), noise, hunger/pain (pain-disturbed sleep is worse).
- Time passes during sleep with the simulation running in accelerated coarse mode (metabolism, fires burning down, weather evolving, food spoiling — no free pause). Waking conditions honestly reflect the elapsed night.
- No sleep → forced micro-sleep events after ~40 sleepless hours (screen dips, dangerous while climbing/swimming) — the system that makes night shelter genuinely matter.

## 7. Difficulty-mode tuning

All of the above reads rates/probabilities from `UDifficultyTuning` Data Assets (Explorer / Survivor / Wilderness). One simulation code path; Explorer sets gentler drain rates, wider grace windows, simplified infection (auto-clean on bandage); Wilderness removes HUD vitals (inspection + body cues only). No system may branch on difficulty in logic — only through tuning data. This keeps QA surface sane and prevents mode-specific bugs.

## 8. Player-facing feedback map (Pillar 2 compliance)

Every internal state must have at least one **diegetic** channel before any widget:

| State | Diegetic signals |
|---|---|
| Low hydration | dry-mouth swallow audio, cracked lips (close-up inspect), sluggish stamina |
| Low calories | stomach growl audio, slight camera heaviness, visible slimming over long deficit |
| Cold | breath fog, shivering hands (aim sway), audible teeth chatter, hunched idle |
| Heat | sweat sheen, heat haze at screen edges, heavy breathing |
| Fatigue | blink weight overlay (subtle), slower interaction animations |
| Infection/fever | flushed skin in inspection, sweat + shiver simultaneously (recognizable fever signature) |
| Blood loss | pallor, desaturation ramp, heartbeat audio under exertion |

HUD widgets (minimal, fade-out) mirror these only in Explorer/Survivor modes — see UI plan.
