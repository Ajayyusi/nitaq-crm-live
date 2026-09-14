> **Audit document — generated during the full-system audit on 2026-09-14 (branch `audit/full-system-debug`).**
> File:line references point at the code as it was at commit `b2962a9`, before the audit fixes.
> Many findings below are now fixed — the authoritative status of every issue is the register in [SYSTEM_AUDIT.md](../../SYSTEM_AUDIT.md).

# Trainer Payroll Audit

Repository: `C:\Users\User\nitaq-crm-live` - branch `audit/full-system-debug` @ b2962a9
Date: 2026-09-14 - Mode: read-only (no repo files changed, no real DB touched)
Test run: `npx vitest run tests/accounting/payroll.test.ts` -> 13/13 pass. The suite only covers
`previewTeacherPayout()`. Nothing tests the POST route, concurrency, edits/deletes of paid
sessions, monthly repeat payments, or journal posting.

## 1. How payroll works today (as built)

- There is **no payroll period**. `previewTeacherPayout(teacher)` (lib/payroll.ts:71-232) loads
  *every* ClassSession for the teacher with `payoutId` null/missing (payroll.ts:72-78). There is
  no date filter.
- Payable sessions are `classStatus in {Completed, No Show}` (payroll.ts:14-16). Attendance status
  and the separate `AttendanceSession` collection are ignored.
- Sessions are grouped by `enrollmentId`. The rate is `enrollment.teacherPayRate` when it is > 0,
  otherwise `teacher.paymentRate` (payroll.ts:143-146).
  - Per Hour: `round2(sum(deliveredHours)) * rate`.
  - Per Class: `sessionCount * rate`.
  - Fixed for Course / Per Course: `rate` once, unless *any* session of that enrollment already has a
    `payoutId` (payroll.ts:156-171).
  - Monthly (teacher level only): `suggestedAmount = teacher.paymentRate`, always
    (payroll.ts:102-129).
- `deliveredHours` is typed by the user. The drawer pre-fills it from end minus start
  (ClassHistoryDrawer.tsx:103-110), and the server only rounds it to 2 dp (class-sessions/route.ts:103).
- POST /api/teacher-payouts (route.ts:70-210):
  1. recompute the preview;
  2. take `amount` **from the body** (it may differ if a reason of 3+ characters is given);
  3. create TeacherPayout;
  4. `updateMany` stamps `payoutId` on the previewed sessions;
  5. post Dr salary / Cr cash. If posting fails, the payout and stamps are **kept**.
- There is no PATCH/DELETE/void route for payouts. HourAdjustment changes only
  `Enrollment.completedHours` (student side) and has no payroll effect.
- Money is JS `number` / Mongoose `Number` throughout, rounded with `Math.round(n*100)/100`.

## 2. Scenario table

| # | Scenario | Current behaviour | Correct? | Evidence |
|---|---|---|---|---|
| S1 | Hourly trainer | Sum of unpaid Completed/No Show `deliveredHours` (rounded to 2 dp) x rate. 3.5h x 100 = 350 (tested). | Yes, for the arithmetic. Rounding uses float and binary half-up (see S27). | payroll.ts:148,176-180; test :69-79 |
| S2 | Per-class trainer | Session count x rate. Hours ignored. | Yes | payroll.ts:172-175; test :81-89 |
| S3 | Fixed-course trainer | Rate paid once per enrollment. Suppressed if any session of the enrollment has a payoutId. | Partly. The guard is derived from session rows that can be deleted, and it ignores teacher and basis history (S16, S17, S18). | payroll.ts:156-171 |
| S4 | Salaried (Monthly) trainer | Always suggests the full salary. No month or period is recorded. It stays "due" immediately after being paid. POST allows it with zero sessions. | **No. The same month can be paid again at any time.** | payroll.ts:102-129; route.ts:33,89 |
| S5 | Enrollment-specific override | Used when `teacherPayRate > 0`. Basis comes from the enrollment. | Yes (tested) | payroll.ts:143-146; test :103-151 |
| S6 | Fallback to trainer default | Used when the enrollment rate is unset **or 0**. | Partly. An explicit 0 ("not paid on this enrollment") silently falls back to the default. | payroll.ts:144-145; enrollments/[id]/route.ts:115-124 (0 allowed) |
| S7 | Override with rate but no basis | `normalizeBasis(undefined)` gives "Per Hour", not the trainer's basis. | No (API-only; the UI always sends a basis) | payroll.ts:56-58,146; enrollments/route.ts:139-146 |
| S8 | Missing rate | Rate 0 gives amount 0 and a note. The admin can type any amount with a reason, and **all** sessions are stamped. NaN is rejected by Mongoose cast. A **negative** teacher rate is accepted and produces negative lines that offset other lines without a warning. | No for negative rates. Rate 0 is acceptable but weak. | payroll.ts:182,207-211; Teacher.ts:62 (no min); teachers/[id]/route.ts:67-69; teachers/route.ts:72 |
| S9 | Cancelled / dropped enrollment | Enrollment status is ignored. Delivered sessions still pay (correct). A Fixed fee is paid in full after one session even if the student drops. | Needs a business decision | payroll.ts:131-199 (no status read) |
| S10 | Enrollment deleted | Sessions are not cascaded. The group has no enrollment, so the **teacher default** rate and basis apply instead of the enrollment's own. | No | enrollments/[id]/route.ts:285; payroll.ts:142-146,187 |
| S11 | Cancelled session | Not payable | Yes | payroll.ts:14-16; test :197-209 |
| S12 | No Show session | Payable (the teacher is paid). "No Show" does not say *who* failed to show. | Needs a business decision | payroll.ts:9-16 |
| S13 | Duplicate session for the same slot | Unique index `{enrollmentId, teacherName, classDate, startTime}` applies only when `startTime` is a string. `startTime` is optional, so without it duplicates are accepted and both are paid. The index keys on `teacherName` (mutable), not `teacherId`. | No | ClassSession.ts:62-66; class-sessions/route.ts:131 |
| S14 | Trainer self-records sessions | A trainer can POST Completed or No Show with any hours and any date. The remaining-hours cap applies only to *charging* sessions and only when `totalRegisteredHours > 0`, so No Show is uncapped. No approval step exists before payroll. | No | class-sessions/route.ts:69-79,103-122,130; payroll.ts:80 |
| S15 | Hours corrected via HourAdjustment after a payout | No payroll effect at all (student hours only). | No. There is no teacher-pay correction path. | hour-adjustments/route.ts:61-64; hours.ts:45-49 |
| S16 | Paid session edited (hours/status/date) | Allowed with no `payoutId` check. The payout snapshot and session disagree. There is no clawback or top-up. The UI cannot see the paid state (serializer omits `payoutId`). | No | class-sessions/[id]/route.ts:29-46; serializers.ts:241-261 |
| S17 | Paid session deleted | Allowed. For hourly/class pay, re-recording it pays it again. For Fixed, deleting the only stamped session reopens the fee. | **No (double payment)** | class-sessions/[id]/route.ts:86; payroll.ts:159-162 |
| S18 | Fixed fee already paid, then enrollment rate/basis changed or cleared | Changing to Per Hour, or clearing (fallback to teacher hourly), pays the remaining sessions again on top of the fixed fee. Changing Per Hour to Fixed after hourly payouts shows "already paid" (fee never paid). | No | payroll.ts:143-171; enrollments/[id]/route.ts:115-129 (no lock) |
| S19 | Fixed fee with co-teachers | The guard is enrollment-wide and ignores `teacherId`. If A and B both have unpaid sessions, both previews show the full fee (paid twice). If A is paid first, B gets 0 forever. | No (inconsistent; business rule undefined) | payroll.ts:159-162 |
| S20 | Payroll re-run for a period already processed | No period concept. TeacherPayout has a non-unique `{teacherId, paidDate}` index, no period key, and no idempotency key. Per-session bases are protected only by sequential session stamps. Monthly is not protected. | No | TeacherPayout.ts:93; route.ts:110-158 |
| S21 | Concurrent double submit (two tabs, two admins, proxy retry) | Both requests preview the same unpaid sessions, both create payouts, and both post JVs. `updateMany` has no `payoutId: null` filter, so the last writer wins. The client disables the button only within one tab. | **No (double payment)** | route.ts:86,114-158; page.tsx:290-293 |
| S22 | Month boundary / timezone | Payroll has no date filter, so it is unaffected. Period labels use UTC `toISOString`. The payouts page defaults `paidDate` to the **UTC** date, so paying at 01:00-03:59 Dubai on the 1st defaults to the previous month's last day. The drawer defaults `classDate` the same way. A trainer POST without a date stores `new Date()` (UTC instant). | No (wrong expense period; can hit lockDate) | page.tsx:55,84; ClassHistoryDrawer.tsx:78; class-sessions/route.ts:130; payroll.ts:85-89 |
| S23 | Partial payout | Not supported. Paying 400 of a 1,000 suggestion (with a reason) stamps all sessions, and the 600 balance disappears from "due". | No | route.ts:93-100,153-158 |
| S24 | Amount server-computed vs client-trusted | The server computes the suggestion but **posts the client amount** (any positive value, no ceiling, no second approver, 3-character reason). | No | route.ts:87-100,170-171 |
| S25 | Payout deletion/edit and journal effect | No route exists. Reversing the JV in accounting leaves the payout "paid" and the sessions locked. The reversal is dated today. | No correction path | route.ts (GET/POST only); engine.ts reverseJournalEntry |
| S26 | Journal posting fails (locked period, inactive account, bad code) | The payout and stamps are committed first. Then 201 with a warning. The ledger misses the expense and there is no repost. The lockDate check runs only inside `createJournalEntry`, after the writes. | No | route.ts:114-189; engine.ts:109-115 |
| S27 | Money representation / rounding | `number` floats. `round2(83.325)` gives 83.32 (float representation), where half-up gives 83.33. | No (safety rule 2/3) | payroll.ts:5; TeacherPayout.ts:56-81 |
| S28 | Rate or basis changed while sessions are unpaid | The new rate applies retroactively to all unpaid sessions. Switching a teacher to Monthly absorbs earlier hourly sessions into the salary. | No (not effective-dated) | payroll.ts:82-84,102-129 |
| S29 | Trainer set Inactive or deleted with unpaid work | GET lists only Active teachers, so the owed amount is hidden from "due". Teacher delete leaves orphan sessions that cannot be paid. | No | route.ts:22; teachers/[id]/route.ts:90 |
| S30 | Expense recognition | Cash basis: Dr salary on `paidDate`. No accrued payable at month end, and no link from a Monthly payout to its month. | Needs an accountant | route.ts:162-174 |
| S31 | Account codes from body | `expenseAccountCode`/`paymentAccountCode` are only checked to exist as posting accounts, not by type (for example, Cr a student AR account). | No | route.ts:103-106; engine.ts:98-107 |

## 3. Issues

See the final agent message for the issue table (ID, severity, file:line, failure scenario, fix, tests).

## 4. Items needing a licensed accountant / UAE labour or tax adviser

1. Cash vs accrual recognition of trainer pay (accrued teacher payable at period end) - S30.
2. Employee vs freelancer trainers. For salaried employees: WPS salary file, end-of-service gratuity
   accrual under UAE labour law, and whether "Monthly" payouts are a payroll run rather than an expense.
3. Whether freelance trainer invoices carry input VAT (trainer VAT-registered). The current posting has no
   VAT line.
4. Business policy (not tax): does No Show pay; when a Fixed fee is earned (upfront, on completion,
   pro-rata); clawback on Dropped; how co-teachers split a Fixed fee.
