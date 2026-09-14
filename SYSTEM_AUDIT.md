# Nitaq CRM — System Audit

> Full end-to-end audit and debugging pass, 2026-09-14.
> Branch `audit/full-system-debug`, based on `cleanup/step-2-dead-code` @ `b2962a9`. Nothing is committed yet.

| Document | What it holds |
|---|---|
| **SYSTEM_AUDIT.md** (this file) | Health scores, issue register with status, every fix and its test, deploy procedure, remaining work |
| [SCHEMA_MAP.md](SCHEMA_MAP.md) | All 29 models: fields, references, indexes, money/date fields, invariants, relationship diagrams |
| [PIPELINE_MAP.md](PIPELINE_MAP.md) | UI → API → DB → ledger → UI traces for the lead, class and compliance workflows |
| [SECURITY_AUDIT.md](SECURITY_AUDIT.md) | Authentication, RBAC matrix, impersonation, audit logging, injection, dependencies |
| [MULTITENANCY_READINESS.md](MULTITENANCY_READINESS.md) | What selling to a second academy requires, and a phased migration path |
| [docs/audit/ACCOUNTING_AUDIT.md](docs/audit/ACCOUNTING_AUDIT.md) | Posting-rules table, metric-consistency table, data-repair queries |
| [docs/audit/PAYROLL_AUDIT.md](docs/audit/PAYROLL_AUDIT.md) | 31 trainer-pay scenarios, current vs correct behaviour |
| [docs/audit/RELIABILITY_AUDIT.md](docs/audit/RELIABILITY_AUDIT.md) | Error handling, dates/timezone, concurrency, frontend data flow, static analysis |
| [docs/audit/API_INVENTORY.md](docs/audit/API_INVENTORY.md) | All 125 method+path handlers: roles, validation, reads/writes, side effects, caller |

The detailed reports reference code as it was at `b2962a9`; **this register is the authoritative status.**

---

## 1. How the audit was done

- **Baseline first:** `npm test` 88/88 passing, `eslint` clean, `tsc` clean, `next build` succeeding. Nothing failed — every problem below was found by reading and tracing code, then reproduced.
- **Seven parallel read-only investigations** (schema, API/RBAC/security, accounting engine, payroll, CRM & compliance pipelines, cross-cutting reliability, multi-tenancy), each required to cite file:line and mark findings confirmed or suspected. Overlapping findings from different investigators were reconciled into the register below.
- **Reproduction:** the accounting investigation ran the real route handlers against an in-memory MongoDB; the most serious bugs (payment/expense edits dropping out of the ledger, refunds posted as receipts, locked-period rewrites, double payments) were reproduced before being fixed.
- **Fixes:** incremental, each with a regression test that calls the real code path. No data was touched, no database was reset, no workflow was removed.
- **Verification after all fixes:** `tsc` 0 errors · `eslint` 0 errors · **147/147 tests (12 files)** · `next build` succeeds.

Environment facts that shaped the fixes: Next.js 16 App Router, Mongoose 8.24 (which **silently drops `undefined` from updates** — the root cause of several P0s), MongoDB Atlas, NextAuth v5 JWT sessions, Vercel serverless. There is **no** React Query, Zod or React Hook Form in this codebase — pages use `fetch` in `useEffect` and routes validate by hand.

---

## 2. Executive summary

The product idea is sound and much of the code is careful — the double-entry engine enforces balance, posting accounts and a lock date; RBAC is centralised; impersonation tokens are single-use. But the audit found that **the CRM and the ledger could silently disagree** in ways that corrupt real books, that **several authorization checks were weaker in the API than in the UI**, and that **concurrency was not handled anywhere** (no transactions, read-then-write everywhere).

The single worst bug: **editing any received payment or expense — even fixing a typo in its notes — removed it from the ledger permanently.** The route reversed the journal entry, then tried to clear the link with `journalEntryId = undefined`, which Mongoose drops, so the "repost" step never ran. Because the payments form re-sends the date on every save, every edit triggered it. Production books have very likely been affected; `scripts/migrations/ledger-sync-report.ts` measures and repairs it.

### Scores

| Area | Before | After this branch | Why |
|---|---|---|---|
| Architecture | 6/10 | 6/10 | Clear module split and one posting engine; but no data-access layer, no transactions, business rules duplicated across routes and pages |
| Database schema | 5/10 | 6/10 | Money as floats, links by display name/course name, date-only fields as timestamps; two missing uniqueness guarantees now added |
| Data integrity | 3/10 | 6/10 | CRM↔ledger drift and double-pay/double-post races fixed; transactions and denormalised-field sync still missing |
| Security | 5/10 | 7/10 | Fail-open auth, PII exposure to sales/trainers, critical Next advisory fixed; page-level session checks, 2FA policy, PII in git history open |
| Permissions | 5/10 | 7/10 | API-weaker-than-UI gaps closed for enrollments, exports, conversion; assessor/IQA scoping and name-based ownership open |
| CRM workflow | 5/10 | 6/10 | Duplicate conversion and sales auto-enrol fixed; enrollment-request approval is still a status flag only |
| Accounting | 4/10 | 7/10 | Engine hardened (atomic reversal/post, DB-level single posting, full draft re-validation, lock respected); refund rule added; reversal-erases-history report semantics and VAT categories need an accountant |
| Payroll | 4/10 | 7/10 | Double payment, monthly re-payment, paid-session edits and fixed-fee re-pay fixed; no void/adjustment flow, rates not effective-dated |
| Testing | 3/10 | 6/10 | 88 → 147 tests; route-level tests now exist; still no UI/e2e tests and no property-based money tests |
| SaaS readiness | 2/10 | 2/10 | Single-tenant by design; see MULTITENANCY_READINESS.md (Medium-High effort, ~11–17 engineer-weeks) |
| Maintainability | 5/10 | 6/10 | Shared money/date/update/error helpers introduced; ~45 routes still hand-roll validation and error handling |
| **Production readiness** | **3/10** | **6/10** | Safe to deploy **after** running the two migration scripts below; the open P1s should follow soon |

---

## 3. Deploying this branch safely

The fixes add two unique indexes and change posting behaviour. **Order matters.**

1. **Back up** the production database (Atlas snapshot).
2. **Check for existing duplicates** — the new unique indexes cannot be built over data that already violates them, and Mongoose only logs that failure, so the protection would silently be absent:
   ```bash
   npx tsx --env-file=.env.local scripts/migrations/find-duplicate-postings.ts
   ```
   Exit code 1 lists every source document with more than one posted journal entry and every lead with more than one enrollment. An accountant resolves each (reverse the extra entry; merge/unlink the duplicate enrollment) before deploying.
3. **Deploy.** Mongoose builds `uniq_posted_entry_per_source`, `uniq_enrollment_per_lead` and `uniq_monthly_salary_period` on startup.
4. **Measure the ledger drift** caused by the old bugs (read-only):
   ```bash
   npx tsx --env-file=.env.local scripts/migrations/ledger-sync-report.ts
   ```
   It reports, with counts: received payments / expenses / fee-bearing enrollments with **no live journal entry**; refund payments that were **posted as receipts**; enrollments whose `amountPaid` disagrees with their payments.
5. **Repair missing postings** after the accountant reviews the report:
   ```bash
   npx tsx --env-file=.env.local scripts/migrations/ledger-sync-report.ts --apply
   ```
   `--apply` only posts *missing* entries, through the same posting rules the app uses; anything dated in a locked period is reported and skipped, never forced. Refunds-posted-as-receipts and `amountPaid` mismatches are **report-only** — they change posted history or a student's balance and need a human decision.

---

## 4. Issue register

Severity: **P0** data/financial corruption or critical security · **P1** serious business logic/security · **P2** significant functional/reliability · **P3** UX/performance/maintainability · **P4** cleanup.
Source IDs point into the detailed reports (ACC = accounting, PAY = payroll, S = schema, CRM = pipelines, REL = reliability, SEC = security).

### 4.1 P0 — data corruption, financial corruption, critical security

| ID | Area | Problem | Root cause | Risk | Fix | Status |
|---|---|---|---|---|---|---|
| NIT-01 | Ledger | Editing a received payment (any field — the form re-sends the date) reversed its receipt and never reposted it. The payment vanished from cash, receivables and every ledger report. *(ACC-01, S-01, REL-01)* | `update.journalEntryId = undefined` is silently stripped by Mongoose, so the "repost when no entry" check was always false; unchanged dates counted as changes. | Books permanently understate cash/receivables for every edited payment; backfill skipped them. | `syncSourceEntry()` in `lib/accounting/postings.ts`: validates the replacement entry first, finds the live entry by querying the ledger (not a stale link), clears fields with `$unset` (`lib/mongo-update.ts`), reverses only on a real money change (amount, method, type, status, calendar day). A Received payment with no live entry is re-posted on its next edit. | **Fixed** · tests `finance-routes` "payment edits keep the ledger in step" · repair: `ledger-sync-report.ts` |
| NIT-02 | Ledger | Same bug for every expense edit; the VAT split was also left stale. *(ACC-02, REL-02)* | As NIT-01. | Expenses missing from P&L, trial balance and input VAT. | As NIT-01; VAT split always recomputed from the current amount. | **Fixed** · test "editing the amount re-posts with a fresh VAT split" |
| NIT-03 | Ledger | A `Refund` payment marked Received was posted as a **receipt** (Dr Cash / Cr A/R) — refunding AED 500 added 500 to cash. *(ACC-04, S-02, REL-03)* | No refund posting rule existed; all Received payments used `postCustomerReceipt`. | Cash overstated by twice every refund; dashboard counted refunds as revenue. | `planCustomerRefund`: Cr money account; Dr the configured Refunds account, else the student's A/R (enrollment-linked) or Fees Advance (unlinked). The revenue/VAT credit note stays a manual accountant decision. | **Fixed** (new postings) · test "a Received refund moves money OUT" · existing wrong postings: report-only in `ledger-sync-report.ts` |
| NIT-04 | Accounting | Reversals ignored the lock date. Reports exclude both a reversed original and its reversal, so reversing (or editing/deleting the CRM document behind) an entry in a closed month silently rewrote that month's trial balance, ledger and VAT. *(ACC-03, S-04)* | Lock checked only on create; reversal had no lock check. | Filed VAT returns and closed periods change after the fact. | `reverseJournalEntry` refuses entries dated on/before the lock date; CRM edits and deletes check it before changing anything. | **Fixed** · tests "an entry dated in a locked period cannot be reversed", "refuses to edit a payment whose entry sits in a locked period" |
| NIT-05 | Payroll | Two simultaneous "Mark Paid" submits (two tabs, two admins, a retry) each created a payout and a salary journal entry for the same sessions. *(PAY-02, S-03, REL-04, SEC-11)* | Preview → create payout → `updateMany` sessions with no `payoutId: null` condition. | Trainer paid twice; expense doubled. | `settleTeacherPayout` in `lib/payroll.ts`: validates everything before writing, then claims sessions with a conditional update and requires every session to be claimed; the loser is rolled back with 409. A posting failure rolls back the claim and payout. | **Fixed** · test "two simultaneous Mark Paid clicks pay the work exactly once" |
| NIT-06 | Payroll | A monthly salary never recorded which month it paid; it showed as due again the next day and could be paid any number of times. *(PAY-01)* | No period concept on payouts. | Salary paid twice for the same month. | `periodKey` (YYYY-MM, UAE calendar) with unique index `uniq_monthly_salary_period`; the payout page asks for the salary month; preview says when the current month is already paid. | **Fixed** · tests "refuses a second salary for the same month", concurrent variant, UAE-month boundary |
| NIT-07 | Payroll | Paid class sessions could be edited or deleted, letting the same hours be recorded and paid again; deleting the session that settled a fixed course fee made the fee payable again. *(PAY-03, S-09, CRM-15)* | No guard on `payoutId`. | Double payment; payout no longer matches its sessions. | PATCH refuses changes to hours/status/date of a paid session (notes, topic, attendance still editable); DELETE is a conditional `findOneAndDelete({payoutId: null})` → 409. | **Fixed** |
| NIT-08 | Payroll | After a fixed course fee was paid, changing the registration's basis (e.g. to hourly) or clearing its rate paid the rest of the course on top of the fee — or never paid the fee. *(PAY-04)* | "Already paid" is inferred from settled sessions; rate/basis edits weren't checked. | Overpayment or unpaid fee. | `payRateChangeBlockedReason()` — once a session on the registration is paid, rate/basis changes that touch a fixed basis are refused (409). Hourly/per-class rate changes stay allowed. | **Fixed** · tests "fixed course fee — rate/basis lock after settlement" |
| NIT-09 | Enrollment money | Lowering `amountPaid` on an enrollment posted nothing; raising it again recorded a **second** payment and receipt. A double-click on save did the same. *(ACC-05, REL-05, SEC-08)* | Payment created from the delta against a stale read; decreases ignored. | Cash in the ledger double what was received. | Decreases refused (record a refund instead); the update is conditional on the `amountPaid` that was read, so a concurrent save gets 409; the receipt is validated before the enrollment changes. | **Fixed** · tests "lowering amountPaid … is refused", "a double-clicked 'record payment' … records it once" |
| NIT-10 | Data exposure | Any **sales** login could `GET /api/enrollments` and receive every student's Emirates ID, nationality, phone, fees, balance and trainer pay rate (the page itself is blocked for sales). Trainers received the same fields for their students. *(SEC-02, CRM-08)* | Route role lists broader than page permissions; one serializer for every role. | PDPL-relevant PII and financial exposure. | Sales removed from both GET routes (no sales screen uses them); trainers get `serializeEnrollmentForTrainer` (same shape, ID documents and money blanked). | **Fixed** · tests "who can read student records" |
| NIT-11 | Dependencies | `next` 16.3.0 is in range of critical advisories: unauthenticated RCE on Windows-hosted servers and RCE in image optimisation; `/_next/image` is outside the auth proxy. *(SEC-01)* | Outdated patch release. | Remote code execution. | Upgraded to 16.3.5 (same minor). | **Fixed** · build + full suite pass on 16.3.5 |
| NIT-12 | Accounting concurrency | "One posted entry per source document" was a read-then-write check; the unique index had been deliberately dropped at runtime. Concurrent postings (double submit, backfill running alongside staff) could post the same document twice. *(ACC-13, S-10, REL-09)* | Uniqueness enforced only in application code. | Duplicate receipts/invoices in the ledger. | Partial unique index `uniq_posted_entry_per_source` (Posted entries with a `sourceId`); duplicate-key errors become `AccountingError`; the runtime index-drop now ignores partial indexes. | **Fixed** · test "two concurrent postings for the same payment produce exactly one entry" · pre-deploy: `find-duplicate-postings.ts` |

### 4.2 P1 — serious business logic and security

| ID | Area | Problem | Root cause | Fix | Status |
|---|---|---|---|---|---|
| NIT-13 | Auth | `requireAuth` **failed open** when the live user lookup threw — deactivated users kept access, demoted users kept their role. Unknown roles defaulted to `sales`. *(SEC-04, REL-22)* | `catch { return { active: true } }` + `role ?? "sales"`. | Fail closed (503) with a 15-minute grace for a recently verified state; unknown role → 403; missing user id → 401. | **Fixed** · tests "requireAuth fails closed" |
| NIT-14 | Auth | Server-rendered pages (dashboard, finance, reports) and the page proxy trust the JWT role for up to 8 h and never re-check the database. *(SEC-04)* | JWT sessions; page guard uses token claims. | Needs a `requireSession()` live check for server pages + token versioning on `User`. | **Open** |
| NIT-15 | Impersonation | An impersonated session stayed valid 8 h after the admin was deactivated/demoted, and could mint an admin return ticket. *(SEC-05)* | Only the target user was re-checked; exit checked `active` only. | Every API call and the exit route require the impersonator to still be an active **admin**. Server-side single-use impersonation sessions with a short TTL remain open. | **Partly fixed** · test "impersonation" |
| NIT-16 | Audit | Audit writes were fire-and-forget and errors swallowed (events lost on serverless freeze or schema validation); payments POST, all expense changes, user create/role change/deactivation/password reset/delete and exports had no audit at all. *(REL-13, SEC-12, CRM-40, S-41)* | `AuditLog.create(...).catch(() => {})`; missing calls. | `logAudit` awaited everywhere (49+ sites), clipped to schema limits, never throws, logs the full event on failure; audit added to the routes listed. Actor ids, before/after snapshots, login events, imports/courses/teachers/settings coverage remain open. | **Partly fixed** · tests assert audit rows for payment delete, user changes, exports |
| NIT-17 | Posting failures | Every CRM→ledger posting was wrapped in `postSafely`, which logged and returned success. A locked period, inactive account or bad mapping left documents saved with no journal entry and nobody told. *(ACC-06, REL-08, S-15)* | Deliberate "never break the CRM action" design. | Predictable failures are now checked **before** the document is saved (the user sees the reason); an unexpected failure after saving is stored on the document (`postingError`), audited, and returned as `warning`, which the Payments/Expenses pages display. `postSafely` is deprecated. Supplier bills/payments still use it. | **Fixed** for payments, expenses, enrollments, payouts · supplier bills/payments **open** |
| NIT-18 | Journal | Draft edits skipped all engine validation (both-sided lines, inactive accounts, locked dates), and posting a draft only compared stored totals. *(ACC-07, S-12, REL-31, SEC-10)* | Separate ad-hoc validation in the route. | One `validateJournalLines` + `loadPostingAccounts` + `assertOpenPeriod` used by create, draft edit and post; Draft→Posted is atomic. | **Fixed** · tests in `engine-hardening` and `crm-security-routes` |
| NIT-19 | Journal | Two concurrent reversals of one entry created two reversal entries. *(ACC-10, REL-09)* | Check-then-create. | Atomic claim of the original (`Posted` → `Reversed`) before creating the reversal; rolled back if creation fails. | **Fixed** · test "two simultaneous reversals create one reversal" |
| NIT-20 | Balances | `Enrollment.amountPaid` (used by Collections, Finance, Reports, Dashboard balances) ignored payments recorded, edited or deleted on the Payments page. *(ACC-08, S-06, REL-06)* | Denormalised total updated only by the enrollment form. | `applyPaymentToEnrollment()` applies a rounded server-side increment on payment create/edit/delete (refunds count negative). Historical mismatches: report in `ledger-sync-report.ts`. Long term: derive balances from payments or the ledger. | **Fixed** (going forward) · test "a payment recorded on the Payments page updates the student's balance" |
| NIT-21 | Deletes | Deleting an enrollment reversed only its invoice — receipts stayed (student A/R in credit), payments/sessions/learner profile orphaned, payroll kept paying its sessions. Payments/expenses were deleted **before** their reversal, so a failed reversal left a live entry for a deleted document. *(ACC-09, CRM-12, S-07, REL-14)* | Hard deletes without dependency checks; wrong order. | Enrollment delete refused (409) while payments or class records exist; all three deletes reverse first and refuse in a locked period. Soft-delete/void for financial documents remains open. | **Fixed** (guards) · test "a registration with payments can't be deleted" |
| NIT-22 | CRM | Sales could create an enrollment by setting a lead's stage to *Enrolled*, bypassing approval and the admin-only create route. *(CRM-01, SEC-29)* | Stage select not role-gated server-side. | 403 for sales. | **Fixed** · test |
| NIT-23 | CRM | Converting a lead was read-then-create: two saves at once created two enrollments (and later two invoices). *(CRM-03, S-11)* | No uniqueness on `Enrollment.leadId`. | Unique partial index `uniq_enrollment_per_lead`; duplicate-key returns the existing enrollment. | **Fixed** · test "two conversions … create ONE registration" |
| NIT-24 | CRM | Approving an enrollment request only changes its status — no enrollment, no lead update, transitions unguarded, not audited. *(CRM-02)* | Approval never implemented as a workflow. | Conditional status transition + idempotent enrollment creation + audit + notify. | **Open** |
| NIT-25 | Export | Sales exported every salesperson's leads and follow-ups. *(SEC-03, CRM-07)* | Generic export ignored ownership. | Owner filter for sales; exports audited. | **Fixed** · test "sales exports only their own leads" |
| NIT-26 | Compliance | Any assessor/IQA/manager can change any grade, including after IQA sign-off; IQA sample fields come from the request body, not the assessment; sampler can be the assessor; no EQA or certification-claim entity. *(CRM-22, CRM-23, CRM-24, SEC-14)* | No assessor-of-record, transition table or lock. | Assessor-of-record check, transition table, lock after completed IQA sample, derive sample fields server-side, decision history. | **Open** |
| NIT-27 | Receivables | "A/R migration" POST rewrote posted journal lines in place, matching students by name. *(ACC-17, S-05, SEC-25)* | One-off script left as a live route. | Route retired (410). | **Fixed** |
| NIT-28 | Imports | CSV import of payments/expenses/enrollments creates money records with no ledger posting, no duplicate check, no dry run, no audit; lead import aborts part-way and duplicates on re-upload; JV import has no idempotency. *(REL-15, SEC-13, CRM-06, CRM-34, ACC-19)* | Import code bypasses the business services. | Route imports through the same services; add a dry-run/preview; per-row errors; import batch id. | **Open** |
| NIT-29 | Dates | Business dates use UTC day boundaries: a payment at 01:30 UAE on 1 Oct is stored and reported as 30 Sep (and in Q3 VAT); "today"/"this month" defaults and report filters are UTC. *(ACC-16, S-17, REL-16–18, PAY-18)* | `toISOString().slice(0,10)`, `T23:59:59Z` filters, server `new Date()` in UTC. | A single Asia/Dubai day helper for defaults, filters and lock comparison. Salary months already use UAE time (`businessMonthKey`). | **Open** (payroll month fixed) |
| NIT-30 | Transactions | No multi-document write uses a MongoDB transaction; partial failure can leave, e.g., a payout without its entry. *(REL-07)* | Transactions never introduced; tests use a standalone in-memory server. | This branch adds validate-before-write + compensating rollback on the money paths. Next step: a `withTransaction` helper (Atlas is a replica set) and `MongoMemoryReplSet` in tests. | **Mitigated / open** |
| NIT-31 | DB connection | A failed connection promise stayed cached — one database blip broke every request on that instance until recycled. *(REL-11)* | Rejected promise never cleared. | Cleared on failure; `serverSelectionTimeoutMS: 10s`. | **Fixed** |
| NIT-32 | Ownership | Lead, follow-up and attendance ownership is by display name — same-name users share records, renames transfer access, impersonated creates are assigned to "Name (via Admin)"; trainer login ↔ Teacher link is by non-unique email. *(SEC-22, S-21, S-08, CRM-29)* | Names/emails used as foreign keys. | Store user/teacher ObjectIds; unique lowercased `Teacher.email` or `Teacher.userId`. | **Open** |
| NIT-33 | Git history | `leads_import.csv` (83 prospects' names and phone numbers) is committed. *(SEC-15)* | File added to the repo. | Owner decision: purge from history (`git filter-repo`) and assess data-protection obligations. | **Open — owner decision** |

### 4.3 P2 — significant functional and reliability problems

| ID | Area | Problem | Fix / status |
|---|---|---|---|
| NIT-34 | Validation | Amounts accepted `"Infinity"`, `1e308` and 3-decimal values; the engine balanced Infinity against itself. *(REL-21)* | `lib/money.ts parseAmount` (finite, ≥0, ≤ AED 10M, rounded to fils) on payments, expenses, enrollments, payouts, trainer rates; engine rejects non-finite lines. **Fixed** |
| NIT-35 | Payroll | Negative trainer rates accepted; a rate without a basis silently meant Per Hour; payout account codes not type-checked (a trainer could be "paid" from a student's receivable). *(PAY-12, PAY-20, PAY-21)* | Rates validated; basis required with a rate; expense account must be Expense, payment account must be Asset/Liability and not A/R. **Fixed** |
| NIT-36 | Updates | ~31 "clear this field" PATCH paths do nothing (Mongoose drops `undefined`) — e.g. clearing a registration's trainer pay rate or removing all trainers left the old values. *(S-14, CRM-09, CRM-10, REL-27, ACC-30)* | `toMongoUpdate` (`$unset`) applied in payments, expenses, enrollments (incl. pay rate and trainer list). Leads, learner profiles and other routes **open** |
| NIT-37 | Expenses | Any VAT rate accepted (50% claimed as input VAT); any posting account usable as the expense account. *(ACC-22, SEC-09)* | VAT rate must be 0 or the configured rate; expense account type enforced. **Fixed** · UAE input-VAT evidence rules → tax agent |
| NIT-38 | VAT report | Included reversed originals **and** reversals, listing a corrected invoice three times. *(ACC-15)* | Active entries only, same as TB/ledger. **Fixed** · tax categories/VAT201 boxes → tax agent |
| NIT-39 | Dashboard | Accounting dashboard A/R read only the control account (per-student receivables live in child accounts) and showed ~0. *(ACC-14)* | Sums every account under 10103, as the Receivables report does. **Fixed** |
| NIT-40 | Backfill | Backfill treated reversed entries as "already posted" (so it never repaired NIT-01/02 damage) and posted refunds as receipts. *(ACC-18)* | Only Draft/Posted entries count; refunds use the refund rule; failures recorded on the document. **Fixed** · `admin/backfill-payments` still recreates deleted payments — **open** |
| NIT-41 | Errors | ~60 routes return raw `error.message` — duplicate-key text with other users' values, hostnames; DB outages return 400. *(REL-20, SEC-20)* | `lib/api-error.ts` applied to payments, expenses, enrollments, payouts. Remaining routes **open** |
| NIT-42 | CSV | Exports didn't neutralise formulas (`=HYPERLINK(...)` in a lead name executes in Excel). *(SEC-07, CRM-35, REL-28)* | `csvEscape` prefixes `'`; real numbers untouched. **Fixed** · tests |
| NIT-43 | Frontend | 131 fetches vs 68 status checks — refused deletes closed dialogs as if they worked; conversion ignores `res.ok`; bulk follow-up counts 4xx as success. *(REL-23, CRM-04, CRM-30)* | Payments/Expenses deletes and warnings fixed. A shared `apiFetch` that throws on non-2xx for the rest **open** |
| NIT-44 | Report consistency | Revenue is computed four ways (cash incl. refunds, cash excl. refunds, accrual, Σ amountPaid); "balance due" in six places; finance "net" omits payouts and supplier bills. *(ACC-24, REL-36)* | **Finance page fixed** (branch `feature/finance-owner-dashboard`): `lib/finance/owner-metrics.ts` derives all 8 owner cards, the monthly chart and every breakdown from posted journal entries in UAE calendar days, each card labelled with its basis and definition; net profit now includes teacher pay and supplier bills and reconciles with the trial balance (tests `tests/finance/owner-metrics.test.ts`). Main dashboard, Reports and Collections tiles still use their own definitions — **open** |
| NIT-45 | Money representation | All money is IEEE-double `Number`; `round2` isn't true half-up (`round2(1.005) = 1`). *(ACC-27, S-16, PAY-19)* | Amounts are now rounded to fils at every input touched. Integer fils / Decimal128 migration **open** (needs data migration) |
| NIT-46 | Payments | A Received payment could have no `datePaid` (absent from date-filtered reports, present in the ledger); linked enrollment id not validated. *(S-18)* | Received payments default `datePaid` to now; enrollment link must exist. **Fixed** |
| NIT-47 | Sessions | Class sessions accepted for Dropped/Completed enrollments; duplicate-slot index only when `startTime` is set and keyed on teacher *name*; trainer-recorded No Show hours unlimited. *(CRM-14, CRM-16, PAY-06, PAY-07)* | **Open** |
| NIT-48 | Attendance | Two unrelated attendance systems (register vs ClassSession); register never affects hours; trainer PATCH not scoped. *(CRM-17, CRM-18, SEC-23)* | **Open** |
| NIT-49 | Supplier AP | Supplier payment doesn't check the bill belongs to the supplier, allows overpayment, updates `amountPaid` read-modify-write. *(ACC-21, S-23, REL-30)* | **Open** |
| NIT-50 | Opening balances | Editable at any time outside the journal; supplier opening stored twice. *(ACC-20, S-26)* | **Open** |
| NIT-51 | Settings | Account mappings only checked for existence; lock date can be moved back or cleared without before/after audit; `courseRevenueMap` keyed by category but looked up by course name; VAT configured in two places. *(ACC-23, S-19)* | **Open** |
| NIT-52 | Notifications | Session-edit notifications broadcast to every trainer; role-broadcast notifications share one `read` flag. *(CRM-19, CRM-20, SEC-24, S-31)* | **Open** |
| NIT-53 | Links by name | Enrollments, sessions, payments link to Course by non-unique `courseName`; renaming a course breaks counts. *(S-20)* | **Open** (needs `courseId` backfill) |
| NIT-54 | Payroll corrections | No payout void or adjustment document; corrected hours after payment have no financial effect; rates not effective-dated; salary expensed on cash basis. *(PAY-10, PAY-13, PAY-16, PAY-17)* | **Open** · cash vs accrual → accountant |
| NIT-55 | Compliance dashboard | Counts documents "Present" regardless of expiry; ignores enrollment status, assessments and IQA. *(CRM-27)* | **Open** |

### 4.4 P3 / P4 — performance, maintainability, cleanup

| ID | Area | Problem | Status |
|---|---|---|---|
| NIT-56 | Performance | Payouts page runs ~90 queries (per-trainer preview, per-enrollment fixed-fee check); dashboard ~20 + 6 per sales user; whole collections loaded and paginated in the browser; unanchored regex search. *(REL-32, REL-33, PAY-23)* | **Open** — batch the payroll preview; server-side pagination; totals in aggregation |
| NIT-57 | Indexes | Missing for real filters: Enrollment `{teacherId}`, `{teacherIds}`, `{phone, course}`; Payment `{enrollmentId}`; FollowUp `{leadId}`; Teacher `{email}`; Lead `{nextFollowUpDate}`, normalised phone; AuditLog `{entity, createdAt}`. Unused text indexes. *(S-35, S-36, REL-34)* | **Open** (Enrollment `{leadId}` added as unique) |
| NIT-58 | Duplicate index | `LearnerProfile.enrollmentId` declared both unique and as a plain index — the build warns, and if the plain index is created first the unique one can fail to build. *(S-36)* | **Fixed** (plain duplicate removed) |
| NIT-59 | Duplicates | Lead phone dedupe matches raw strings (`050…` vs `+971 50 …`), unindexed, skipped by PATCH and import. *(CRM-05, S-28)* | **Open** — normalised E.164 field with unique partial index |
| NIT-60 | Singletons | Settings/AccountingSettings created with read-then-create — a race creates two documents and `findOne` returns either. *(S-38)* | **Open** — fixed `_id` |
| NIT-61 | Migrations | Migrations exist as HTTP routes (`admin/backfill-payments`, `admin/migrate-roles`, `accounting/backfill`, `seed-coa`) with no dry run; the engine drops an index at runtime. *(S-40)* | **Partly** — `scripts/migrations/` convention with dry-run introduced; retire the HTTP routes once run |
| NIT-62 | Types | 54 `any`, `as never` casts in money code, `Model<any>` exports, TS interfaces diverging from schemas, eslint-config-next 15.1.3 against Next 16. *(S-43, REL-41)* | **Open** |
| NIT-63 | Sequences | Numbers consumed before validation leave gaps; 3-digit padding breaks string sort after 999; `E-###` doubles as the invoice number (tax-invoice numbering → tax agent). *(REL-37, S-45, ACC-29)* | **Open** |
| NIT-64 | Permissions drift | Pages/sidebar offer screens the API refuses (courses for compliance roles, Mark Paid for finance, seed/backfill for manager, password change for 4 roles, students/classes import tabs). *(SEC §3.2, CRM-33)* | **Open** |
| NIT-65 | Dead config | `/document-control` rules without a page; `staff` role filter on dashboard; `salesEmail` compared to the user's name (sales "my pending requests" always 0). *(S-34, S-46)* | **Open** |

---

## 5. Fixes applied — detail

Every fix below was verified by a test that fails on the old code path and passes on the new one, then by the full suite, `tsc`, `eslint` and `next build`.

### 5.1 CRM ↔ ledger synchronisation (NIT-01, 02, 03, 04, 17, 20, 21, 46)
- **Problem:** edits dropped documents from the ledger; refunds posted as receipts; posting failures swallowed; deletes left live entries; balances ignored the Payments page.
- **Root cause:** Mongoose stripping `undefined` in updates; routes trusting a stale `journalEntryId` link; no refund rule; `postSafely` swallowing errors; delete-then-reverse ordering; `amountPaid` updated from one screen only.
- **Files:** `lib/accounting/postings.ts` (plan/post split, `planCustomerRefund`, `planForPayment`, `syncSourceEntry`, `postForNewDocument`, `assertExpenseAccount`, `splitInclusiveVat`, atomic `ensureStudentArAccount`), `lib/accounting/engine.ts` (`preflightJournalEntry`), `lib/mongo-update.ts`, `lib/enrollment-balance.ts`, `lib/money.ts`, `lib/api-error.ts`, `app/api/payments/route.ts`, `app/api/payments/[id]/route.ts`, `app/api/expenses/route.ts`, `app/api/expenses/[id]/route.ts`, `app/api/enrollments/route.ts`, `app/api/enrollments/[id]/route.ts`, `models/Financial.ts` + `models/Enrollment.ts` (`postingError`), `app/(dashboard)/payments/page.tsx`, `app/(dashboard)/expenses/page.tsx`.
- **Tests:** `tests/api/finance-routes.test.ts` (payment edits, notes-only save, self-repair, delete, refund, locked period create/edit, error leakage, expense edit/VAT/account type, amountPaid sync, double-click, fee change, clearing pay rate, delete guard).

### 5.2 Accounting engine hardening (NIT-12, 18, 19, 34)
- **Files:** `lib/accounting/engine.ts` (shared `validateJournalLines`, `loadPostingAccounts`, exported `assertOpenPeriod`; finite amounts; valid dates; atomic post and reverse; lock on reversal; duplicate-key → `AccountingError`), `models/accounting/JournalEntry.ts` (partial unique index), `app/api/accounting/journal-entries/[id]/route.ts` (draft edit validation + audit).
- **Tests:** `tests/accounting/engine-hardening.test.ts` (concurrent post, repost after reversal, concurrent reversal, locked reversal, draft re-validation on lock/inactive account, double post, Infinity, invalid date, preflight, `syncSourceEntry` ordering, concurrent A/R account creation) and `tests/api/crm-security-routes.test.ts` (draft edits).

### 5.3 Payroll (NIT-05, 06, 07, 08, 35)
- **Files:** `lib/payroll.ts` (`settleTeacherPayout`, `payRateChangeBlockedReason`, `businessMonthKey`, `PayrollError`, salary-period preview), `app/api/teacher-payouts/route.ts`, `models/TeacherPayout.ts` (`periodKey` + unique index), `app/api/class-sessions/[id]/route.ts`, `app/api/teachers/route.ts`, `app/api/teachers/[id]/route.ts`, `app/(dashboard)/teacher-payouts/page.tsx` (salary month field).
- **Tests:** `tests/accounting/payroll-settlement.test.ts` (happy path, concurrent double submit, Infinity, locked period with no side effects, receivable as payment account, adjustment reason, monthly once per month incl. concurrency, UAE month boundary, fixed-fee lock allow/deny cases). The existing 13 `payroll.test.ts` calculation tests are unchanged and pass.

### 5.4 Authentication, authorization, audit (NIT-10, 13, 15, 16, 22, 23, 25, 27, 42)
- **Files:** `lib/api-auth.ts` (fail closed, grace window, unknown role, impersonator check, test cache reset), `lib/audit.ts` (awaited, clipped, loud failure), all `logAudit` call sites (now awaited), `lib/serializers.ts` (`serializeEnrollmentForTrainer`), `app/api/my/students/route.ts`, `app/api/leads/[id]/route.ts`, `models/Enrollment.ts` (unique `leadId`), `app/api/export/[entity]/route.ts`, `app/api/users/route.ts`, `app/api/users/[id]/route.ts` (self-role guard, last-admin guard, audit), `app/api/impersonate/exit/route.ts`, `app/api/accounting/receivables/route.ts`, `lib/utils.ts` (`csvEscape`).
- **Tests:** `tests/api/finance-routes.test.ts` (fail-closed auth, sales 403, trainer redaction), `tests/api/crm-security-routes.test.ts` (sales auto-enrol, concurrent conversion, self role change, user audit, sales export scoping, impersonation ending), `tests/utils/csv.test.ts` (formula neutralisation, numbers preserved).

### 5.5 Reports, infrastructure, dependencies (NIT-11, 31, 38, 39, 40, 58)
- **Files:** `lib/db.ts`, `app/api/accounting/vat-report/route.ts`, `app/api/accounting/dashboard/route.ts`, `app/api/accounting/backfill/route.ts`, `models/LearnerProfile.ts`, `package.json` / `package-lock.json` (next 16.3.5).
- **Verification:** full suite, `tsc`, `eslint`, `next build` on the upgraded Next.

### 5.6 Test infrastructure
- `tests/helpers/route.ts` — sign in as any role and call real route handlers against the in-memory database (mock only `@/auth`, `@/lib/db`, `@/lib/notify`). The previous CRM tests re-implemented route logic inside the test, so they could not catch route regressions.

### 5.7 Migration scripts (dry-run by default)
- `scripts/migrations/find-duplicate-postings.ts` — read-only; exit 1 if the new unique indexes would fail to build.
- `scripts/migrations/ledger-sync-report.ts` — counts scanned / needing change / changed / skipped / errors; `--apply` only posts missing entries.

---

## 6. Dashboard and report consistency

The same concept is currently computed differently on different screens. None of these were changed on this branch except the accounting dashboard A/R tile and the VAT report (both now match the ledger); the rest need a product/accounting decision on which definition each tile should show.

| Metric | Where | Definition today | Consistent with the ledger? |
|---|---|---|---|
| Revenue | Accounting dashboard, Trial Balance, P&L | Posted credits on Revenue accounts (accrual, invoice date) | ✅ source of truth |
| Revenue | Main dashboard | Σ Received payments **including** refunds (cash) | ❌ differs by basis and by refunds |
| Revenue | Payments page total | Σ Received payments **excluding** refunds (cash) | ❌ basis differs |
| Revenue | Reports page / CSV export | Σ `amountPaid` or payments incl. refunds | ❌ |
| Outstanding / balance due | Collections, Finance, Reports, Dashboard, Enrollments page | `totalFee − amountPaid` (6 separate implementations) | ⚠ now in step for new payments (NIT-20); historical data may differ — see `ledger-sync-report.ts` §5 |
| Receivables | Receivables report, Accounting dashboard | Σ per-student A/R accounts | ✅ (dashboard fixed) |
| Net income | Finance page | Accrual revenue − Expense **documents** | ❌ omits teacher payouts and supplier bills |
| Trainer pay owed | Teacher Payouts | Server-side preview of unpaid payable sessions | ✅ (single implementation) |

**Recommendation:** every financial tile either reads from the ledger (`aggregateBalances`) or is explicitly labelled "cash received". Put the definitions in one `lib/metrics/` module.

---

## 7. Remaining work

### Needs a human decision (not guessed)
- **Licensed accountant:** refunds-posted-as-receipts repair; deferred revenue for courses billed in advance (revenue is recognised at registration today); cash vs accrual for trainer pay; whether reports should keep "reversal erases the original from its period" semantics or show both entries on their own dates (the lock-date guard makes the current semantics safe for closed periods).
- **UAE tax agent:** VAT tax categories and VAT201 boxes; input VAT evidence (supplier TRN); tax-invoice and credit-note documents and numbering; e-invoicing readiness.
- **Owner:** purge `leads_import.csv` from git history; No Show and Dropped pay policy; how co-teachers share a fixed course fee (PAY-05, PAY-22); whether 2FA becomes mandatory for admin/finance/accountant.

### Recommended next actions

**NOW**
1. Run the deploy procedure in §3 (duplicates check → deploy → ledger-sync report → accountant review → `--apply`).
2. Live session check for server-rendered pages + token versioning (NIT-14).
3. Decide on the PII in git history (NIT-33).
4. Enrollment-request approval as a real, idempotent, audited workflow (NIT-24).

**NEXT**
5. One Asia/Dubai date helper for defaults, filters and the lock date (NIT-29).
6. `withTransaction` helper for payment/enrollment/payout/journal writes; tests on `MongoMemoryReplSet` (NIT-30).
7. Imports through the posting services, with a dry-run preview (NIT-28).
8. Compliance controls: assessor of record, transitions, IQA lock, assessor/IQA data scoping (NIT-26).
9. Ownership by user id instead of display name (NIT-32).
10. Apply `apiError`, `toMongoUpdate` and `parseAmount` to the remaining routes; shared client `apiFetch` (NIT-36, 41, 43).
11. Payout void/adjustment documents (NIT-54); supplier AP controls (NIT-49); settings validation and lock-date audit (NIT-51).

**LATER**
12. Integer fils or Decimal128 for money, with a migration (NIT-45).
13. Single metrics module and ledger-based dashboards (NIT-44).
14. Server-side pagination, batched payroll preview, the missing indexes (NIT-56, 57).
15. Multi-tenancy Phase 0 prep (MULTITENANCY_READINESS.md §5): data-access layer with request context, per-tenant settings and counters.
