# Night Six-Pack — Module Migration Contract

You are re-skinning one module of the Nitaq CRM into the committed visual world:
a **night flight-deck instrument panel**. The core system is already built and
committed. Your job: rewrite your module's pages to the token vocabulary and
primitives below, improving UX **without changing any business behavior**.

## The world in one paragraph

Matte panel ground, instrument-face cards, luminous markings, radio-green
(`phos`) for primary/engaged, amber (`caution`) and red (`alert`) reserved for
real trouble, cyan (`advisory`) for informational. Numbers read like gauges:
mono, tabular. Micro-labels are engraved placards: caps, wide tracking. Status
is an annunciator lamp, never a pastel pill. Both themes (night default, day
variant) come free **if you use only tokens** — never raw palette classes.

## Tokens (Tailwind utilities — the ONLY colors you may use)

- Surfaces: `bg-panel` (page ground — usually inherited), `bg-face` (card),
  `bg-raised` (popover/drawer), `bg-well` (inset: table heads, input wells, subtle fills)
- Lines: `border-bezel`, `border-bezel-strong`
- Text: `text-ink` (primary), `text-dim` (secondary), `text-faint` (tertiary/placeholder)
- Accent: `text-phos` / `bg-phos` + `text-phos-ink` (text on phos fill), `bg-phos-bright`
- Status: `text-caution`, `text-alert`, `text-advisory` (+ lamp backgrounds via the Lamp component)
- Charts/bars: inline `style={{ background: "var(--chart-1)" }}` … `--chart-5`
- Radii: `rounded-ctl` (controls, 6px), `rounded-card` (cards, 10px), `rounded-lamp` (3px)
- Shadows: `shadow-card`, `shadow-raise`, `shadow-glow`
- House utilities: `placard` (caps micro-label), `readout` (mono tabular numerals — put
  `data-numeric` on numeric cells), `face` (card shorthand: face+bezel+radius+shadow)

**BANNED in your output:** `slate-*`, `gray-*`, `zinc-*`, `blue-*`, `green-*`,
`amber-*`, `rose-*`, `red-*`, `teal-*`, `purple-*`, `orange-*`, `emerald-*`,
`bg-white`, `text-black`, every `#hex` arbitrary class (`bg-[#2E7D32]` etc.),
`dark:` variants (tokens flip themselves), `rounded-full` status pills, emoji
as UI glyphs, gradient backgrounds, kickers/eyebrows above headings.
Exception: `print`-only styles on printable vouchers stay black-on-white.

## Primitives (import and use — do NOT re-implement or edit these files)

```tsx
import { Button } from "@/components/ui/button";          // variant: primary|solid|secondary|danger|ghost|link · size: sm|default|lg|icon|iconSm
import { Lamp } from "@/components/ui/lamp";              // variant: ok|caution|alert|advisory|off — ALL status chips
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input, Textarea, Select, Label, Field, SearchInput } from "@/components/ui/input";
import { Dialog, Drawer, ConfirmDialog } from "@/components/ui/dialog";       // portaled, focus-trapped, ESC; Drawer guarded by default
import { TableShell, Table, THead, Th, Tr, Td, TableFooter, usePagination, Pagination } from "@/components/ui/table";
import { Instrument, InstrumentRow } from "@/components/ui/instrument";       // stat readouts
import { TickGauge } from "@/components/ui/tick-gauge";                       // progress with ticks; honest zero
import { Spinner, PanelLoading, Skeleton, SkeletonRows, LoadError } from "@/components/ui/feedback";
import PageHeader from "@/components/shared/PageHeader";  // title/subtitle/actions — use on EVERY page
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge"; // maps business statuses → lamps; extend its map only via variant prop if a status is missing
```

`Button variant="solid"` = the ONE most important action per screen. Everything
else `primary` (outlined phos), `secondary`, or `ghost`. Destructive = `danger`.

## Standard patterns

- **Page skeleton:** `<PageHeader title subtitle actions>` then filter bar, then content. No hand-rolled hero cards, no gradient banners, no greeting emoji.
- **Filter bar:** one row: `SearchInput` (DEBOUNCE 300ms if it triggers fetches) + `Select`s + existing `DateRangePicker`/`UrlDateFilter` (do not restyle those files — another agent owns them).
- **Tables:** `TableShell > Table > THead/Th (numeric right)` … `Td numeric` for money/counts (they render mono+tabular). Row click = open detail; ALSO keep an explicit affordance (chevron/ghost button) for keyboard users. Add `usePagination` + `<TableFooter><Pagination/></TableFooter>` when a list can exceed ~50 rows. Long text: `truncate` with `title` attr, or wrap — never force horizontal scroll for prose.
- **Forms:** wrap every control in `Field` (label/required/error/help). Surface API errors inline near the failed field when possible, else a `role="alert"` strip at top of the form. Keep exact field names/payloads.
- **Drawers/Modals:** replace hand-rolled `fixed inset-0` copies with `Drawer`/`Dialog`. Forms → `Drawer` (guarded: backdrop click does NOT discard). Confirmations → `ConfirmDialog` (replace every `window.confirm`/`alert`).
- **Status:** `<StatusBadge status={...}/>` or `<Lamp variant>` — never local color maps.
- **Money:** always `readout`/`Td numeric`; `AED 12,345` via existing fmt helpers.
- **Loading:** `SkeletonRows` inside `TableShell` or `PanelLoading`. **Empty:** `EmptyState` with a real next action. **Error:** `LoadError` with `onRetry` — NEVER render a fake empty state on fetch failure (`.catch(() => {})` must become an error state).
- **Bars/mini-charts:** `TickGauge` or a `bg-well` track + `var(--chart-N)` fill; width from real % with NO minimum floor.

## Behavior you must preserve exactly

Every fetch URL, method, payload, and query-param contract (`from/to`, `?new=`,
`?edit=`, `?correct=`, `?status=`); role checks and `SIDEBAR_VISIBILITY` gating;
WhatsApp deep links and their message templates (keep the exact template text);
CSV import/export flows and column headers; `window.print()` + print CSS on
vouchers/reports (printable areas stay paper-white via existing `@media print`);
optimistic updates; the journal "Correct" reverse-then-edit flow; localStorage
keys; the `logo-updated` CustomEvent; `EntryListPage` API. Default exports and
file paths stay. Keep `"use client"` where present.

## Copy rules

Title Case page titles; terse, specific labels. `/payments` page is titled
**Receipts** everywhere (it records student receipts); `/expenses` is titled
**Expenses**. Errors name the problem + the recovery. Never leak infra details
(no MONGODB_URI, no Atlas instructions, no "run the seed" copy — say
"contact your administrator"). No emoji.

## Definition of done for your module

1. Zero banned classes remain in your files (grep yourself).
2. Every list has loading, empty, error, and (if long) paginated states.
3. Keyboard: dialogs trap focus (via primitives), icon-only buttons have `aria-label`.
4. Run `npx tsc --noEmit` (from repo root) — fix type errors in YOUR files only.
5. Report: files touched, behaviors verified preserved, anything you could not migrate and why.
