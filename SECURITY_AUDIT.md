# Nitaq CRM — Security Audit

> Full-system audit, 2026-09-14, branch `audit/full-system-debug` (base commit `b2962a9`).
> Scope: all 72 route files (125 method+path handlers), `auth.ts`, `auth.config.ts`, `proxy.ts`,
> `lib/api-auth.ts`, `lib/permissions.ts`, rate limiting, TOTP, impersonation, audit logging,
> import/export, dependency advisories and git history.
> The per-endpoint inventory (roles, validation, reads/writes, side effects, caller) is in
> [docs/audit/API_INVENTORY.md](docs/audit/API_INVENTORY.md). The overall issue register is in
> [SYSTEM_AUDIT.md](SYSTEM_AUDIT.md).

## 1. Summary

Every API route authenticates (70 of 72 through `requireAuth`, the other two are the NextAuth
handler and the impersonation-exit route, which checks the session itself). No NoSQL operator
injection or ReDoS was found: every `RegExp` built from input is escaped, filters use
allow-listed enums, and no request body is spread into a create/update. No secrets were found in
96 commits (gitleaks), and `.env.local` has never been committed.

The real problems were **authorization gaps where the API was weaker than the UI**, **sessions
that outlived deactivation or demotion**, **financial and admin writes with no audit trail**,
and **a critical Next.js advisory**. The most serious of these are fixed on this branch.

| | Before | After this branch |
|---|---|---|
| Deactivated / demoted user, DB lookup fails | API **fails open** to the token's role | **503**; last state verified ≤ 15 min ago is still honoured |
| Unknown / missing role on an account | silently treated as `sales` | **403** |
| Sales reading `/api/enrollments` | every student's Emirates ID, fees, balance | **403** |
| Trainer reading their students | full record incl. Emirates ID, fee, balance | redacted view |
| Sales exporting leads / follow-ups | every salesperson's pipeline | own records only, export audited |
| Impersonated session after the admin is demoted | stays valid 8 h, can mint admin return ticket | **401** on every API call and on exit |
| Next.js | 16.3.0 — critical RCE advisories | 16.3.5 |
| Audit write | fire-and-forget, errors swallowed, lost on serverless freeze | awaited, clipped to schema, failures logged with the full event |

## 2. Authentication

### 2.1 Session validation — `lib/api-auth.ts`
JWT sessions (8 h) cannot be revoked, so `requireAuth` re-reads `active` and `role` from the
database (60 s cache).

**Finding (fixed):** when that lookup threw, the function returned `{ active: true }` and fell back
to the role in the token. During any database hiccup a deactivated user kept full API access and a
demoted user kept their old role. For a system holding student PII, payroll and the books, failing
open is not acceptable.

**Fix:** fail closed with a bounded grace period — if the database can't be reached, a state that was
successfully verified within the last 15 minutes is still honoured (so a brief blip doesn't lock
everyone out), otherwise the request gets **503**. A session with no user id is refused (401), and
an account whose role is missing or not in `ALL_ROLES` gets **403** instead of defaulting to
`sales`. Tests: `tests/api/finance-routes.test.ts` → "requireAuth fails closed" (deactivated → 401,
demoted → 403, DB error → 503, no session → 401).

**Still open (SEC-04, P1):** server-rendered pages (`dashboard`, `finance`, `reports`) and the
`proxy.ts` page guard use the **token** role and never re-check the database, so a deactivated
finance user can still load server-rendered financial pages until the token expires. Fix: a
`requireSession()` helper for server pages that calls the same live check, plus a
`tokenVersion`/`sessionsValidAfter` field on `User` checked in the `jwt` callback so a password
change, deactivation or role change invalidates existing tokens.

### 2.2 Login, brute force and 2FA
- Login throttling (`lib/rate-limit.ts`) is in-memory and per serverless instance, keyed by email
  only; the limit multiplies across instances, and anyone can lock a known email out for 15 minutes.
  **Open (SEC-06, P2):** move to a shared store (a Mongo TTL collection is enough) keyed by email+IP.
- TOTP 2FA is optional for every role, including admin, finance and accountant. **Open (SEC-06):**
  require it for privileged roles.
- The dummy bcrypt hash used for unknown emails is cost 10 while real hashes are cost 12, so unknown
  accounts answer ~4× faster (account enumeration by timing). **Open (SEC-16, P3).**
- No TOTP replay protection; `otp_required` tells a caller the password was right. **Open (SEC-17, P3).**
- Enabling 2FA does not require the current password, so an impersonating admin or a session thief
  can bind their own authenticator. **Open (SEC-18, P3).**
- `assessor`, `iqa`, `eqa` and `accountant` cannot change their own password (role list on
  `/api/users/me/password`); a password change does not revoke other sessions. **Open (SEC-19, P3).**

### 2.3 Impersonation
Minting is admin-only, the ticket is 32 random bytes, valid 60 s, consumed atomically once, and the
target must be an active non-admin — all good.

**Finding (partly fixed, SEC-05):** the impersonated session carried an admin identity for 8 hours.
`/api/impersonate/exit` minted an admin return ticket for anyone holding that cookie, and it only
checked that the admin was *active* — not still an admin. Deactivating or demoting the admin did not
end sessions they had opened as other users.

**Fixed:** `requireAuth` now verifies on every API call that the impersonating operator is still an
active **admin** (401 otherwise), and the exit route requires the same. Test:
`tests/api/crm-security-routes.test.ts` → "impersonation".
**Still open:** record impersonation server-side (a session document with `jti`) so exit is
single-use, cap impersonated sessions at ~30 minutes, and require admin re-authentication on return.

## 3. Authorization (RBAC)

`lib/permissions.ts` drives sidebar and page access; each API route declares its roles inline. The
audit compared sidebar → page → API GET/POST/PATCH/DELETE → export for every module.

### 3.1 API weaker than the UI

| ID | Sev | Module | Problem | Status |
|---|---|---|---|---|
| SEC-02 | P0 | Enrollments | `GET /api/enrollments` and `/[id]` allowed **sales** (the page is blocked for sales) and returned Emirates ID, nationality, fees, balance and trainer pay rate for every student. No sales screen calls it. | **Fixed** — sales removed; trainers get `serializeEnrollmentForTrainer` (ID documents and money blanked). Tests: "who can read student records". |
| SEC-03 | P1 | Export | `/api/export/leads` and `/followups` ran `find({})` — sales exported every salesperson's pipeline, while `/api/leads` filters to their own. | **Fixed** — owner filter for sales; every export is audited. Test: "exports". |
| SEC-29 | P1 | Leads | Sales setting a lead's stage to *Enrolled* auto-created an Enrollment, bypassing the admin/manager-only `POST /api/enrollments` and the enrollment-request approval. | **Fixed** — 403 for sales. Test: "lead → enrollment conversion". |
| SEC-09 | P2 | Expenses | Finance could book an "expense" to any posting account — a bank, cash or a student's receivable. | **Fixed** — must be an Expense account or a non-cash, non-receivable Asset. Test: "refuses a cash account as the expense account". |
| SEC-14 | P2 | Compliance | Any assessor/IQA can read every learner's passport/visa numbers and change grades on assessments assigned to someone else. | **Open** — needs an assignment model (`assessorId`/`iqaId` scoping). |
| SEC-23 | P3 | Attendance | A trainer's PATCH doesn't filter records to their own students; trainers can DELETE registers. | **Open.** |
| SEC-24 | P3 | Class sessions | Edit notifications go to `roleTarget: "trainer"` — every trainer learns another trainer's student, course and date. | **Open.** |
| SEC-22 | P3 | Leads, follow-ups, attendance | Ownership is matched by **display name**; two users with the same name share records, a rename transfers access, and an impersonated create is assigned to "Name (via Admin)". | **Open** — store `assignedToUserId`/`teacherId`. |

### 3.2 API stricter than the UI (broken screens, not a leak)
Courses page for assessor/iqa/eqa (API 403); Teacher Pay "Mark Paid" for finance (API is
admin/manager); accounting seed/backfill buttons shown to manager (API 403); password change offered to
roles the API excludes; Students/Classes import-export tabs 403 for every role (no permission key);
`/document-control` has permission rules but no page. **Open (P3)** — align `lib/permissions.ts`
with the routes.

## 4. Data integrity controls that are also security controls

| ID | Sev | Problem | Status |
|---|---|---|---|
| SEC-08 | P2 | `amountPaid` could be lowered then raised on an enrollment, posting a second receipt for the same money. | **Fixed** — decreases refused, conditional update. |
| SEC-10 | P2 | Journal draft edits skipped validation; posting didn't re-check the lock date. | **Fixed.** |
| SEC-11 | P2 | Teacher payout race paid the same sessions twice. | **Fixed** — atomic session claim. |
| SEC-25 | P3 | Receivables "migration" rewrote posted journal lines in place by student name. | **Fixed** (route retired, 410). Opening-balance edits after posting, lock-date changes without before/after audit, and supplier payments against another supplier's bill remain **open**. |
| SEC-13 | P2 | CSV import of payments/enrollments creates "Received" money with no ledger posting, no duplicate check, no audit. | **Open** — route imports through the same services as single-record routes, or restrict to admin. |
| SEC-28 | P3 | `admin/backfill-payments` recreates payments an admin deliberately deleted, with no posting or audit. | **Open** — retire after running the migration scripts. |

## 5. Audit logging

**Finding (fixed):** `logAudit` was fire-and-forget with errors swallowed. On Vercel the invocation
can be frozen once the response is sent, so events could be lost silently; over-long labels or empty
required fields failed schema validation and vanished. Many critical writes had no audit call at all:
payment creation, every expense change, user creation / role change / deactivation / password reset /
deletion, exports, journal draft edits.

**Fix:** `logAudit` is `async` and awaited at all 49+ call sites; it clips values to the schema limits,
never throws (the business write it describes has already committed, so failing the request would
misreport what happened), and on failure logs the complete event at error level so it can be re-entered.
Audit calls were added to payments POST, expenses POST/PATCH/DELETE, users POST/PATCH/DELETE,
exports and draft journal edits; payouts, payments and enrollments now record before → after amounts.

**Still open (SEC-12, P2):**
- Audit rows store a display name, not the actor's user id or the impersonator's id.
- No before/after snapshot for most entities; no login success/failure events.
- Imports, courses, teachers (incl. pay-rate changes), attendance, enrollment requests and settings
  changes are not audited.
- True atomicity (audit inside the same transaction as the write) needs MongoDB transactions — see
  SYSTEM_AUDIT.md "Transactions".

## 6. Injection, XSS, CSRF, leakage

| ID | Sev | Problem | Status |
|---|---|---|---|
| SEC-07 | P2 | CSV exports didn't neutralise `= + - @` — a lead named `=HYPERLINK(...)` executes when a manager opens the export in Excel. | **Fixed** in `csvEscape`; real numbers stay numeric. Tests in `tests/utils/csv.test.ts`. |
| SEC-20 | P3 | ~60 handlers returned raw `err.message` — duplicate-key errors expose collection, index and another user's value; network errors expose hostnames. | **Partly fixed** — `lib/api-error.ts` hides driver errors; applied to payments, expenses, enrollments and teacher payouts. Remaining routes **open**. |
| SEC-21 | P3 | No Content-Security-Policy; JSON APIs rely only on SameSite=Lax cookies (no Origin check). | **Open.** |
| SEC-26 | P3 | JV attachment size checked after the entry is created (possibly posted) — a retry posts a duplicate. | **Open.** |
| SEC-27 | P3 (suspected) | Login `callbackUrl` check may accept `/\evil.com`. | **Open** — parse with `new URL(raw, origin)` and compare origins. |
| SEC-30 | P4 | `proxy.ts` matcher skips any path ending in an image extension (page guard only; APIs unaffected). | **Open.** |
| SEC-31 | P4 | `/api/settings` GET labelled public; no body-size limits on logo/JSON; stale `ENABLE_SETUP`; dead call to a deleted route. | **Open.** |

## 7. Dependencies and repository

| ID | Sev | Problem | Status |
|---|---|---|---|
| SEC-01 | P0 | `next` 16.3.0 was inside the range of two critical advisories (unauthenticated RCE on Windows-hosted servers, GHSA-p293-qw3h-jr36; RCE in image optimisation with AVIF, GHSA-2xp9-vwfh-vxw4). `/_next/image` is outside the auth proxy. | **Fixed** — upgraded to 16.3.5 (same minor). `npm audit --omit=dev` still reports 1 high and 1 moderate transitive advisory; review with `npm audit`. (`npm audit fix` itself crashed with an npm internal error, so the upgrade was pinned explicitly.) |
| SEC-15 | P2 | `leads_import.csv` — 83 rows of prospective students' names and phone numbers — is committed (commit `a08f1be`). Every clone keeps it. | **Open — owner decision.** Removing it from history (`git filter-repo`) rewrites history and needs every clone re-cloned; also consider whether a data-protection notification is required. Add `*.csv` to `.gitignore`. Not changed by the audit. |

## 8. Recommended order for the open items

1. **Now:** decide SEC-15 (PII in git history); SEC-04 server-page live check + token versioning;
   require 2FA for admin/finance/accountant; shared login rate limit.
2. **Next:** SEC-12 audit actor ids + before/after + import/settings/course/teacher coverage;
   SEC-13 imports through posting services; SEC-14 assessor/IQA scoping; SEC-22 ownership by user id;
   apply `apiError` to the remaining routes.
3. **Later:** CSP + Origin checks, impersonation server-side sessions with short TTL, TOTP replay
   protection, align page permissions with API permissions.
