# UI/UX Plan

**Owner:** UI/UX Designer
**Principle hierarchy:** diegetic > spatial > contextual widget > persistent widget. A persistent widget is a design failure until proven necessary.

---

## 1. HUD (in-world play)

**Default state: empty screen.** Elements appear only when informative, then fade.

- **Vitals cluster** (bottom-left, four minimal arc slivers: hydration/calories/energy/health): materializes only when a vital crosses a caution threshold or on player "self check" key tap; fades after 4 s. Wilderness mode: never shown — body cues + inspection only (the diegetic feedback map in the survival spec is the real UI).
- **Interaction prompt:** small center-low label with verb + key when focusing an interactable; radial hold-progress for timed verbs. Long-press E on the same target = "examine" (flavor + knowledge text) — the learning verb.
- **Stamina:** thin arc near crosshair area only while draining/recovering.
- **No** minimap, compass overlay, quest markers, damage numbers, XP toasts, or enemy indicators. Ever.
- Crosshair: single 2 px dot, optional off.

## 2. Diegetic instruments

- **Field Journal** (tab): the game's soul-object — hand-drawn map (self-sketching as regions are explored; player can add custom marks/notes), recipe sketches, plant/animal knowledge pages (filled by observation), body-care notes, found expedition notes archive. Rendered as a physical book the character holds; world remains live (unpaused) while reading — checking the map in danger is a choice.
- **Body inspection mode** (hold key): camera pulls to zone views with character animation; conditions shown physically (wounds, redness, leeches) with short plain-language labels on focus. Treatment applied contextually within this mode.
- **Crafting mat / building ghost / fire & cooking states:** all fully in-world 3D (see system specs) — no 2D crafting screens for handcrafts.

## 3. Inventory

The one necessary "game screen." Design: **backpack laid open** — semi-diegetic grid over a blurred live world (unpaused, exit-on-damage). Weight + slot hybrid; equipment silhouette for clothing/tool slots; container transfer as side-by-side panels; item cards show *qualitative* states ("damp", "spoiling soon", "well-made") not raw numbers, with exact data available in an optional "detail" toggle for players who want it (immersion default, information available — resolves the sim-depth vs minimalism tension).

## 4. Menus

- **Main menu:** live 3D scene (rainforest vignette varying with real-date/weather whimsy), Continue / New / Load / Settings / Credits. Character select at world creation: 3D lineup of the eight characters, cosmetic-only framing explicit ("All survivors are equally capable.").
- **Settings:** full graphics suite (presets + granular: Lumen quality/HW-RT, Nanite, VSM, foliage density, upscaler choice DLSS/FSR/XeSS/TSR + frame gen where available, FOV, motion blur off-able), audio buses, rebindable Enhanced Input with per-context pages, gameplay toggles (crosshair, prompt verbosity, autosave cadence), difficulty (world-creation choice; can soften mid-run, never harden — protects Wilderness integrity).
- **Save UX:** autosave on sleep + interval + safe-quit; manual save slots (Explorer/Survivor); Wilderness = single rolling save. Load screen shows screenshot + day count + character (save-header design, TDD §7).

## 5. Accessibility (planned now, shipped Phase 4, wired Phase 2)

Text scaling, colorblind-safe status iconography (shape+color coded), subtitle/caption system for critical audio cues (optional "sound visualization" ring for deaf players — off by default), full remapping incl. hold-to-toggle conversions, camera motion reduction set (sway/bob scales), photosensitivity pass on lightning, arachnophobia toggle (replaces spider models with a non-arthropod hazard variant — cheap at design time, impossible later).

## 6. UX tone rules

All text minimal, in-fiction where possible ("My leg is broken — I need a splint" journal line vs "FRACTURE DEBUFF −40% SPEED"). No numbers in gameplay surfaces unless the detail toggle is on. Every new-player teaching moment is delivered by world design (the starting beach's layout *is* the tutorial) — a first-hour design doc will be written as part of Phase 3 world content planning.
