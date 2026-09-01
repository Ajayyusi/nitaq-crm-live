# Nitaq CRM — UI Architecture Brief (Redesign Baseline)

**Stack:** Next.js 16 App Router + Tailwind v4 (CSS-first via `@import "tailwindcss"`; **tailwind.config.ts is a dead file** — no `@config` directive loads it). Almost everything is a `"use client"` page doing `useEffect + fetch + useState`; react-query is provisioned in Providers but bypassed everywhere. MongoDB queries live inline in the few server components (dashboard, reports, finance, login). next-auth, lucide-react, react-hot-toast (used only by Settings), recharts ^3.8.1 (finance page only), papaparse (import/export).

---

## 1. Shell & navigation model

- **Root layout** (`app/layout.tsx`): PWA meta, hardcoded `theme-color #2E7D32`, inline pre-hydration dark-mode script, Inter declared in an inline body style **but never loaded** (no next/font → system fallback renders). `suppressHydrationWarning` on both `html` and `body`.
- **Route group `(dashboard)`** wraps every app screen in `components/layout/DashboardShell.tsx`: `bg-[#E8F5E9]` canvas, fixed **260px** dark-green (`#1B5E20`) Sidebar (off-canvas below `lg`, black/50 blur backdrop), right column `lg:pl-[260px]`, ImpersonationBanner, sticky Header (`h-16`, white/95 backdrop-blur), `main max-w-[1680px]`.
- **Sidebar**: 5 nav groups — Workspace, Academy Ops, Business, Centre Management, System — ~27 items, filtered by `SIDEBAR_VISIBILITY[href]` vs session role. Logo = base64 fetched from `/api/settings` + a `window` CustomEvent (`logo-updated`) bus + raw `<img>` (flashes "NA" fallback). FollowUpBadge amber count pill fetches `/api/follow-ups` **once** — stale for the whole session. Footer: initials avatar, name, role, icon-only sign-out.
- **Header** (413 lines, 3 components in one file): mobile menu button, hardcoded "Nitaq Academy" brand text + "Sharjah" chip (NOT driven by the academy settings the app itself edits), GlobalSearch (⌘K palette), ThemeToggle, NotificationPanel (bell, polls 3 endpoints every 5 min, auto-requests browser Notification permission on load), avatar dropdown → inline **PasswordModal** and **TwoFactorModal** (QR setup flow).
- **Active-nav logic** = pathname prefix match → double-highlight ("Accounting" + "Receipts" both active on `/accounting/receipts`). Nav label "Payments" points to `/expenses` while NotificationPanel links `/payments?status=Overdue` — see terminology inversion in §5.
- **z-index ladder** is ad hoc magic numbers: 30 header/backdrop, 40 sidebar + dropdown click-catchers, 50 modals/drawers, `[60]` search, `[70]` impersonation banner. Banner and Header are **both** `sticky top-0` → header slides under the banner on scroll; header offset never accounts for banner height.
- **Login** (`/login`) is a separate universe: 100% inline style objects (no Tailwind), no dark mode, hover/focus via JS mutating `element.style`, its own palette (#5A7A5B, #D4E6D4, #F8FAF8), grid-pattern + glow-orb hero.
- **Theming**: class-dark via `@custom-variant dark`; ThemeProvider + localStorage `theme` + pre-hydration script (double-applied; toggle icon can flash wrong on dark reload); no `prefers-color-scheme`. Dark mode exists **two ways at once**: `dark:` utilities in newer components AND a global `!important` override sheet in globals.css remapping literal light classes (`.dark .bg-white`, `.dark input`, plus a `[class*="#0D1F0E"]` attribute-substring hack).

---

## 2. Incumbent design language (what's actually in use)

**Zero consumed tokens.** Only CSS vars are `--background`/`--foreground` — defined, never referenced. Everything below is hardcoded per call site.

### Color
| Role | Values |
|---|---|
| Brand greens | `#1B5E20` sidebar/login/hover-primary · `#2E7D32` primary/active/focus/theme-color · `#4CAF50` success · `#E8F5E9` app bg / tints / focus ring · `#0D1F0E` ink, drawer+modal headers, toast · `#4DB6AC` teal eyebrows |
| Dark palette | `#0a1a0b` bg · `#112013` surface · `#0c1a0d` inset · `#1e3520`/`#152716` borders · `#1a2e1b` hover · `#122B14` calendar popovers · text ramp `#e8f5e9→#4a6b4b` |
| Login-only | `#5A7A5B`, `#D4E6D4`, `#F8FAF8` (appear nowhere else) |
| Status | Tailwind amber/rose/green/blue/purple/teal 50–900 pastel pairs + Material leftovers `#EF5350 #FFEBEE #FFF3E0 #C62828 #E65100` + WhatsApp `#25D366` + off-brand `blue-600` (allocations, KPICard defaults) + 7 hardcoded PIE_COLORS |
| Alpha tricks | hex string concat `color+"14"/"18"/"30"` for tinted icon squares (dashboard) |

Three color dialects coexist: arbitrary-hex Tailwind classes, palette classes (**slate-\* and gray-\* mixed on the same screens** — accounting/voucher/compliance use gray, everything else slate), and inline style objects (login, dashboard KPI strips). Brand green doubles as success-green — semantic collision.

### Type
Inter declared twice (inline body style + globals.css), **never loaded**. Weights lean bold/extrabold. Sizes dominated by `text-[10px]/[11px]/xs/sm`; uppercase `tracking-widest` micro-labels are the house signature (nav groups, card kickers, modal eyebrows, search groups, table headers).

### Radii (no system)
`rounded-md` (dead Button) · `lg` (inputs, nav items, small buttons) · `xl` (cards, popovers, triggers) · `2xl` (dashboard cards, modals, EmptyState tile) · `full` (pills) · `10px` (toast inline style) · `16/24px` (login inline).

### Shadows
`shadow-sm` on cards → `shadow-2xl` on popovers/drawers, `shadow-xl` tooltips, login `0 20px 60px rgba(…)`. Nothing in between; dark mode globally rewrites `shadow-sm`.

### Layout / misc
Sidebar 260px duplicated (`w-[260px]` + `lg:pl-[260px]`); header `h-16`; content `max-w-[1680px]` (but reports self-caps at `max-w-5xl` **and** adds its own padding on top of the shell's = double gutter). Control heights drift h-8→h-11 + py-2/2.5. Currency `AED` via `toLocaleString("en-AE")`, re-implemented as `fmt()` in 5+ files; dates raw ISO strings in many tables, `en-AE`/`en-GB` locales mixed.

---

## 3. Component inventory

### components/ui — 3 DEAD shadcn primitives (zero imports anywhere)
`button.tsx`, `badge.tsx`, `card.tsx` — cva variants on semantic tokens (`bg-primary`, `bg-card`, `ring-ring`, `text-muted-foreground`) that **do not compile**: globals.css has no `@theme`, components.json promises `cssVariables` never wired, and the dead tailwind.config primary is BLUE. `cn()`/cva referenced only by these dead files.

### components/shared — 10 real components, inconsistently adopted
| Component | Used by | Ignored by |
|---|---|---|
| DatePicker / DateRangePicker / UrlDateFilter | leads, follow-ups, enrollments, classes, teachers, finance, accounting, payments, staff-compliance | students, my-students search |
| PageHeader | activity, students, classes, allocations, requests, payments, expenses, collections, payouts, import-export | dashboard, reports, settings, courses, teachers, leads (all hand-roll headers) |
| EmptyState | students, classes, allocations, payments, expenses | every other page (ad-hoc dashed boxes) |
| StatusBadge (~17 statuses) | allocations only | leads, enrollments, students, courses, teachers, finance, compliance (8+ local pill maps) |
| KPICard | **nobody** | dashboard + reports + finance roll 3 competing stat-card designs |
| HoursProgress, ClassHistoryDrawer | students, my-students | — |
| BackButton | 9 of 13 accounting pages | EntryListPage + voucher hand-roll back links |

### Other shared layers
`components/accounting/shared.tsx` (fmtAED, fmtNum, usePostingAccounts, **AccountSelect** combobox, exportCsv, jvStatusBadge) + `EntryListPage.tsx` (shared Receipts/Invoices screen). `components/finance/FinanceCharts.tsx` — the only recharts in the repo. Layout: DashboardShell, Sidebar, Header (+2 inline modals), GlobalSearch, NotificationPanel, ImpersonationBanner, ThemeProvider/Toggle. `lib/utils` (cn, formatCurrency, formatDate, Role, getInitials, slugify), `lib/whatsapp`, `lib/dateRange`, `lib/permissions`, `constants/leads` (hardcoded 9-course list — parallel source of truth vs `/api/courses`), `constants/modelConstants`.

### Missing primitives (every page hand-rolls these)
Table, Input, Select, Textarea, Label, Dialog, Drawer, Dropdown, Tabs, Tooltip, Toast (beyond settings), Skeleton, Pagination, Combobox, Switch, Confirm dialog. Inputs styled by per-file `inp`/`cls` string constants + **injected global `<style>` tags** defining five different label/input classes (`.lblx`, `.label-x`, `.lbl`, `.input-field`, `.input-f` — one has invalid CSS `ring:2px solid`). Two spinner idioms (Loader2 vs hand-rolled border div).

---

## 4. The 10 most repeated UI patterns

1. **Table**: white `rounded-xl` card → `overflow-x-auto` → `min-w-[560–800px]` table; thead `bg-slate-50` (gray-50 in accounting) uppercase-xs-bold; `divide-y` rows, hover tint; row background tint encodes urgency (rose/amber /30–60); whole-row click = edit + trash icon w/ stopPropagation; footer count strip. **No pagination, sorting, or virtualization anywhere in the app.**
2. **Right slide-over drawer** (hand-rolled 8+ times): `fixed inset-0 z-50` + `bg-black/40` backdrop (click = silently discard form), aside `max-w-md/lg/580px/2xl`, dark `#0D1F0E` header + uppercase teal/amber kicker + X, scrollable 2-col grid body, footer Cancel + green submit w/ Loader2. Details drift per copy (width, footer order, blur, scroll model). No focus trap / ESC / `role=dialog` (Leads alone adds ESC).
3. **Filter bar**: two competing idioms — white card with DateRangePicker + icon-search input + native `<select>`s, vs pill-chip rows (solid-green active). Refetch on every filter change; search mostly undebounced.
4. **Status pill**: `rounded-full px-2 py-0.5 text-xs` pastel `bg-{c}-100/text-{c}-700` from per-file `Record<string,string>` maps — duplicated in 8+ files with contradictions (Active = green in enrollments, blue in my-students; Missing = red vs gray).
5. **KPI/stat card**: tinted icon square + 10-11px uppercase label + extrabold `tabular-nums` value; three competing designs (dashboard link-cards with 3px colored top strip + hex-alpha concat; reports local StatCard; collections/payouts icon-over-value) while shared KPICard sits unused.
6. **Centered modal**: `z-50 black/40 backdrop-blur` + `max-w-sm/md rounded-2xl` card with `#0D1F0E` header band + teal eyebrow (Password, 2FA, bulk follow-up, request review). Not portaled, no a11y, chrome duplicated verbatim.
7. **Form field**: bold xs/sm label + input from copy-pasted `inp` const (`rounded-lg/xl border-slate-200 focus:ring-[#2E7D32]`/`#E8F5E9`); required = literal `*` in label; validation = one server-error banner at drawer top; zero per-field errors anywhere.
8. **Inline notice/error banner**: dismissible green/rose/amber in-flow cards above content — manual X, never auto-dismiss, layout shift. Success feedback = same banners or `setTimeout`-cleared strings; toasts only in Settings; `window.confirm()`/`alert()` for all destructive/error flows.
9. **Homemade bar "chart"**: label + `h-2` slate-100 track + inline-width fill with `Math.max(4, pct)` floor (dashboard, reports, finance, compliance) — no axes, tooltips, or aria; small values visually lie.
10. **Expandable row / accordion**: single `expandedId` state + chevron; the entire row header is one `<button>` whose expanded panel contains further links/buttons (JVs, receipts, suppliers, course batches, class sessions, staff docs) — nested-interactive, muddy for screen readers.

Also endemic: WhatsApp deep links (`buildWhatsAppUrl` + 5 hardcoded emoji templates), hand-built Blob CSV export, three page-header systems (hero card w/ kicker vs PageHeader vs eyebrow+h1), uppercase-kicker section labels, emoji as UI glyphs (⚠ ✅ ❌ 📊 👋) alongside lucide.

---

## 5. Cross-cutting defects ranked by user impact

1. **Silent error swallowing** — `.catch(() => {})` throughout; network/API failure renders as fake empty states ("All caught up!", "No activity yet", "Record your first payment") or eternal spinners. Zero error boundaries, no retry affordance anywhere. Payments/expenses list errors render only *inside the closed drawer*.
2. **Dark mode split-brain** — global `!important` override sheet + partial `dark:` classes; Settings, dashboard, reports, login, most drawers/modals/pickers are light-only. Toggling theme visibly breaks half the surface.
3. **No loading architecture** — no `loading.tsx`/`error.tsx` in the whole `(dashboard)` group; dashboard and reports block first paint on 10–18 inline Mongo aggregations; loading idioms vary per page (spinner / skeleton rows / full-page replace / nothing).
4. **Accessibility debt** — no focus trap or dialog semantics on any drawer/modal/popover; icon-only buttons without aria-labels; hover-only-revealed controls (COA rows) keyboard/touch-unreachable; clickable table rows not keyboard-accessible; color-only status encoding; `text-[10px]` metadata; no aria-live on counts/banners; AccountSelect and GlobalSearch lack combobox/listbox semantics; hand-rolled VAT switch has no role/keyboard support; DatePicker clear-X is a `span[role=button]` nested inside a button.
5. **UI that lies about data** — pipeline counts and revenue "totals" computed from the currently filtered client-side fetch; 4% bar-width floor; "Certificate Due" KPI counts within only the last 6 fetched enrollments; finance screen mixes accrual KPI with cash-basis chart (numbers can't reconcile); collections "Sent" chase state is an in-memory Set lost on reload.
6. **Terminology inversion** — `/payments` is titled "Receipts", `/expenses` is titled "Payments"; nav, URLs, buttons, and notification links contradict each other.
7. **No pagination/virtualization** — every list fetches and renders full collections; register downloads the entire GL dump and client-filters, rendering only the first 1000 rows with a note buried in the TOTAL row.
8. **Destructive-flow hazards** — `window.confirm` for irreversible financial deletions; journal "Correct" **reverses the posted entry before** the corrected copy is saved (closing the drawer strands a reversed entry); backdrop click discards unsaved forms with no guard.
9. **Duplication drift** — 8+ badge maps, 5+ `fmt()` clones, 3 stat-card designs, calendar internals copy-pasted between the two pickers, per-file input consts, three drawer implementations in finance alone. A redesign must touch hundreds of call sites.
10. **Info leaks in user-facing copy** — login db_error tells users to open MongoDB Atlas Network Access and add 0.0.0.0/0; dashboard error says "Check your MONGODB_URI"; Settings SuperAdminButton renders a generated **plaintext password** on screen; empty chart says "Run the seed".
11. **Dead surfaces shipped in prod nav** — `/users` stub, `/allocations` (501 API + not-implemented banner), parked placeholders at `leads/new`, `leads/[id]`, `enrollments/new`, `courses/[id]`, `teachers/[id]`, `teachers/new`, `allocations/new`; broken link "Add Profile" → `/learner-profiles/new` **404s**.
12. **Generic-AI-dashboard identity** — gradient hero + "Good morning 👋", tinted icon squares, rainbow quick-action tiles, uppercase-tracking micro-labels, sparkle empty states, kbd ⌘K pill, default-styled recharts — no distinct brand voice.

---

## 6. Screens by module (route — one-liner)

**Shell / Auth**
- `/login` — inline-styled credentials + progressive TOTP step; own palette, no dark mode
- `/access-denied` — centered rose ShieldOff card
- `/impersonate` — one-shot trainer token redeem, auto-redirect; error card has no action

**Workspace**
- `/dashboard` — role-aware server home: gradient hero, 5–11 KPI link-cards, pipeline funnel+bars (same data twice), follow-ups, sales table, enrollments, quick actions
- `/activity` — client audit feed (limit 150), entity chips + user select, no pagination
- `/reports` — all-in-one server analytics (~18 aggregations), div bar-charts, CSV + `window.print`
- `/follow-ups` — daily task list, overdue/today cards, add/edit drawer with lead autocomplete, WA note prefill

**Admissions**
- `/leads` — 1926-line monolith: 9-stage count strip, table, detail panel + 2 drawers + 2 modals, WA templates, CSV import/export, bulk assign
- `/enrollment-requests` — sales→admin approval queue with review modal, convert-to-enrollment via query-param prefill

**Academy Ops**
- `/students` — roster from enrollments; inline pill-styled status `<select>`, certificate banner, ClassHistoryDrawer
- `/enrollments` — full CRUD + payment fields + registration-completion checklist; receives `?new=` lead-conversion redirect
- `/my-students` — teacher self-view: 6 stat tiles, roster, record-class drawer
- `/courses` — catalog CRUD, expandable batch cards (no batch CRUD exists), teacher toggle-chip assignment
- `/classes` — session recording + attendance grid (the only scheduling UI; course list from hardcoded constant)
- `/teachers` — trainer CRUD, Tamam/contract compliance alerts, WA, admin impersonation
- `/allocations` — non-functional stub (API 501), blue off-brand CTA

**Business / Finance**
- `/finance` — overview dashboard; the only recharts (bar + pie), outstanding/overdue lists
- `/payments` — student receipts CRUD (titled "Receipts")
- `/expenses` — expense CRUD w/ ledger posting (titled "Payments")
- `/collections` — chase list, priority order, one-click WA reminder, CSV; client-only "Sent" memory
- `/teacher-payouts` — computed dues, Mark Paid → posts ledger + locks sessions; history w/ voucher links (headerless table)

**Accounting** (13 pages)
- `/accounting` — KPI hub + 11 module tiles; seed/backfill banners
- `/accounting/coa` — recursive COA tree, inline add/edit drawer, hover-only row actions
- `/accounting/journal` — JV list + 4-mode editor drawer + CSV import; destructive Correct flow
- `/accounting/ledger` — per-account GL w/ running balance
- `/accounting/trial-balance` — 7-col report + balanced/imbalanced status
- `/accounting/receivables` — per-student AR + migration banner
- `/accounting/receipts`, `/invoices` — thin wrappers over shared EntryListPage
- `/accounting/register` — every GL line; client-side filter of full dump, first-1000 render
- `/accounting/suppliers` — AP: aging buckets, bills, payments, statements
- `/accounting/vat` — UAE VAT in/out report
- `/accounting/settings` — VAT config, lock date, 16 account mappings
- `/accounting/voucher/[id]` — voucher detail + browser-print (gray-* palette, has dark mode, unlike siblings)

**Centre Management (Compliance)**
- `/compliance` — health-score banner, KPI cards, risk bars, high-risk list
- `/learner-profiles` (+ `/[id]`) — learner records list; detail w/ doc checklist, risk form, comms log ("Add Profile" link 404s)
- `/qualifications` (+ `/[id]`) — qualification card grid + drawer; detail w/ unit manager
- `/assessments` — read-only unit tracker, orphan workflow (no create path anywhere)
- `/iqa` — sampling log with one-row-at-a-time inline editing
- `/staff-compliance` — staff doc accordion (fixed 10 doc types) + add-staff drawer

**System**
- `/settings` — 919-line monolith: academy info, finance defaults, staff CRUD (inline accordions), seed data, logo upload, maintenance (super-admin reset, backfill), system info
- `/users` — dead stub (real user management is inside Settings)
- `/import-export` — CSV import (3-step, papaparse) / export tile grid for 9 entities, role-filtered

---

## 7. Risks: where a redesign can break behavior

- **Print vouchers & reports** — printing relies entirely on global `@media print` rules that hide `aside`/`header`/`.no-print` with `!important` and strip main padding; `window.print()` is invoked from the voucher page and reports ExportButtons. New chrome (portals, wrappers, renamed elements) silently breaks print output. Unused `.print-area` hook exists in globals.css.
- **Dark-mode override sheet** — deleting or renaming the `.dark .bg-white`-style overrides (or the `[class*="#0D1F0E"]` substring selector) strips dark mode from every component lacking `dark:` classes. Replace with a token layer *before* removal; renaming hex-bearing class strings changes dark rendering as a side effect.
- **Impersonation** — three coupled pieces: sticky amber banner (`z-[70]`, `/api/impersonate/exit`), admin "Open as trainer" action in Teachers, `/impersonate` token redeem. Stacking/sticky changes can bury the only exit control.
- **Journal "Correct" flow** — reverses the posted entry, then reopens a prefilled drawer. Any change to drawer lifecycle (auto-close, route transition, unmount-on-navigate) can strand reversed entries with no correction saved.
- **CSV contracts** — leads import, import-export templates (papaparse; validation math reports "Row N+2"), accounting journal CSV import, and hand-built Blob exports that honor active filters. Column headers and entity keys are load-bearing; template downloads must stay in sync.
- **URL-param contracts** — `from`/`to` (UrlDateFilter sets *both* to distinguish explicit all-time), `?new=<id>` enrollment redirect (rewrites history, reads `window.location` in an effect), `?edit=`/`?correct=` deep links into the journal drawer, `/payments?status=Overdue` from notifications, register's `group/sourceType/account` params, and requests→enrollments prefill via `name/phone/course` query params (PII in URL, but currently functional).
- **Window CustomEvent bus** — Settings logo upload notifies Sidebar via `logo-updated`; removing either end breaks live logo refresh.
- **localStorage keys** — `theme` (read by both the pre-hydration script and ThemeProvider — keep them consistent) and the notification mute flag (which currently also stops data polling).
- **WhatsApp deep links** — `buildWhatsAppUrl` + 5 hardcoded emoji template messages in LeadsClient JSX + follow-up note prefill + collections reminder copy. This copy lives inline and will be lost in a rewrite unless extracted first.
- **Teacher payout "Mark Paid"** — posts to the ledger AND locks sessions; adjusting the drawer/summary flow touches financial state, not just UI.
- **Role gating** — `SIDEBAR_VISIBILITY`, per-page role lists, `isReadOnlyRole`, and the legacy `staff→sales` remap duplicated inline in import-export; nav restructure must preserve all of it.
- **Optimistic/inline mutations** — students StatusCell PATCH (silent failure leaves wrong visual state), notification mark-read without rollback, IQA one-row editing. Redesigned controls must keep or fix these semantics deliberately.
- **Classes drawer coupling** — course `<select>` auto-loads active enrollees and is fed by the hardcoded `constants/leads` courseList (not `/api/courses`); attendance bulk buttons mutate the whole grid.
- **Injected `<style>` tags** — five global label/input classes defined inside components; removing one component can unstyle another that leaned on the leaked class.
- **`suppressHydrationWarning` on html+body** — currently masking hydration mismatches; a redesign may introduce new ones invisibly. Consider removing during the rebuild to surface them.
- **No kanban exists** — the leads "pipeline" is a clickable count-strip filter, not drag-and-drop; do not assume drag behavior needs preserving, but stage-click filtering does.
- **Dead-but-referenced scaffolding** — components.json + tailwind.config.ts + components/ui look like a design system but are inert (and the config's primary is blue). Either wire a real Tailwind v4 `@theme` token layer or delete them; leaving them half-alive will mislead future work.
