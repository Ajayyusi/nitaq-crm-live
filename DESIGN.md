---
name: Nitaq Academy CRM
description: Night flight-deck operations panel — every number an instrument reading, every status an annunciator lamp.
colors:
  # Night panel (the committed default theme). Day values live in .impeccable/design.json colorMeta.dayValue.
  panel: "#0b0d0f"
  face: "#111417"
  raised: "#16191e"
  well: "#0d1013"
  bezel: "#22272e"
  bezel-strong: "#303740"
  ink: "#f2f5f2"
  dim: "#a4adb6"
  faint: "#7d8894"
  phos: "#39ff9a"
  phos-bright: "#63ffb1"
  phos-ink: "#06180e"
  caution: "#ffb000"
  alert: "#ff5148"
  advisory: "#55c8f0"
  chart-1: "#0f9a5f"
  chart-2: "#0c7aa6"
  chart-3: "#b17d0d"
  chart-4: "#7c6bd6"
  chart-5: "#c23934"
typography:
  display:
    fontFamily: "B612, Readex Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "0.05em"
  readout:
    fontFamily: "B612 Mono, ui-monospace, monospace"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: "32px"
    letterSpacing: "-0.01em"
  body:
    fontFamily: "B612, Readex Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  placard:
    fontFamily: "B612, Readex Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 700
    letterSpacing: "0.14em"
  lamp:
    fontFamily: "B612, Readex Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.1em"
rounded:
  lamp: "3px"
  ctl: "6px"
  card: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    textColor: "{colors.phos}"
    rounded: "{rounded.ctl}"
    height: "36px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.phos}"
    textColor: "{colors.phos-ink}"
  button-solid:
    backgroundColor: "{colors.phos}"
    textColor: "{colors.phos-ink}"
    rounded: "{rounded.ctl}"
    height: "36px"
  button-secondary:
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    height: "36px"
  lamp-ok:
    textColor: "{colors.phos}"
    rounded: "{rounded.lamp}"
    padding: "2px 6px"
  card:
    backgroundColor: "{colors.face}"
    rounded: "{rounded.card}"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    height: "36px"
---

# Design System: Nitaq Academy CRM

## Overview

**Creative North Star: "The Night Flight Deck"**

An academy run like a night flight deck (direction: Night Six-Pack, seed 5b13a029). Every surface is a matte instrument panel; every number is a gauge reading in luminous mono; every status is a rectangular annunciator lamp that is either lit or dim. The world explicitly refuses the white-admin dashboard: no gradient heroes, no tinted icon cards, no pastel status pills. Density is high but calm — hairline bezels separate instruments, and color appears only when it means something.

Night is the default theme (a pre-hydration script applies `.dark` unless the user chose day); day is a daylight-cockpit remap of the same tokens, never a different design. RTL foundations are built in: primitives and shell use logical properties (`start`/`end`, `ps`/`pe`, `border-s`) so nothing needs layout rework when Arabic strings land. Named unspent headroom, deliberately not yet used: glass-lens / brushed-bezel materials and display lettering beyond 19px.

**Key Characteristics:**
- Matte night panel with fine machined grain; instrument faces raised by an inset edge-light, not by decoration.
- Phosphor radio-green (#39ff9a) means engaged/ok; amber and red are reserved for real caution/alert conditions.
- B612 (an Airbus cockpit typeface) everywhere; B612 Mono tabular numerals for every reading.
- One component vocabulary across all 27 modules: face, placard, readout, lamp.

## Colors

Two synchronized themes over one token set; components consume token utilities only, never raw values.

### Primary
- **Phosphor Green** (`--phos` #39ff9a night / #0b7a4b day): engaged state, primary actions, ok lamps, focus rings, active nav needle, gauge fills in the healthy band. Text on a phosphor fill uses `--phos-ink` (#06180e night / #ffffff day). `--phos-bright` is the hover state of a lit control.

### Secondary
- **Advisory Cyan** (`--advisory` #55c8f0 night / #0c7aa6 day): informational status — new/scheduled/refunded lamps. Never used for actions.

### Tertiary
- **Caution Amber** (`--caution` #ffb000 night / #96690a day) and **Alert Red** (`--alert` #ff5148 night / #c23934 day): breach colors. `--caution-fill` exists because day amber text is too dark for gauge fills.

### Neutral
- **Panel** (#0b0d0f): the app canvas, carrying the grain layer.
- **Face** (#111417): instrument faces — cards, tables, sidebar. **Raised** (#16191e): popovers, dialogs, drawers. **Well** (#0d1013): sunken insets — inputs, table heads, skeletons.
- **Bezel** (#22272e) / **Bezel-Strong** (#303740): hairline borders; strong marks interactive edges (inputs, scrollbar thumbs).
- **Ink** (#f2f5f2) primary markings; **Dim** (#a4adb6) secondary; **Faint** (#7d8894) tertiary/placeholder — tuned to hold ≥4.5:1 on face in both themes.
- Chart series `chart-1..5` are defined once on `:root` and deliberately not re-mapped at night (day-legible mid-tones read on both grounds).

### Named Rules
**The Reserved-Fire Rule.** Amber and red never decorate. They appear only when a real condition breaches (overdue, expired, no-show, alert threshold). A screen with nothing wrong shows no amber or red.
**The Token-Only Rule.** New code uses token utilities (`bg-face`, `text-dim`, `border-bezel`, `text-phos`…) exclusively — no raw hex, no Tailwind palette classes (`slate-*`, `green-600`…). The legacy-compat remap at the bottom of `app/globals.css` exists only to pull unmigrated screens into the world; it is transitional, shrinks as modules migrate, and must never be relied on by new work.
**The Lamp Semantics Rule.** All status maps to exactly five meanings: **ok** (running normally, green), **caution** (needs attention, amber), **alert** (breach, red), **advisory** (informational, cyan), **off** (inert/closed, dim neutral).

## Typography

**Display/Body Font:** B612 (Readex Pro, system fallback) — designed by Airbus for cockpit displays, the literal lineage of this interface. Readex Pro carries Arabic.
**Readout/Mono Font:** B612 Mono (ui-monospace fallback).

**Character:** Engraved and instrumental. Lettering is small, bold, and tracked-out caps; values are large luminous numerals. Nothing is oversized for drama — 19px is the current display ceiling (headroom above it is named but unspent).

### Hierarchy
- **Display / panel lettering** (700, 19px, uppercase, 0.05em): page titles in PageHeader only.
- **Readout** (700, 26px/32px, B612 Mono, tabular): the instrument value. Smaller readouts (12–15px) use the same `readout` utility.
- **Title** (700, 14px): card titles, dialog titles.
- **Body** (400, 14px): default text; 12px (`text-xs`) for secondary lines.
- **Placard** (700, 10.5px, uppercase, 0.14em, dim): the engraved micro-label under every instrument, table header cell, nav group, and form-adjacent caption (`placard` utility).
- **Lamp** (700, 10px, uppercase, 0.1em): annunciator text.

### Named Rules
**The Tabular Rule.** Every numeral is tabular (`table, [data-numeric] { font-variant-numeric: tabular-nums }`); money and counts render in B612 Mono via `readout`. Numbers align by construction, everywhere.
**The Placard Voice Rule.** Labels are engraved placards: short caps nouns ("TOTAL LEADS", "SIGNED IN AS"). A placard labels a value or group; it never introduces prose and is never used as a decorative kicker above a title. Buttons speak in caps imperative verbs ("ENABLE 2FA", "VERIFY & TURN ON").

## Layout

Fixed 248px sidebar (instrument-face surface, hairline end border); content column `max-w-[1680px]` centered with responsive padding 16→40px (`px-4 sm:px-6 md:px-8 2xl:px-10`). One sticky top stack: impersonation banner above a 56px header (`bg-panel/90 backdrop-blur`). Below `lg` the sidebar slides off-canvas (logical transform: `ltr:-translate-x-full rtl:translate-x-full`) behind a `bg-black/60` blurred backdrop.

Rhythm is the Tailwind 4px grid, in practice 8/12/16/20px: card padding 16px (20px ≥sm), section header 16×12px, grid and control gaps 8–12px. The dashboard six-pack is `InstrumentRow`: `grid-cols-2 md:grid-cols-3 xl:grid-cols-6`, gap 12px. Page identity is a `PageHeader` strip sitting directly on the panel (border-b, no card chrome).

**Print** is the one world-exception: `@media print` hides sidebar, header, grain, and `.no-print`; body flips to black-on-white paper; `.print-area` sheds borders and shadows; 12mm page margins. Vouchers, receipts, and journal prints are paper documents, not night panels.

## Elevation & Depth

Depth is material, not decorative. At night an instrument face is raised by a machined lip — `shadow-card` is an inset top edge-light (`inset 0 1px 0 rgba(242,245,242,0.05)`) plus a 1px black drop; by day it is a conventional soft 1–2px shadow. The panel ground itself carries a fixed fractal-noise grain layer (`body::before`, opacity 0.5, non-interactive, hidden in print) — the matte material of the world.

### Shadow Vocabulary
- **shadow-card**: every resting face. Never stacked, never tinted.
- **shadow-raise** (`0 16px 40px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.5)` night): overlays — dialogs, drawers, menus — and the hover state of a linked instrument.
- **shadow-glow** (`0 0 0 1px var(--phos), 0 0 12px var(--phos-glow)`): phosphor focus/engagement ring on buttons and focused controls.
- **Lamp bloom** (`0 0 8px var(--glow-*)`): the faint halo on every lit lamp.

### Named Rules
**The Edge-Light Rule.** Night depth comes from edge-light and darkness, never from colored or blurred decoration. **The Lit-vs-Printed Rule.** Anything luminous (lit lamp, solid button, focus ring) blooms; anything printed (text, borders) does not.

## Shapes

Three radii, by role: **3px** (`rounded-lamp`) for annunciator lamps and count badges — rectangular, like real annunciators; **6px** (`rounded-ctl`) for all controls (buttons, inputs, nav items, menu items); **10px** (`rounded-card`) for faces and overlays. Circles are reserved for gauges, avatars, and the empty-state icon well. Borders are always 1px hairlines (`bezel`, `bezel-strong`, or a 30–60% status tint); no thick strokes.

## Components

Motion vocabulary (used by the components below): `needle` 0.7s slight-overshoot settle for values; `power-on` 0.5s warm-up on first paint (0.25s for dialogs); `drawer-in` 0.25s end-slide; `sweep` 0.9s gauge fill; `spin`/`pulse` for system states. State transitions run at 150ms. `prefers-reduced-motion` collapses all animation to 0.01ms globally.

### Buttons — the ENGAGE grammar (`components/ui/button.tsx`)
- **Shape:** 6px radius; 12px bold caps, 0.08em tracking; heights 32/36/40px (sm/default/lg), square icon sizes.
- **primary** (default): outlined phosphor on transparent; lights up solid with glow on hover; the normal affirmative action.
- **solid**: pre-lit phosphor with glow at rest — **the one most-important action on a screen**. *The One Lit Button Rule:* at most one solid button per screen.
- **secondary** (STANDBY): outlined neutral, for cancel/alternate actions. **danger**: outlined alert, lights red on hover — destructive confirms only. **ghost**: bare dim, for icon actions and table rows. **link**: phosphor text, normal-case.
- All press states dip 1px (`active:translate-y-px`); focus shows `shadow-glow`.

### Lamp / StatusBadge — the status vocabulary
- **Lamp** (`ui/lamp.tsx`): rectangular 3px-radius caps annunciator; variants ok/caution/alert/advisory/off; lit variants get a 30%-tint border, translucent fill, and bloom; `pulse` for actively-demanding states. Replaces every pastel pill.
- **StatusBadge** (`shared/StatusBadge.tsx`): the single map from every business status string (lead stages, payments, compliance…) to a lamp variant + label. **When to use:** any domain status renders through StatusBadge so semantics stay centralized; use a raw Lamp only for ad-hoc system states not in the map (e.g. "2FA ARMED"). Never restyle a status locally.

### Instruments — the reading vocabulary
- **Instrument** (`ui/instrument.tsx`): the six-pack stat — 26px mono readout (tone: ink/phos/caution/alert/advisory), optional corner lamp/icon, hairline divider, placard label beneath. Linkable (hover raises). `InstrumentRow` grids a ranked row. **KPICard** is a legacy-API wrapper over Instrument; new code uses Instrument directly.
- **TickGauge** (`ui/tick-gauge.tsx`): linear gauge, 8px track in a well, engraved ticks every 10%, sweep-in fill. Honest zero — 0% renders as 0, never a cosmetic minimum. Threshold props flip fill to caution/alert. `role="progressbar"`.
- **Dial** (`ui/dial.tsx`): circular 270° gauge (225°→-45°) with bezel, ticks, needle, and mono reading; `role="meter"`.
- **When to use:** Instrument for any headline stat (count, money); TickGauge for a ratio against capacity inline (hours used, collection %); Dial only for a single hero 0–100 reading that deserves a real gauge. Never a Dial in a six-pack row.

### Cards / Tables
- **Card** (`ui/card.tsx`) = instrument face: `bg-face`, 1px bezel, 10px radius, shadow-card; header/footer separated by hairlines; the `face` utility applies the same surface to anything.
- **Table** (`ui/table.tsx`) = flight log: TableShell (face + x-scroll), sticky `bg-well` head, placard Th, hairline `bezel/60` rows, clickable rows hover to well. Numeric cells set `numeric` → right-aligned mono readout. Pagination is ghost icon buttons with a mono "page / pages" readout; 50 rows/page default.

### Inputs (`ui/input.tsx`)
- **Style:** sunken well (`bg-well`), 1px bezel-strong, 6px radius, 36px height; placeholder in faint.
- **Focus:** phosphor — border-phos + 2px `ring-phos/25`. **Field** wraps label (12px bold dim, alert-red required star), control, and inline `role="alert"` error in alert red or faint help text. SearchInput carries a leading faint icon (logical `start-3`).

### Overlays (`ui/dialog.tsx`)
- Dialog centers a `bg-raised` card (shadow-raise, power-on 0.25s); Drawer slides from the logical end as a full-height form panel. Both portal, trap focus, close on ESC, restore focus, `aria-modal`. `guarded` (drawer default) makes the backdrop click inert so unsaved forms survive stray clicks. ConfirmDialog replaces `window.confirm` for destructive flows (secondary Cancel + danger confirm).

### Feedback (`ui/feedback.tsx`) & EmptyState
- Spinner (phosphor-tipped ring), PanelLoading (spinner + placard caption), Skeleton/SkeletonRows (pulsing wells), LoadError — an honest lamp-alert surface with retry, never a silent empty. EmptyState is a dim instrument: bezel-ringed icon well, title, one-line description, one action.

### Navigation (`layout/Sidebar.tsx`, `layout/Header.tsx`)
- Sidebar groups under placard labels; items are 13px semibold, dim → well/ink on hover; the active item lights `lamp-ok-bg` + phosphor text with a 2×16px phosphor needle tick on the start edge; counts ride as small caution lamps. Identity plate on top (gauge-true SVG mark: ticked bezel + phosphor needle); crew plate (avatar ring, name, role placard) pinned at bottom. Header holds search, theme toggle, notifications, and an account menu on raised.

## Do's and Don'ts

### Do:
- **Do** consume tokens only: surfaces from panel/face/raised/well, text from ink/dim/faint, borders from bezel — theme correctness in both worlds falls out automatically.
- **Do** route every domain status through StatusBadge, and any new status through its map first.
- **Do** keep the accessibility floor: 2px phosphor `:focus-visible` outline on everything, faint-on-face ≥4.5:1, roles on gauges/dialogs/errors as built, text labels inside every lamp (color never carries meaning alone), reduced-motion respected.
- **Do** use logical properties (`start/end`, `ps/pe`, `ms/me`, `border-s/e`) for anything horizontal — the Arabic/RTL pass must need no layout rework.
- **Do** keep printables paper: black-on-white, chrome-free, inside `.print-area`.

### Don't:
- **Don't** use raw palette classes or hex in components — and don't lean on the legacy-compat remap; it is scaffolding scheduled for deletion.
- **Don't** ship pastel status pills, tinted icon cards, or more than one solid (pre-lit) button per screen.
- **Don't** use gradients as decoration. The only gradient in the world is the TickGauge's functional tick pattern; backgrounds, buttons, and headers stay flat.
- **Don't** add kickers or decorative eyebrow text above titles; placards label instruments, nothing else.
- **Don't** light amber/red without a breached condition, and don't invent status colors beyond the five lamp meanings.
