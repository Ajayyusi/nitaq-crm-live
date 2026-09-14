> **Audit document — generated during the full-system audit on 2026-09-14 (branch `audit/full-system-debug`).**
> File:line references point at the code as it was at commit `b2962a9`, before the audit fixes.
> Many findings below are now fixed — the authoritative status of every issue is the register in [SYSTEM_AUDIT.md](../../SYSTEM_AUDIT.md).

# Nitaq CRM - API Inventory

Role codes: A=admin M=manager S=sales F=finance T=trainer AS=assessor I=iqa E=eqa AC=accountant. any = any logged-in role.
Auth: every route sits behind the proxy.ts login gate (for /api/* the proxy only checks logged-in). Role checks are per route via lib/api-auth.ts requireAuth(): live DB role/active, 60s per-instance cache, FAIL-OPEN to the JWT role if the DB lookup throws.
Errors: msg = try/catch returns err.message (leaks Mongoose/Mongo text); uncaught = no try/catch (Next generic 500); generic = fixed message.
Audit: Y = lib/audit.ts logAudit (fire-and-forget, errors swallowed, stores userName + role only).

| # | Method | Path | Roles (requireAuth) | Validation | DB reads | DB writes | Side effects | Audit | Errors | Response | Client caller |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET,POST | /api/auth/[...nextauth] | public | credentials: email/pw/otp; impersonate: token | User(active), ImpersonationToken | User.lastLogin; token.usedAt | JWT cookie 8h; in-memory rate limit 10/15min per email | N (no login audit) | typed CredentialsSignin codes | NextAuth | app/login/LoginForm.tsx, app/impersonate/page.tsx |
| 2 | GET | /api/accounting/accounts | A,AC,M | type enum; search escaped regex | ChartOfAccount, JE aggregate | - | - | N | uncaught | accounts with balances | accounting/coa, accounting/page, expenses/page, components/accounting/shared |
| 3 | POST | /api/accounting/accounts | A,AC | code/name required, type enum, dup code, parent exists | COA | COA create (opening Dr/Cr from body) | - | Y | msg 400 | account 201 | accounting/coa |
| 4 | PATCH | /api/accounting/accounts/[code] | A,AC | name non-empty | COA | COA name/isActive/openingDebit/openingCredit | changes historical TB | Y (no before/after) | msg 400 | account | accounting/coa |
| 5 | DELETE | /api/accounting/accounts/[code] | A,AC | not isSystem, unused, no children | COA, JE | COA delete | - | Y | uncaught | message | accounting/coa |
| 6 | POST | /api/accounting/backfill | A,AC | COA non-empty | Enrollment, Payment, Expense, JE | JE create, journalEntryId links | bulk GL postings, per-item errors swallowed | Y (summary) | uncaught | message, counts | accounting/page (button not role-gated) |
| 7 | GET | /api/accounting/dashboard | A,AC,M | - | settings, COA, JE agg | - | - | N | uncaught | cash/bank/AR/AP/VAT/profit | accounting/page |
| 8 | GET | /api/accounting/gl-dump | A,AC,M | from/to via buildDateFilter | JE (Posted,Reversed) | - | CSV via csvEscape (no formula neutralisation) | N (export unaudited) | uncaught | JSON rows or CSV | accounting/register |
| 9 | GET | /api/accounting/journal-entries | A,AC,M | status/sourceType/jvNumber raw strings; limit max 500 | JE | - | - | N | uncaught | entries incl lines | accounting/journal, accounting/page, EntryListPage |
| 10 | POST | /api/accounting/journal-entries | A,AC | engine: 2+ lines, balanced, non-negative, active posting accounts, lock date, dup source; attachment size (1.5MB base64) CHECKED AFTER the entry is created | COA, settings, JE | JE create (Draft/Posted), attachment | GL posting if post=true; sourceType Receipt/Invoice/Expense selectable manually | Y | AccountingError 400 else msg 500 | entry 201 | accounting/journal, EntryListPage |
| 11 | GET | /api/accounting/journal-entries/[id] | A,AC,M | ObjectId | JE (+attachment) | - | ?attachment=1 streams file with stored mimeType, disposition attachment | N | uncaught | entry or file | accounting/voucher/[id], journal |
| 12 | PATCH | /api/accounting/journal-entries/[id] | A,AC | action post/reverse/cancel; draft edit checks only account exists + isPosting (no negative, both-sides, active or lock-date checks) | JE, COA | JE status/lines/date | post (no lock-date recheck), reverse (new JE) | Y except draft edit | AccountingError 400 else msg 500 | entry | accounting/journal, voucher/[id] |
| 13 | POST | /api/accounting/journal-entries/import | A,AC | rows grouped by voucher; engine validation per group | COA, settings | JE create (Draft or Posted) | bulk GL | Y (summary) | msg 400 | created, total, results | accounting/journal |
| 14 | GET | /api/accounting/ledger | A,AC,M | account required and exists | COA, JE | - | - | N | uncaught (Invalid Date gives 500) | account, rows | accounting/ledger |
| 15 | GET | /api/accounting/receivables | A,AC,M | - | COA (parent 10103), JE agg, settings | - | - | N | uncaught | students, totals | accounting/receivables |
| 16 | POST | /api/accounting/receivables | A,AC | - | Enrollment, COA, JE | COA create per student; MUTATES lines of POSTED JEs (matched by student name) | GL history rewrite | Y (count) | uncaught | message, moved | accounting/receivables (canEdit) |
| 17 | POST | /api/accounting/seed-coa | A,AC | idempotent by code | COA, Supplier | COA, Supplier, settings | - | Y | uncaught | message | accounting/page (button not role-gated) |
| 18 | GET | /api/accounting/settings | A,AC,M | - | AccountingSettings | - | - | N | uncaught | settings | accounting/settings |
| 19 | PATCH | /api/accounting/settings | A,AC | account codes exist; vatRate non-negative; courseRevenueMap object unvalidated; lockDate set or CLEARED | COA | settings incl lockDate | changes future auto-postings / can unlock closed periods | Y (no detail) | msg 400 | settings | accounting/settings |
| 20 | GET | /api/accounting/supplier-bills | A,AC,M | status raw | SupplierBill | - | - | N | uncaught | bills | accounting/suppliers |
| 21 | POST | /api/accounting/supplier-bills | A,AC | supplier exists, amount positive, vat non-negative, expense account | Supplier | SupplierBill, JE (postSafely) | GL Dr expense / Cr supplier | Y | msg 400 | bill 201 | accounting/suppliers |
| 22 | GET | /api/accounting/supplier-payments | A,AC,M | - | SupplierPayment | - | - | N | uncaught | payments | accounting/suppliers |
| 23 | POST | /api/accounting/supplier-payments | A,AC | supplier exists, amount positive, account required; billId NOT checked against supplier; no overpayment guard | Supplier, SupplierBill | SupplierPayment, SupplierBill.amountPaid/status, JE (postSafely) | GL; CRM record kept if posting fails | Y | msg 400 | payment 201 | accounting/suppliers |
| 24 | GET | /api/accounting/suppliers | A,AC,M | - | Supplier, bill/payment agg | - | - | N | uncaught | suppliers | accounting/suppliers |
| 25 | POST | /api/accounting/suppliers | A,AC | name, dup code | Supplier, COA, settings | Supplier, COA (openingCredit) | - | Y | msg 400 | supplier 201 | accounting/suppliers |
| 26 | GET | /api/accounting/suppliers/[id] | A,AC,M | ObjectId | Supplier, bills, payments | - | - | N | uncaught | statement, aging, raw supplier doc | accounting/suppliers |
| 27 | PATCH | /api/accounting/suppliers/[id] | A,AC | whitelisted fields | Supplier | Supplier, COA name/isActive | - | Y | msg 400 | supplier | accounting/suppliers |
| 28 | GET | /api/accounting/trial-balance | A,AC,M | type raw | COA, JE agg | - | - | N | uncaught | rows, totals, openingImbalance | accounting/trial-balance |
| 29 | GET | /api/accounting/vat-report | A,AC,M | date filter | settings, JE | - | - | N | uncaught | VAT totals + transactions | accounting/vat |
| 30 | GET | /api/activity | A,M | user escaped regex; entity string; limit min(n,200) (NaN possible) | AuditLog | - | - | N | uncaught | logs (raw docs) | activity/page |
| 31 | POST | /api/admin/backfill-payments | A | - | Enrollment (amountPaid positive), Payment | Payment create (Cash/Received) | NO GL posting | N | msg 500 | created, skipped | settings/page |
| 32 | POST | /api/admin/impersonate | A | userId/teacherId ObjectId; target active, not admin, not self | User, Teacher | ImpersonationToken (32 bytes, 60s) | returns /impersonate?token= | Y | msg 500 | url, targetName, targetRole | teachers/page (isAdmin) |
| 33 | POST | /api/admin/migrate-roles | A | - | - | User.updateMany staff to sales | - | N | msg 500 | migrated | settings/page |
| 34 | GET | /api/assessments | A,M,I,E,AS | ids ObjectId; status raw | LearnerAssessment | - | - | N | uncaught | assessments (no assessor scoping) | assessments/page |
| 35 | POST | /api/assessments | A,M,AS,I | profile/qualification ObjectId, unitCode | - | LearnerAssessment (assessorId from body) | - | Y | msg 400 | assessment 201 | assessments/page |
| 36 | GET | /api/assessments/[id] | A,M,I,E,AS | ObjectId | LearnerAssessment | - | - | N | uncaught | assessment | (no fetch caller found) |
| 37 | PATCH | /api/assessments/[id] | A,M,AS,I | status enum; grade/feedback free text; no ownership check | LearnerAssessment | $set + $push resubmissions | - | Y | msg 400 | assessment | assessments/page |
| 38 | GET | /api/attendance | A,M,T | course/batch strings; T scoped by trainerName equal to teacher.fullName | Teacher, AttendanceSession | - | - | N | msg 500 | sessions | classes/page |
| 39 | POST | /api/attendance | A,M,T | course, date; status enum; T: records filtered to own students, trainerName forced | Teacher, Enrollment | AttendanceSession | - | N | msg 400 | session 201 | classes/page |
| 40 | GET | /api/attendance/[id] | A,M,T | ObjectId; T name match | AttendanceSession, Teacher | - | - | N | uncaught | session | classes/page |
| 41 | PATCH | /api/attendance/[id] | A,M,T | T name match, trainerName stripped; records NOT filtered to own students | AttendanceSession, Teacher | AttendanceSession | - | N | msg 400 | session | classes/page |
| 42 | DELETE | /api/attendance/[id] | A,M,T | T name match | AttendanceSession | delete | - | N | uncaught | message | classes/page |
| 43 | GET | /api/class-sessions | A,M,T | enrollmentId/teacherId ObjectId; T forced to own teacherId | Teacher, ClassSession | - | - | N | uncaught | sessions | ClassHistoryDrawer |
| 44 | POST | /api/class-sessions | A,M,T | enrollment exists; T isTaughtBy; hours positive and within remaining; dup index; A/M isChargeable and teacher pick | Enrollment, Teacher | ClassSession; Enrollment hours recalc | payroll input | Y | 409 dup / msg 400 | session, hours 201 | ClassHistoryDrawer |
| 45 | PATCH | /api/class-sessions/[id] | A,M | hours positive; statuses via schema enum | ClassSession, Enrollment | ClassSession; hours recalc | notify roleTarget=trainer (ALL trainers) | Y | msg 400 | session, hours | ClassHistoryDrawer |
| 46 | DELETE | /api/class-sessions/[id] | A,M | ObjectId | ClassSession | delete; hours recalc | - | Y | uncaught | message, hours | ClassHistoryDrawer |
| 47 | GET | /api/collections | A,M,F | - | Enrollment, Payment agg | - | - | N | uncaught | rows (name/phone/email/balance), totals | collections/page |
| 48 | GET | /api/compliance/dashboard | A,M,I,E,AS | - | LearnerProfile | - | - | N | uncaught | stats + high-risk names | compliance/page |
| 49 | GET | /api/courses | A,M,S,T | status enum; search escaped | Course, Enrollment agg | - | - | N | msg 500 | courses + registeredStudents | courses/page, enrollments/page (AS/I/E may open /courses but API returns 403) |
| 50 | POST | /api/courses | A,M | name, category enum | Counter | Course | - | N | msg 400 | course 201 | courses/page |
| 51 | GET | /api/courses/[id] | A,M,S,T | ObjectId | Course | - | - | N | uncaught | course | courses/page |
| 52 | PATCH | /api/courses/[id] | A,M | enums; numeric fields Number() unchecked (negative price accepted) | Teacher | Course (price/VAT) | - | N | msg 400 | course | courses/page |
| 53 | DELETE | /api/courses/[id] | A,M | ObjectId | - | Course delete | - | N | uncaught | message | courses/page |
| 54 | POST | /api/courses/[id] (add batch) | A,M | batchName, format/status enum | Counter | Course $push batches | - | N | msg 400 | course 201 | courses/page |
| 55 | GET | /api/enrollment-requests | A,M,S | S scoped by salesEmail; status raw | EnrollmentRequest | - | - | N | uncaught | requests | enrollment-requests/page, LeadsClient |
| 56 | POST | /api/enrollment-requests | A,M,S | leadName/phone/course (non-string gives TypeError 400) | - | EnrollmentRequest | - | N | msg 400 | request 201 | LeadsClient |
| 57 | PATCH | /api/enrollment-requests/[id] | A,M | status enum | - | EnrollmentRequest review fields | none (approval creates nothing) | N | msg 400 | request | enrollment-requests/page |
| 58 | GET | /api/enrollments | A,M,S,F,T | enums; course raw; search escaped; T scoped (primary or co-trainer) | Teacher, Enrollment | - | - | N | msg 500 | enrollments via FULL serializer (Emirates ID, fees, balance, teacherPayRate) | classes, enrollments, payments, students pages |
| 59 | POST | /api/enrollments | A,M | name/phone/course; enums; totalFee/amountPaid Number() or 0 (negative allowed, no overpayment check) | Teacher, Counter | Enrollment, Payment | GL invoice + receipt (postSafely); notify trainers | Y | msg 400 | enrollment 201 | enrollments/page |
| 60 | GET | /api/enrollments/[id] | A,M,S,F,T | ObjectId; T isTaughtBy | Enrollment, Teacher | - | - | N | uncaught | enrollment (full serializer) | enrollments/page, students/page |
| 61 | PATCH | /api/enrollments/[id] | A,M | enums; amountPaid/totalFee Number(); completion override flag (no reason stored) | Enrollment, Teacher | Enrollment; Payment only on positive delta | GL receipt on positive delta; invoice reverse + repost on fee change; notify trainers | Y | msg 400 | enrollment | enrollments/page, students/page |
| 62 | DELETE | /api/enrollments/[id] | A,M | ObjectId | - | Enrollment delete (Payments left orphaned) | reverses invoice JE only | Y | uncaught | message | enrollments/page, students/page |
| 63 | GET | /api/expenses | A,M,F | category enum; search escaped | Expense | - | - | N | msg 500 | expenses, total | expenses/page |
| 64 | POST | /api/expenses | A,M,F | category enum; amount positive; expenseAccountCode = ANY active posting account | Counter, settings, COA | Expense, JE | GL Dr chosen account / Cr money account | N | msg 400 | expense 201 | expenses/page |
| 65 | GET | /api/expenses/[id] | A,M,F | ObjectId | Expense | - | - | N | uncaught | expense | expenses/page |
| 66 | PATCH | /api/expenses/[id] | A,M,F | enums; amount positive; any account code | Expense | Expense; JE reverse + repost | GL | N | msg 400 | expense | expenses/page |
| 67 | DELETE | /api/expenses/[id] | A,M,F | ObjectId | - | Expense delete | JE reversal | N | uncaught | message | expenses/page |
| 68 | GET | /api/export/[entity] | any + IMPORT_EXPORT_PERMISSIONS[entity].export (leads/followups incl S; enrollments A,M,F; courses/teachers A,M; payments/expenses A,M,F; attendance A,M). students/classes have no permission key so 403 for everyone | entity whitelist | Lead/FollowUp/Enrollment/Course/Teacher/Payment/Expense/Attendance find({}) UNSCOPED | - | client builds CSV (csvEscape) | N | generic 500 | rows | import-export/ImportExportClient |
| 69 | GET | /api/follow-ups | A,M,S | S scoped by name regex; status enum; view | FollowUp | - | - | N | msg 500 | followUps | follow-ups/page, NotificationPanel, Sidebar badge, LeadsClient |
| 70 | POST | /api/follow-ups | A,M,S | name/phone/date; enums; S assignedTo forced; leadId ownership not checked | - | FollowUp | - | Y | msg 400 | followUp 201 | follow-ups/page, LeadsClient |
| 71 | PATCH | /api/follow-ups/[id] | A,M,S | S ownership by name; enums | FollowUp | FollowUp | - | Y | msg 400 | followUp | follow-ups/page, LeadsClient |
| 72 | DELETE | /api/follow-ups/[id] | A,M,S | S ownership by name | FollowUp | delete | - | Y | uncaught | message | follow-ups/page, LeadsClient |
| 73 | GET | /api/hour-adjustments | A,M | enrollmentId ObjectId | HourAdjustment | - | - | N | uncaught | adjustments | ClassHistoryDrawer |
| 74 | POST | /api/hour-adjustments | A,M | enrollment exists, type enum, hours positive, reason 3+ chars | Enrollment | HourAdjustment; hours recalc | - | Y | msg 400 | adjustment, hours 201 | ClassHistoryDrawer |
| 75 | POST | /api/impersonate/exit | any session carrying impersonatorId (uses auth() directly, not requireAuth) | impersonator still active | User | ImpersonationToken (isReturn) | returns an admin sign-in ticket; no password/2FA | Y | msg 500 | url | ImpersonationBanner |
| 76 | POST | /api/import/[entity] | any + IMPORT_EXPORT_PERMISSIONS[entity].import; max 500 rows | per-entity required fields, enums with defaults, dup checks (none for payments/expenses) | Lead/Enrollment/Teacher dup lookups | Lead/FollowUp/Enrollment/Course/Teacher/Payment/Expense/Attendance create | NO GL postings for payments/expenses/enrollments | N | per-row err.message | total, success, failed, errors | import-export/ImportExportClient |
| 77 | GET | /api/iqa-samples | A,M,I,E | ids ObjectId; status raw | IQASample | - | - | N | uncaught | samples | iqa/page |
| 78 | POST | /api/iqa-samples | A,M,I | 3 ObjectIds (existence not checked) | - | IQASample | - | Y | msg 400 | sample 201 | iqa/page |
| 79 | PATCH | /api/iqa-samples/[id] | A,M,I | status/outcome enum | - | IQASample $set | - | Y | msg 400 | sample | iqa/page |
| 80 | GET | /api/leads | A,M,S | S scoped by name; enums; search escaped | Lead | - | - | N | msg 500 | leads | follow-ups/page, LeadsClient |
| 81 | POST | /api/leads | A,M,S | name/phone; enums; dup phone (escaped regex); S assignedTo/createdBy forced; A/M may set createdBy freely | Lead, Counter | Lead | - | Y | msg 400; 409 returns the full duplicate lead, including leads owned by other sales users | lead 201 | LeadsClient |
| 82 | GET | /api/leads/[id] | A,M,S | S ownership by name | Lead | - | - | N | uncaught | lead | LeadsClient |
| 83 | PATCH | /api/leads/[id] | A,M,S | S ownership; S cannot reassign; enums | Lead, Enrollment, FollowUp | Lead; FollowUps closed; Enrollment auto-created on stage=Enrolled (also when S does it) | - | Y | msg 400 | lead, enrollmentId | LeadsClient |
| 84 | DELETE | /api/leads/[id] | A,M | ObjectId | - | Lead delete | - | Y | uncaught | message | LeadsClient (canDelete) |
| 85 | GET | /api/leads/[id]/follow-ups | A,M,S | S ownership by name | Lead, FollowUp | - | - | N | uncaught | followUps | LeadsClient |
| 86 | GET | /api/leads/export | A,M,S | S scoped; stage/source/course raw strings | Lead | - | CSV (no formula neutralisation) | N | msg 500 | CSV | LeadsClient |
| 87 | POST | /api/leads/import | A,M,S | multipart CSV; required columns; enums; S assignedTo forced; no size/row limit; no dup check | Counter | Lead create | - | N | msg 500 | created, failed, errors | LeadsClient |
| 88 | GET | /api/learner-profiles | A,M,I,E,AS | risk enum; search escaped (includes emiratesId) | LearnerProfile | - | - | N | uncaught | profiles (passport/visa/EID numbers) | learner-profiles/page |
| 89 | POST | /api/learner-profiles | A,M,I,AS | enrollmentId valid and exists; no duplicate | Enrollment, LearnerProfile | LearnerProfile | - | Y | msg 400 | profile 201 | learner-profiles/page |
| 90 | GET | /api/learner-profiles/[id] | A,M,I,E,AS | ObjectId | LearnerProfile | - | - | N | uncaught | profile | learner-profiles/[id] |
| 91 | PATCH | /api/learner-profiles/[id] | A,M,I,AS | text whitelist; documents enum filter; risk enum | - | LearnerProfile $set/$push | - | Y | msg 400 | profile | learner-profiles/[id] |
| 92 | GET | /api/my/students | A,M,T | teacher resolved by session email | Teacher, Enrollment, ClassSession | - | - | N | uncaught | students (full serializer: fees/EID/pay rate), stats | my-students/page |
| 93 | GET | /api/notifications | any | email/role target | Notification | - | - | N | uncaught | notifications, unread | NotificationPanel |
| 94 | PATCH | /api/notifications | any | ids array (cast errors uncaught) | - | Notification read flag | - | N | uncaught | ok | NotificationPanel |
| 95 | GET | /api/payments | A,M,F | enums; search escaped | Payment | - | - | N | msg 500 | payments, totals | payments/page, NotificationPanel |
| 96 | POST | /api/payments | A,M,F | name; amount positive; enums; enrollmentId unchecked (enrollment not updated, no overpayment check) | Counter, settings, COA | Payment, JE | GL receipt (fees advance when no enrollment) | N | msg 400 | payment 201 | payments/page |
| 97 | GET | /api/payments/[id] | A,M,F | ObjectId | Payment | - | - | N | uncaught | payment | payments/page |
| 98 | PATCH | /api/payments/[id] | A,M,F | amount positive; enums | Payment | Payment; JE reverse + repost | GL | Y (new values only) | msg 400 | payment | payments/page |
| 99 | DELETE | /api/payments/[id] | A | ObjectId | - | Payment delete (Enrollment.amountPaid untouched) | JE reversal | Y | uncaught | message | payments/page |
| 100 | GET | /api/qualifications | A,M,I,E,AS,T | - | Qualification | - | - | N | uncaught | qualifications | qualifications/page |
| 101 | POST | /api/qualifications | A,M,I | status enum; units sanitised | - | Qualification | - | Y | msg 400 | qualification 201 | qualifications/page |
| 102 | GET | /api/qualifications/[id] | A,M,I,E,AS,T | ObjectId | Qualification | - | - | N | uncaught | qualification | qualifications/[id] |
| 103 | PATCH | /api/qualifications/[id] | A,M,I | status enum | - | Qualification $set | - | Y | msg 400 | qualification | qualifications/[id] |
| 104 | GET | /api/reports/export | A,M,F | date filter | Payment/Expense/Lead/Enrollment agg | - | CSV (group labels csvEscape only) | N | uncaught | CSV | reports/ExportButtons |
| 105 | GET | /api/search | any (result groups gated by role) | q 2+ chars, escaped regex; S leads scoped by name; T enrollments by primary teacherId only | Enrollment, Lead, Course, Teacher, JE, COA, Payment | - | - | N | uncaught | hits | GlobalSearch |
| 106 | GET | /api/settings | none in code (proxy requires login) | - | Settings | - | - | N | generic | branding, VAT number, logo | Sidebar, settings/page |
| 107 | PATCH | /api/settings | A | whitelist; logoBase64 unbounded | - | Settings upsert | - | N | generic | settings | settings/page |
| 108 | GET | /api/staff-compliance | A,M,I,E | - | StaffCompliance | - | - | N | uncaught | records | staff-compliance/page |
| 109 | POST | /api/staff-compliance | A,M | name/role | - | StaffCompliance | - | Y | msg 400 | record 201 | staff-compliance/page |
| 110 | GET | /api/staff-compliance/[id] | A,M,I,E | ObjectId | StaffCompliance | - | - | N | uncaught | record | (no fetch caller found) |
| 111 | PATCH | /api/staff-compliance/[id] | A,M | documents mapped (no enum) | - | StaffCompliance $set | - | Y | msg 400 | record | staff-compliance/page |
| 112 | GET | /api/teacher-payouts | A,M,F | - | Teacher, TeacherPayout, settings, ClassSession (payroll preview) | - | - | N | uncaught | due, totalDue, payouts, defaults | teacher-payouts/page |
| 113 | POST | /api/teacher-payouts | A,M | teacher exists; amount positive; reason required if amount differs from computed; accounts = any posting account | Teacher, ClassSession, settings | TeacherPayout; ClassSession.payoutId (no atomic claim); JE | GL Dr salary / Cr cash; notify teacher | Y | msg 400 | payout 201 | teacher-payouts/page (page open to F, API 403 for F) |
| 114 | GET | /api/teachers | A,M | status enum; search escaped | Teacher | - | - | N | msg 500 | trainers (EID, paymentRate) | courses, enrollments, teachers pages |
| 115 | POST | /api/teachers | A,M | name/phone; enums | - | Teacher (email links the trainer login) | - | N | msg 400 | trainer 201 | teachers/page |
| 116 | GET | /api/teachers/[id] | A,M | ObjectId | Teacher | - | - | N | uncaught | trainer | teachers/page |
| 117 | PATCH | /api/teachers/[id] | A,M | whitelist; paymentRate Number() | - | Teacher (email/fullName change re-links trainer data scoping) | payroll and scoping impact | N | msg 400 | trainer | teachers/page |
| 118 | DELETE | /api/teachers/[id] | A,M | ObjectId | - | Teacher delete | - | N | uncaught | message | teachers/page |
| 119 | GET | /api/users | A (all users); M only with a role filter other than admin/manager | role enum | User | - | - | N | msg 500 | users (email, mobile, lastLogin) | settings/page, LeadsClient |
| 120 | POST | /api/users | A | name/email; password 8+ (trimmed); role enum; dup email | User | User (bcrypt cost 12) | - | N | msg 500 | user 201 | settings/page |
| 121 | PATCH | /api/users/[id] | A | email unique; role enum; no self-deactivate; newPassword 8+ | User | User role/active/password/email | no session revocation beyond live check | N | msg 500 | user | settings/page |
| 122 | DELETE | /api/users/[id] | A | not self | - | User delete | - | N | msg 500 | success | settings/page |
| 123 | GET | /api/users/me/2fa | any | - | User | - | - | N | uncaught | enabled | Header |
| 124 | POST | /api/users/me/2fa | any; rate limit 10/15min per user (in-memory) | setup (no re-auth) / verify (code) / disable (password + code) | User | User 2FA fields | QR data URL | Y (enable/disable only) | msg 500 | qrDataUrl, manualKey / enabled | Header |
| 125 | POST | /api/users/me/password | A,M,S,F,T (AS, I, E, AC excluded) | current password bcrypt; new 8+ | User | User.password | no session revocation | N | uncaught | message | Header (shown to all roles) |

Notes
- Dead client call: app/(dashboard)/settings/page.tsx:504 POSTs /api/admin/create-super-admin (route deleted in commit 315db35).
- Page-level server data (no API): app/(dashboard)/dashboard/page.tsx (auth() JWT role, direct DB), app/(dashboard)/finance/page.tsx (no auth() call, direct DB), app/(dashboard)/reports/page.tsx (auth() JWT role, direct DB), app/(dashboard)/import-export/page.tsx (auth() + redirect).
- Import/export UI keys students and classes (ImportExportClient.tsx:108,114) have no entry in IMPORT_EXPORT_PERMISSIONS (lib/permissions.ts:118-127), so the API returns 403 for every role.
