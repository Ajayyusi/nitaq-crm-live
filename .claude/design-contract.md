# Soft Panel — Module Migration Contract

You are re-skinning one module of the Nitaq CRM into the committed visual world:
a **soft neomorphic panel**. The core system is already built and committed.
Your job: rewrite your module's pages to the token vocabulary and primitives
below, improving UX **without changing any business behavior**.

## The world in one paragraph

One soft neutral ground. Surfaces are extruded from it by a single implied
light at the top-left: raised things cast a cool shadow bottom-right and catch
a white highlight top-left; recessed things invert both. Depth is semantic —
**raised** = a container or something you can act on, **inset** = something
that receives input or a state that is active/pressed. Data stays flat: the
table shell is raised, its rows are not. Colour is spent only on primary
actions, active navigation, status and charts. Both themes (light default,
dark opt-in) come free **if you use only tokens** — never raw palette classes.

## Tokens (Tailwind utilities — the ONLY colors you may use)

- Surfaces: `bg-panel` (page ground — usually inherited), `bg-face` (card),
  `bg-raised` (popover/modal), `bg-well` (inset: table heads, input wells, subtle fills)
- Lines: `border-edge`, `border-edge-strong` (aliases `border-bezel*` still resolve)
- Text: `text-ink` (primary), `text-dim` (secondary), `text-faint` (tertiary/placeholder)
- Accent: `text-accent` / `bg-accent` + `text-accent-ink` (text on accent fill), `bg-accent-hover`
- Status: `text-ok`, `text-warn`, `text-danger`, `text-info` (+ chip fills via the Lamp component)
- Charts/bars: inline `style={{ background: "var(--chart-1)" }}` … `--chart-5`
- Radii: `rounded-neo-xs` (chips, 7px), `rounded-neo-sm` (controls, 10px), `rounded-neo` (cards, 16px)
- Depth: `shadow-neo-xs` (buttons/chips) · `shadow-neo-sm` (cards/tables) ·
  `shadow-neo` (sidebar, hover) · `shadow-neo-pop` (dialogs) ·
  `shadow-neo-inset-sm` (inputs, active nav) · `shadow-neo-inset` (large wells)
- House utilities: `placard` (caps micro-label), `readout` (tabular figures — put
  `data-numeric` on numeric cells), `face` (card shorthand), `neo-raised`,
  `neo-inset`, `neo-pressable`

**Depth rules that are not negotiable:** shadow size scales with surface size
(never put a card's shadow on a chip); never extrude a table row, cell or list
item; never let a control's only affordance be its shadow — buttons carry fill
or weight, active nav carries an accent rail, status carries a word.

**BANNED in your output:** `slate-*`, `gray-*`, `zinc-*`, `blue-*`, `green-*`,
`amber-*`, `rose-*`, `red-*`, `teal-*`, `purple-*`, `orange-*`, `emerald-*`,
`bg-white`, `text-black`, every `#hex` arbitrary class (`bg-[#2E7D32]` etc.),
any hand-written `box-shadow`/`drop-shadow` (use the depth tokens),
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

`Button variant="primary"` (filled accent) = the ONE committing action per
screen; `solid` is a retained alias for it. Everything else `secondary` (raised
neutral) or `ghost`. Destructive = `danger`. Icon-only buttons use `IconButton`,
which forces the accessible name.

## Standard patterns

- **Page skeleton:** `<PageHeader title subtitle actions>` then filter bar, then content. No hand-rolled hero cards, no gradient banners, no greeting emoji.
- **Filter bar:** one row: `SearchInput` (DEBOUNCE 300ms if it triggers fetches) + `Select`s + existing `DateRangePicker`/`UrlDateFilter` (do not restyle those files — another agent owns them).
- **Tables:** `TableShell > Table > THead/Th (numeric right)` … `Td numeric` for money/counts (they render mono+tabular). Row click = open detail; ALSO keep an explicit affordance (chevron/ghost button) for keyboard users. Add `usePagination` + `<TableFooter><Pagination/></TableFooter>` when a list can exceed ~50 rows. Long text: `truncate` with `title` attr, or wrap — never force horizontal scroll for prose.
- **Forms:** wrap every control in `Field` (label/required/error/help). Surface API errors inline near the failed field when possible, else a `role="alert"` strip at top of the form. Keep exact field names/payloads.
- **Drawers/Modals:** replace hand-rolled `fixed inset-0` copies with `Drawer`/`Dialog`. Forms → `Drawer` (guarded: backdrop click does NOT discard). Confirmations → `ConfirmDialog` (replace every `window.confirm`/`alert`).
- **Status:** `<StatusBadge status={...}/>` or `<Lamp variant>` — never local color maps.
- **Money:** always `readout`/`Td numeric`; format with `formatAED()` from `@/lib/utils` — two decimals is the house rule, `{ decimals: 0 }` only for chart axes. Never write a local formatter.
- **CSV:** `csvEscape` / `toCsv` / `downloadCsv` from `@/lib/utils`. Never write a local escaper — the four that existed all mishandled a bare carriage return.
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
