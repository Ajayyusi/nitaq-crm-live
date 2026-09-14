> **Audit document — generated during the full-system audit on 2026-09-14 (branch `audit/full-system-debug`).**
> File:line references point at the code as it was at commit `b2962a9`, before the audit fixes.
> Many findings below are now fixed — the authoritative status of every issue is the register in [SYSTEM_AUDIT.md](../../SYSTEM_AUDIT.md).

# Nitaq CRM — Accounting & Money-Flow Audit

- Repo: `C:\Users\User\nitaq-crm-live`, branch `audit/full-system-debug` @ `b2962a9`
- Date: 2026-09-14. Mode: read-only on the repository. No real database touched.
- Evidence: full code reading plus a runtime probe (`scratchpad/accounting.probe.test.ts`, config `scratchpad/probe.vitest.config.mjs`, output `scratchpad/probe-output.txt`). The probe drives the real route handlers against mongodb-memory-server with auth/db/audit mocked.
- Existing suite: `npx vitest run tests/accounting` gives 4 files, 64 tests, all passing. The tests cover the engine in isolation; none of the defects below is caught.
- Labels: **CONFIRMED** means reproduced by the probe or unambiguous from code. **SUSPECTED** means it depends on deployment or needs an accountant or tax agent to rule.
- Items marked **[ACCOUNTANT]** or **[TAX AGENT]** need a licensed UAE accountant or tax agent before implementation.

---

## 0. Executive summary

The engine's `createJournalEntry` is sound: it checks balance, posting and active accounts, and the lock date. The damage comes from the paths around it.

1. **Editing a payment or expense removes it from the ledger permanently (P0, probe P1/P1b/P8).** The edit reverses the entry. It then sets `update.journalEntryId = undefined`, which Mongoose silently drops, so the "re-post if no entry" branch never runs. The payments UI sends `datePaid` on every save, so even a notes-only edit wipes the receipt. Backfill will not repair it, because backfill treats a *reversed* entry as "already posted".
2. **Locked periods are not locked (P0, probe P3/P6/P7).** Reversals skip the lock check. Reports drop reversed originals from their own period. In the probe, June cash went from 1,500 to 0 after June was locked. Posting into a locked period fails silently: the CRM returns 201 and nothing reaches the ledger.
3. **Refunds post as receipts (P0, probe P2):** a 300 refund is debited to cash as +300.
4. **Enrollment `amountPaid` edits create duplicate receipts (P0, probe P5).** Payments and enrollments are two unsynchronised sources of truth. For one student the probe shows four "outstanding" figures: 4,000, 1,500, 0 and −3,500.
5. **Every posting failure is swallowed (`postSafely`), and nothing is atomic or idempotent.** Double-clicks double-post (probe P10). Concurrent teacher payouts pay the same sessions twice (probe P10).
6. **Reports mix cash and accrual bases, compute date boundaries in UTC instead of Dubai time, and mostly read CRM documents rather than the ledger.**

The recommended path is targeted fixes, not an engine rewrite. Section 6 gives the order.

---

## 1. Journal invariants

| Invariant | Engine (`createJournalEntry`) | Draft edit (`PATCH journal-entries/[id]`) | `postJournalEntry` | Model (`JournalEntry.ts`) |
|---|---|---|---|---|
| Σ debit = Σ credit | Yes, `engine.ts:92` (float `round2`) | Totals recomputed, **not checked** (`[id]/route.ts:93-117`) | Compares stored totals only (`engine.ts:167`) | **None.** No pre-save hook; `totalDebit`/`totalCredit` are free fields (`JournalEntry.ts:82-83`) |
| ≥ 2 lines | Yes, `engine.ts:76` | **No.** 0 or 1 line accepted (probe P4) | No | No |
| Exactly one of debit/credit > 0 | Yes, `engine.ts:87-88` | **No.** Line D250/C250 accepted and posted (probe P4) | No | Only `min:0` (`JournalEntry.ts:61-62`) |
| No zero line | Yes, `engine.ts:88` | **No** | No | No |
| Negative amounts | Rejected, `engine.ts:86` | Rejected only by Mongoose `min:0` on save | n/a | `min:0` |
| Account exists + posting | Yes, `engine.ts:102-105` | Exists + posting only | **No** | No |
| Account active | Yes, `engine.ts:106` | **No** | **No** | No |
| Lock date | Yes, but compares an instant to UTC midnight, so the lock day itself can still be posted (`engine.ts:111`, probe P7) | **No.** Date can be moved into a locked period (probe P4) | **No** | No |
| Account-type sanity (e.g. cash must not carry a revenue line) | None | None | None | Accounts can be created under a parent of a different type or under a posting parent (`accounts/route.ts:97-112`) |
| Posted immutability | Asserted in API only (`[id]/route.ts:85`) | n/a | n/a | **None.** `receivables POST` rewrites posted lines (`receivables/route.ts:86-100`) |
| One active entry per source | Check-then-insert (`engine.ts:118-129`); unique index **dropped at runtime** (`engine.ts:50-62`) | n/a | n/a | Non-unique index (`JournalEntry.ts:110`) |

Rounding is `Math.round(n*100)/100` on binary floats (`engine.ts:41`, `postings.ts:17`). `round2(1.005)` returns `1`, where half-up expects `1.01`.

---

## 2. Lifecycle

- **States:** `Draft → Posted → Reversed` and `Draft → Cancelled` (`JournalEntry.ts:3`). There is no delete route for journal entries. Good.
- **Posted edits are blocked** in `PATCH journal-entries/[id]` (`:85`). Other paths still change posted data: `receivables POST` rewrites lines, account opening balances can be edited at any time (`accounts/[code]/route.ts:27-28`), and supplier opening balances are set on creation.
- **Reversal is a counter-entry** (`engine.ts:180-221`), dated `new Date()`, `sourceType: "Reversal"`. Problems:
  - no lock check;
  - not atomic, so two concurrent calls create two reversals (probe P7);
  - a Reversal entry can itself be reversed, but the original stays excluded from reports.
- **Reports exclude reversed originals and Reversal entries entirely** (`engine.ts:238`, `receivables/route.ts:29`, `finance/page.tsx:20`). All-time net is unchanged. But the original disappears from **its own period**, so locked-period reports are rewritten retroactively (probe P3: June cash 1,500 → 0).
- **Period close:** there is only a single `lockDate` (`AccountingSettings.ts:68`). It has no fiscal years, no soft/hard lock and no year-end closing entry. An accountant can move it backwards or clear it with no before/after audit (`settings/route.ts:69-78`).
- **Entry dates vs source dates:**

| Source | Entry date |
|---|---|
| Invoice | `registrationDate` |
| Receipt from Payments page | `datePaid ?? now` (no datePaid means the document carries no date but the entry is dated today) |
| Receipt auto-created from enrollment | `new Date()` (actual instant, UTC) |
| Expense | `expenseDate` |
| Teacher payout | `paidDate` |
| Reversal | today, never the original's date or the edit date chosen by the user |

---

## 3. Posting-rules table (as implemented)

| # | Source event (file:line) | Dr | Cr | Idempotency key | Atomic with source write? | Failure handling | Reversible? |
|---|---|---|---|---|---|---|---|
| 1 | Enrollment create, `totalFee>0` (`enrollments/route.ts:177-187`, rule `postings.ts:78-108`) | Student AR `10103xxxxx` (auto-created; falls back to control `1010300001`) — gross | Revenue (`courseRevenueMap[course]` or `4010010001`) — net; Output VAT `2030100003` if global `vatEnabled` (VAT-inclusive split) | `Invoice:<enrollment _id>`, code-level check only | No | `postSafely`: swallowed, 201 returned | Fee change: reverse (dated today) + repost (dated `registrationDate`). Delete: reverse |
| 2 | Enrollment create, `amountPaid>0` (`enrollments/route.ts:189-225`) | Money account by method (`postings.ts:20-30`) | Student AR | New Payment `_id` each time, so **none** | No (Enrollment, Payment, JE are 3 writes) | Swallowed | Only via Payment delete |
| 3 | Enrollment PATCH, `amountPaid` up (`enrollments/[id]/route.ts:205-243`) | Money | Student AR, for the delta | **None.** Down-then-up re-posts (probe P5) | No | Swallowed | Decrease does **nothing** |
| 4 | Enrollment PATCH, `totalFee` changed (`[id]/route.ts:246-260`) | reverse #1, repost #1 | | `Invoice:<id>` | No | Reversal succeeds, repost into a locked period fails silently, **invoice lost** (probe P6) | — |
| 5 | Enrollment DELETE (`[id]/route.ts:285-288`) | reverse #1 | | — | No (doc hard-deleted first) | Swallowed | Receipts and payments left behind, AR goes negative (probe P5-delete: −3,500) |
| 6 | Lead → Enrolled (`leads/[id]/route.ts:183-199`) | — | — | — | — | Enrollment with fee 0, no posting | — |
| 7 | Payment POST, status Received (`payments/route.ts:105-122`, rule `postings.ts:119-148`) | Money by method | Student AR if `enrollmentId`, else Fees Advance `2030100001`. **Refund type posts the same direction** (probe P2) | `Receipt:<payment _id>`; no request key, so a double-click posts twice (probe P10) | No | Swallowed; lock failure returns 201 with no JE (probe P3) | — |
| 8 | Payment PATCH (`payments/[id]/route.ts:87-123`) | reverse #7 | | — | No | **Repost never runs** (`update.journalEntryId = undefined` is stripped); ledger loses the receipt (probe P1/P1b) | Received→Refunded/Pending: reverses (erases history) |
| 9 | Payment DELETE (`payments/[id]/route.ts:142-145`) | reverse #7 | | — | No (hard delete first) | Swallowed | — |
| 10 | Expense POST (`expenses/route.ts:66-104`, rule `postings.ts:171-198`) | Expense (`expenseAccountCode` or `5010010017`) net; Input VAT `2030100002` (any `vatRate`, inclusive) | Money by method | `Expense:<expense _id>` | No | Swallowed | — |
| 11 | Expense PATCH (`expenses/[id]/route.ts:68-109`) | reverse #10 | | — | No | **No repost** (same stripped-undefined bug); if no entry existed, reposts with **stale net/VAT** (probe P8: doc 210, entry 105) | — |
| 12 | Expense DELETE (`expenses/[id]/route.ts:128-131`) | reverse #10 | | — | No | Swallowed | — |
| 13 | Supplier bill POST (`supplier-bills/route.ts:50-91`, rule `postings.ts:206-228`) | Expense net + Input VAT (`amount × rate`, VAT-exclusive, any rate, regardless of supplier TRN) | Supplier account (`supplierCode`) | `SupplierBill:<bill _id>` | No | Swallowed | No edit/cancel/delete route |
| 14 | Supplier payment POST (`supplier-payments/route.ts:44-90`) | Supplier account | `paymentAccountCode` (any account the client sends) | `SupplierPayment:<_id>` | No (bill `amountPaid` updated before posting) | Swallowed | No route |
| 15 | Teacher payout POST (`teacher-payouts/route.ts:86-189`) | Salary account (client-overridable) | Payment account (client-overridable) | `Expense:<payout _id>`; sessions stamped non-atomically, so concurrent requests pay twice (probe P10) | No | Returns 201 + `warning`; audit only; no retry | No route |
| 16 | Manual JV POST (`journal-entries/route.ts:77-85`) | any | any | none | n/a | 400 | Reverse action |
| 17 | Draft edit / post / cancel / reverse (`journal-entries/[id]/route.ts`) | — | — | — | — | Edit bypasses validation (probe P4) | Yes (counter-entry) |
| 18 | CSV JV import (`journal-entries/import/route.ts`) | any | any | **none.** Re-upload duplicates everything | Per voucher group | Per-group error list | Reverse each |
| 19 | Accounting backfill (`accounting/backfill/route.ts`) | as #1, #7, #10 | | Skip set includes **Reversed** entries (`:32`), so docs broken by #8/#11 are never repaired | No | Errors counted as "skipped (already posted or invalid)" | — |
| 20 | Admin backfill-payments (`admin/backfill-payments/route.ts`) | no JE | | "any payment exists for enrollment" | No | 500 | Recreates payments that were deliberately deleted; method forced to Cash |
| 21 | Receivables POST migration (`receivables/route.ts:66-109`) | **Mutates posted lines** control → student AR, matched by **name** | | re-runnable | No | — | No |
| 22 | Entity import payments/expenses/enrollments (`import/[entity]/route.ts:122-280`) | no JE | | none | — | — | Only via backfill |
| 23 | Supplier create (`suppliers/route.ts:73-101`) | — | COA `openingCredit` with no offset | — | No | — | TB `openingImbalance` |
| 24 | Account opening edit (`accounts/[code]/route.ts:27-28`) | direct balance edit, no JE, no lock | | — | — | — | Rewrites history |
| — | Refund, credit note, discount, write-off, bad debt, advance application, revenue deferral | **No rule exists.** `refundAccount`/`discountAccount`/`badDebtAccount` are configurable but unused anywhere | | | | | |

### Classification review [ACCOUNTANT] [TAX AGENT]
- **Revenue at registration:** the full course fee is credited to revenue on `registrationDate` (#1). Fees billed in advance for a course delivered over weeks should normally be deferred and recognised as delivered. Suggested target: invoice to *Deferred course revenue* (liability), with release driven by `startDate`–`endDate` or completed hours.
- **Fees Advance** (#7 without enrollment) is never applied to an invoice or released, so it grows forever.
- **VAT:**
  - a single global `vatEnabled` flag ignores `Course.vatRate`/`priceExVat`;
  - there are no tax categories (standard / zero-rated / exempt / out-of-scope);
  - receipts in advance of an invoice create a tax point on receipt but post no VAT;
  - expense Input VAT is claimed with no supplier TRN or tax-invoice evidence (FTA Decision 13/2026 supplier verification from 1 Oct 2026; Cabinet Decision 149/2026 cash-payment input-tax restriction).
- **Tabby/Tamara/POS** receipts debit the "collection" accounts directly. There is no PSP clearing → payout with fees entry.
- **Security Deposits `1010400001`** sits under AR parent `10103`, so it appears in the receivables report.
- There are no sequential **tax invoice** or credit-note documents at all. `E-###` (enrollment id) is used as the invoice number.

---

## 4. Numbering

- `getNextSequence` is an atomic `$inc` + upsert (`Counter.ts:12-19`), so there are no duplicate numbers. `jvNumber`, `paymentId`, `expenseId`, `payoutNumber`, `billNumber`, `paymentNumber` all have unique indexes.
- **Gaps:** the sequence is reserved before `create()`. Failed creates leave gaps (`engine.ts:131-135`; `payments/route.ts:79-85`; `enrollments/route.ts:108-111`). Gaps are acceptable for JVs; they matter if `E-###` or `P-###` are treated as tax invoice or receipt numbers [TAX AGENT].
- **Duplicates of business meaning** (not number collisions): double-click payments, re-imported CSV vouchers, concurrent same-source postings (no unique index), concurrent payouts.
- `ensureStudentArAccount` (`postings.ts:46-70`) checks `enrollment.arAccountCode` and then creates, with no claim. Concurrent calls create orphan AR accounts. A counter/code collision throws, and the posting is silently dropped.
- JV list sorts by `jvNumber` string (`journal-entries/route.ts:40`). This is fine until JV-999999.

---

## 5. Metric-consistency table

| Screen / metric | Source query (file:line) | Basis | Agrees with ledger? | Divergence scenario |
|---|---|---|---|---|
| Dashboard "Revenue · period" | `Payment` Received, `$sum amount` by `datePaid` (`dashboard/page.tsx:166-174`) | Cash, **includes Refund type** | No | Refund 300 adds +300 revenue; edited payments count here but are missing from the ledger |
| Dashboard pending payments | `Payment` Pending/Overdue (`:175-178`) | Doc | n/a | — |
| Dashboard course breakdown revenue | `Enrollment.amountPaid` (`:219-221`) | Doc | No | Payments recorded on the Payments page never update `amountPaid` |
| Enrollments page "total revenue" | Σ `amountPaid` (`enrollments/page.tsx:303`) | Doc | No | Same |
| Payments page totals | `Payment` Received excl. Refund (`payments/route.ts:48-49`) | Cash | No | Differs from the dashboard by refunds |
| Finance "Total Revenue" | Ledger revenue accounts, excl. Reversed/Reversal (`finance/page.tsx:15-31,72`) | Accrual | Yes (TB) | Differs from dashboard/reports by (fees invoiced − cash received) |
| Finance month chart / course pie | `Payment` (`finance/page.tsx:87-120`) | Cash | No | Same page shows accrual tile + cash chart |
| Finance expenses / net | `Expense` docs (`:79-82,98-106,162`) | Doc | No | Teacher payouts and supplier bills are in the ledger but not in `Expense` docs, so net is overstated; net = accrual revenue − cash expenses (mixed basis) |
| Finance / Reports / Collections balances | `Enrollment totalFee − amountPaid` (`finance:128-134`, `reports:119-121,138-144`, `collections/route.ts:20-23,37`) | Doc | No | Probe P5: Collections **4,000** vs ledger receivables **1,500** vs accounting dashboard AR **0** |
| Reports "outstanding" | Σ(fee − paid) over **all** enrollments incl. Dropped and overpaid negatives (`reports/page.tsx:119-121`) | Doc | No | Differs from Collections, which excludes Dropped and non-positive balances |
| Reports revenue | `Payment` Received excl. Refund, `to+"T23:59:59"` **local** (`reports/page.tsx:29-37,51-53`) | Cash | No | Different day boundary from Finance/Dashboard (`...Z`) |
| Reports CSV export | `Payment` Received **incl. Refund** (`reports/export/route.ts:21,37`); net unrounded (`:54`) | Cash | No | CSV ≠ Reports page for the same range |
| Accounting dashboard AR | `net(settings.accountsReceivable)` = control account only (`accounting/dashboard/route.ts:54`) | Ledger | No | Student AR lives on child accounts, so the tile is ~0 (probe P5) |
| Accounting dashboard cash/bank/AP/revenue month | Ledger by `mainAccount` / `type`; `monthStart` in server-local time (`:17,42-53`) | Ledger | Partly | Month boundary in UTC on Vercel |
| Receivables report | Ledger children of `10103` excl. Reversed/Reversal (`receivables/route.ts:22-33`) | Ledger | Yes (TB) | Includes Security Deposits; deleted enrollment shows −3,500 |
| Trial Balance | `aggregateBalances` excl. Reversed/Reversal + COA openings (`trial-balance/route.ts`) | Ledger | — | Locked periods change retroactively; `balanced` checks period columns only (`:77`) |
| VAT report | Ledger **incl.** Reversed + Reversal (`vat-report/route.ts:25`); taxable = all non-VAT credit lines (`:45-47`) | Ledger | Totals yes, periods no | Probe P9: reversal shows taxable **+1,050** with VAT −50; sum of taxable 4,050 vs true 2,000 |
| GL dump / Register | Ledger incl. Reversed + Reversal (`gl-dump/route.ts:20`) | Ledger | Period totals ≠ TB | — |
| Supplier balances / statements | `openingBalance + Σbills − Σpayments` from docs (`suppliers/route.ts:17-48`, `suppliers/[id]/route.ts:44-52`) | Doc | No | Swallowed posting failures; negative opening balance not in COA |

**Timezone:**
- `buildDateFilter` (`lib/dateRange.ts`) uses `from` = UTC midnight and `to` = `T23:59:59.999Z`. A Dubai calendar day actually runs from 20:00Z the day before to 19:59:59.999Z.
- Presets use server-local time (UTC on Vercel; TZ not configured in `next.config.ts`/`package.json`: SUSPECTED).
- Auto receipts are stamped `new Date()`. A payment taken 01:30 Dubai on 1 Oct is stored 30 Sep 21:30Z and lands in **September** (and in the Q3 VAT period).
- `e.date.toISOString().slice(0,10)` displays the UTC date everywhere.

---

## 6. Recommended minimal safe fix order (no engine rewrite)

1. **Stop the bleeding (P0):**
   - replace `update.journalEntryId = undefined` with `$unset`;
   - reverse only on real changes (compare calendar days);
   - make backfill skip only Draft/Posted;
   - block Refund-type auto-posting until a refund rule exists;
   - reject `amountPaid` decreases;
   - lock checks before any reversal or CRM edit touching a locked-period entry.
2. **Visibility:**
   - `postSafely` → persist `postingStatus`/`postingError` on the source document and return a `warning`;
   - a read-only reconciliation endpoint listing documents with no active entry.
3. **Integrity:**
   - extract `validateEntry()` and use it in create, draft edit and post;
   - atomic reversal claim;
   - partial unique index on `(sourceType, sourceId)` for Draft/Posted;
   - `Idempotency-Key` on POSTs;
   - atomic session claim for payouts;
   - Mongo transactions (Atlas supports them) around document + entry.
4. **Reports:**
   - one Dubai-day date helper;
   - include reversal pairs by their own dates in period balances;
   - AR tile = all AR children;
   - make Collections/Reports read `amountPaid` derived from payments, or from the ledger.
5. **Accounting design [ACCOUNTANT/TAX AGENT]:** deferred revenue, tax categories, refund/credit-note/write-off rules, advance application, PSP clearing, integer fils (dinero.js/decimal.js) at API boundaries.

### Data repair (read-only detection first, then reviewed JVs)
- Received payments whose `journalEntryId` points to a Reversed entry and which have no Posted Receipt for `sourceId` → missing receipts. Same check for Expenses.
- Enrollments where Σ Received payments ≠ `amountPaid`.
- Duplicate Payments: same student, amount, method, `datePaid` within 60 s.
- Payment docs with `paymentType: "Refund"` and a Posted Receipt → each is misstated by 2× amount.
- More than one Reversal per original (`reversesEntryId` duplicates).
- Posted entries with `lines.length < 2`, a line with debit and credit both > 0, or totalDebit ≠ Σ lines.
- Posted entries dated ≤ lockDate but created or reversed after the lock was set (`createdAt`/`postedAt` > settings `updatedAt` when the lock was set).
- TeacherPayouts sharing session ids.
- Reconcile: Σ student AR ledger balances vs Σ(fee − amountPaid); cash ledger vs Σ Received payments − expenses − payouts − supplier payments.

---

## 7. Tests: coverage and gaps

**Covered today** (`tests/accounting/*.test.ts`, 64 passing):
- engine validation on create (balance, two-sided line, negative, zero, unknown/parent/inactive account);
- lock on create (date-only);
- duplicate-source guard (sequential);
- draft→post;
- reversal sides and links;
- aggregate/ledger exclusion of reversal pairs;
- each posting helper's Dr/Cr;
- `postSafely` swallowing;
- COA seed structure;
- payroll rate resolution.

**Missing (critical):**
- Route-level: payment edit → exactly one Posted receipt with the new amount; notes-only edit → no reversal; expense edit reposts with a recomputed VAT split.
- Refund payment must not debit cash (or must be rejected).
- Enrollment `amountPaid` down/up cannot create duplicate receipts; payments update `amountPaid`; delete with payments is blocked.
- Lock: reversal of a locked entry rejected; CRM edit of a locked document rejected; entry on the lock day rejected; draft date moved into a locked period → post rejected; locked-period TB is identical before/after any API call.
- Draft edit/post re-validation (single line, both sides, empty, inactive account).
- Concurrency: `Promise.all` double reverse → one reversal; double payment POST with the same idempotency key → one; concurrent payouts → one; concurrent same-source posting → one (unique index).
- Property-based (fast-check): random sequences of create/edit/delete/reverse keep Σ debit = Σ credit for every date window; AR control/children balance = Σ(fee − paid); reversal + original nets to zero per account; VAT split sums to gross for any 2dp amount; half-up rounding at .xx5 boundaries.
- Reports: Dubai-day boundaries (23:30 Dubai on the 30th vs 00:30 on the 1st); TB = VAT report = GL dump per period; accounting dashboard AR = receivables total; Collections = receivables for a clean dataset.
- Backfill idempotency after reversals; CSV import re-upload idempotency; admin backfill-payments does not resurrect deleted payments.
