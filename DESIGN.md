---
name: Nitaq Academy CRM
description: Soft Panel — a production CRM whose surfaces are extruded from one neutral ground by a two-source light model.
colors:
  # Light panel (the default theme). Dark values live under `.dark` in app/globals.css.
  panel: "#eef1f5"
  face: "#f3f6fa"
  raised: "#f8fafc"
  well: "#e6eaf1"
  edge: "rgba(163,177,198,0.34)"
  edge-strong: "rgba(148,162,185,0.62)"
  ink: "#1b2430"
  dim: "#59657a"
  faint: "#5f6c82"
  accent: "#0a7050"
  accent-hover: "#0d8a61"
  accent-ink: "#ffffff"
  ok: "#0f7a52"
  warn: "#8a5d0c"
  danger: "#bf3a2f"
  info: "#17679f"
  chart-1: "#0a7050"
  chart-2: "#17679f"
  chart-3: "#b8801a"
  chart-4: "#6b5fc7"
  chart-5: "#bf3a2f"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, Readex Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    letterSpacing: "-0.02em"
  readout:
    fontFamily: "Plus Jakarta Sans, Readex Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: "36px"
    letterSpacing: "-0.015em"
    fontVariantNumeric: "tabular-nums"
  body:
    fontFamily: "Plus Jakarta Sans, Readex Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  placard:
    fontFamily: "Plus Jakarta Sans, Readex Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 700
    letterSpacing: "0.09em"
  chip:
    fontFamily: "Plus Jakarta Sans, Readex Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  neo-xs: "7px"
  neo-sm: "10px"
  neo: "16px"
shadows:
  neo: "8px 8px 18px rgba(163,177,198,0.38), -8px -8px 18px rgba(255,255,255,0.90)"
  neo-sm: "4px 4px 10px rgba(163,177,198,0.30), -4px -4px 10px rgba(255,255,255,0.80)"
  neo-xs: "2px 2px 5px rgba(163,177,198,0.26), -2px -2px 5px rgba(255,255,255,0.75)"
  neo-inset: "inset 4px 4px 8px rgba(163,177,198,0.30), inset -4px -4px 8px rgba(255,255,255,0.80)"
  neo-inset-sm: "inset 2px 2px 4px rgba(163,177,198,0.24), inset -2px -2px 4px rgba(255,255,255,0.70)"
  neo-pop: "20px 20px 48px rgba(140,155,180,0.42), -12px -12px 32px rgba(255,255,255,0.92)"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  page: "32px"
motion:
  transition: "200ms cubic-bezier(0.4, 0, 0.2, 1)"
  transition-fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.neo-sm}"
    height: "40px"
    padding: "0 20px"
    shadow: "{shadows.neo-xs}"
    activeShadow: "{shadows.neo-inset-sm}"
  button-secondary:
    backgroundColor: "{colors.face}"
    textColor: "{colors.ink}"
    rounded: "{rounded.neo-sm}"
    height: "40px"
    shadow: "{shadows.neo-xs}"
    activeShadow: "{shadows.neo-inset-sm}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.neo-sm}"
    height: "40px"
  card:
    backgroundColor: "{colors.face}"
    rounded: "{rounded.neo}"
    shadow: "{shadows.neo-sm}"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.neo-sm}"
    height: "40px"
    shadow: "{shadows.neo-inset-sm}"
    border: "1px solid {colors.edge-strong}"
  modal:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.neo}"
    shadow: "{shadows.neo-pop}"
---

# Design System: Nitaq Academy CRM

## Overview

**Creative north star: "Soft Panel."**

Surfaces are extruded from one soft neutral ground rather than drawn on top of
it. There is a single implied light source at the top-left, so every raised
object casts a cool shadow to its bottom-right and catches a white highlight on
its top-left. Recessed objects invert both. That is the whole language.

This is *subtle* neomorphism, tuned for a CRM people use all day rather than
for a dribbble shot. The four rules that keep it professional:

1. **Readability outranks the effect.** Text, inputs and status colour hold
   WCAG AA contrast. Nothing legible is traded for a shadow.
2. **Depth is semantic.** Raised = a container, or something you can act on.
   Inset = something that receives input, or a state that is active/pressed.
   Depth is never applied for decoration.
3. **Shadow scales with surface size.** A 320px card and a 32px icon button do
   not share a shadow. Hence the `neo` / `neo-sm` / `neo-xs` ladder.
4. **Data stays flat.** Table rows, cells and list items are never individually
   extruded. The container is raised; its contents are calm. Extruding rows is
   precisely what makes soft UI unusable at data density.

Light is the default theme — the highlight half of the light model only exists
on a light ground. Dark is the explicit opt-in and keeps the same two-source
model with the highlight dropped to a few percent white. RTL foundations are
intact: primitives and shell use logical properties (`start`/`end`, `ps`/`pe`,
`border-s`), so nothing needs layout rework when Arabic strings land.

## Tokens

Everything lives in `app/globals.css`. Light values on `:root`, dark overrides
on `.dark`, both mapped into Tailwind utilities by `@theme inline`.
**No component writes a raw shadow, radius or hex.**

| Purpose | Token | Utility |
|---|---|---|
| Page ground | `--panel` | `bg-panel` |
| Card surface | `--face` | `bg-face` |
| Popover / modal | `--raised` | `bg-raised` |
| Recessed well | `--well` | `bg-well` |
| Hairline | `--edge`, `--edge-strong` | `border-edge`, `border-edge-strong` |
| Text | `--ink`, `--dim`, `--faint` | `text-ink`, `text-dim`, `text-faint` |
| Accent | `--accent`, `--accent-ink` | `text-accent`, `bg-accent`, `text-accent-ink` |
| Status | `--ok`, `--warn`, `--danger`, `--info` | `text-ok`, `text-warn`, `text-danger`, `text-info` |
| Raised depth | `--neo-shadow`, `-sm`, `-xs` | `shadow-neo`, `shadow-neo-sm`, `shadow-neo-xs` |
| Inset depth | `--neo-inset`, `-sm` | `shadow-neo-inset`, `shadow-neo-inset-sm` |
| Overlay depth | `--neo-pop` | `shadow-neo-pop` |
| Radius | `--neo-radius`, `-sm`, `-xs` | `rounded-neo`, `rounded-neo-sm`, `rounded-neo-xs` |

Legacy token names (`--face`, `--phos`, `--shadow-card`, `--radius-ctl`,
`border-bezel`, `text-alert`…) are retained as aliases so pages written against
the previous system keep rendering correctly. Prefer the new names in new work.

Helper classes: `.face` (standard card), `.neo-raised`, `.neo-raised-sm`,
`.neo-inset`, `.neo-pressable`, `.placard` (small caps label), `.readout`
(tabular figure), `.page-container`.

## Colors

Two synchronized themes over one token set. The interface is deliberately
neutral; colour is spent only on primary actions, active navigation, status and
charts.

Semantic colour is never greyed out by the neutral system — status is the one
place a CRM has to shout. Each status has a text colour that holds AA on any
surface and a soft fill for chips.

Accent has to clear AA **twice**: as white-on-accent inside a filled button,
and as accent-on-`--well` where it labels the active nav item. The second is
the tighter constraint and is what fixes the accent's darkness.

## Typography

Plus Jakarta Sans throughout, with Readex Pro carrying Arabic. Its tabular
figures let money columns align without a separate mono face, which is why
`.readout` is now a weight-and-tracking treatment rather than a font switch.

Hierarchy: page title 26px/800, card title 15px/700, KPI figure 28px/800,
body 14px/400 at 1.55 line-height, placard label 10.5px/700 caps at 0.09em,
status chip 10px/700 caps.

## Layout

One padding system: `px-4 py-5` on mobile, rising to `lg:px-8 lg:py-7`, capped
at 1680px and centred. Cards never touch the viewport edge. The sidebar is a
264px floating slab, inset 12px from the viewport on desktop so the ground
shows around it; content offsets by 288px to match.

Grids stay `items-stretch` so cards in a row share a height, and KPI tiles are
2-up on mobile, 3-up from `lg`.

## Elevation & depth

| Level | Shadow | Used by |
|---|---|---|
| 0 | none | page ground, table rows |
| 1 | `shadow-neo-xs` | buttons, chips, icon pads |
| 2 | `shadow-neo-sm` | cards, table shells, KPI tiles |
| 3 | `shadow-neo` | sidebar, hero mark, card hover |
| 4 | `shadow-neo-pop` | dialogs, drawers, command palette, menus |
| inset | `shadow-neo-inset-sm` | inputs, filters, active nav, skeletons |
| inset lg | `shadow-neo-inset` | large wells, empty-state icon disc |

## Components

- **Buttons** (`ui/button.tsx`) — `primary` (filled accent), `secondary`
  (raised neutral), `ghost`, `danger`, `link`, plus `IconButton`, which forces
  the accessible name a bare icon button cannot supply. Every pressable variant
  is raised at rest and recesses on `:active`.
- **Inputs** (`ui/input.tsx`) — recessed wells. They keep a hairline border on
  purpose: an inset shadow alone leaves the field boundary ambiguous, which is
  the classic neomorphism accessibility failure. Focus adds a solid accent ring.
- **Tables** (`ui/table.tsx`) — raised shell, flat rows, hairline separators,
  distinct inset header, hover tint. Sorting, pagination, sticky headers and
  responsive scroll are unchanged.
- **Dialogs / drawers** (`ui/dialog.tsx`) — the highest elevation, over a
  dimmed and blurred backdrop.
- **Status chips** (`ui/lamp.tsx`) — soft-tinted, slightly recessed. Colour
  carries meaning and the label repeats it in words, so status never depends on
  hue alone.
- **KPI cards** (`ui/instrument.tsx`) — label first so a row can be scanned by
  name, then the figure at display size, with an optional inset icon pad.
- **Navigation** (`layout/Sidebar.tsx`) — active item is recessed *and* carries
  an accent rail, so state never depends on reading a shadow.

## Accessibility

Neomorphism fails on contrast by default, so this system was measured rather
than assumed. Every text node on the dashboard and leads screens was checked
against its composited background in both themes; `--faint` and `--accent` were
darkened after the first pass returned three sub-4.5:1 cases.

- Focus is a solid 2px accent outline, offset clear of the shadow.
- Inputs keep a border; disabled states drop their shadow and lower opacity.
- Interactive affordance never rests on shadow alone — buttons carry fill or
  weight, active nav carries an accent rail, status carries a word.
- `prefers-reduced-motion` cancels entry animations outright rather than
  shortening them. Shortening was not enough: those animations use fill-mode
  `both`, and the backwards fill pinned drawers at their off-screen FROM frame.
