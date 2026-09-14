> **Audit document — generated during the full-system audit on 2026-09-14 (branch `audit/full-system-debug`).**
> File:line references point at the code as it was at commit `b2962a9`, before the audit fixes.
> Many findings below are now fixed — the authoritative status of every issue is the register in [SYSTEM_AUDIT.md](SYSTEM_AUDIT.md).

# Nitaq CRM - Business Pipeline Map

Branch audited: `audit/full-system-debug` @ b2962a9. Mongoose 8.24.2.
Paths are repo-relative to `C:\Users\User\nitaq-crm-live`. `L` = line.
Issue IDs (CRM-xx) refer to the issue table returned with this draft.

Cross-cutting facts that affect every flow:

- **Auth**: `lib/api-auth.ts` `requireAuth(roles)` re-reads `User.active/role` (60 s cache, **fails open** on DB error L26-29). Every route lists its roles inline; `lib/permissions.ts` only covers pages/sidebar/import-export. `auth.config.ts:78` lets every `/api/*` path through the middleware, so the route check is the only API gate.
- **Record scope**: sales ownership is by **display name** (`assignedTo`/`createdBy` strings vs `authed.name`). While an admin impersonates, `authed.name` becomes `"Name (via Admin)"` (api-auth L84). Trainer scope is by `Teacher.email == User.email` (`lib/teacher.ts:8-11`). Attendance scope is by `trainerName` string.
- **Audit**: `lib/audit.ts` is fire-and-forget; failures are swallowed (L23). It logs no before/after snapshot, only a free-text `detail`.
- **Notifications**: `lib/notify.ts` is fire-and-forget. `Notification.read` is one boolean even for role-broadcast docs.
- **Mongoose `$set: {x: undefined}` is stripped.** Verified offline: `findByIdAndUpdate(id, {a: undefined, b: 'x'})` casts to `{ $set: { b: 'x' } }`. So every PATCH that "clears" a field with `clean(v) || undefined` does nothing (CRM-09, CRM-10).
- **No transactions anywhere.** Every multi-write flow can half-complete.
- **Sequence IDs**: `models/Counter.ts` `getNextSequence` runs before `create`, so failed creates leave gaps.

---

## Workflow 1 - Lead -> follow-up -> conversion -> enrollment request -> enrollment -> student

### 1a. Create lead (manual)
```
UI  components/leads/LeadsClient.tsx  openCreateForm L398 -> LeadFormDrawer (stage <Select> L1743, not role-gated)
 -> Form submit saveLead L431 -> fetch POST /api/leads (L444)  body {fullName, phone, email, course, customCourse, source, stage, notes, nextFollowUpDate, assignedTo}
 -> API  app/api/leads/route.ts POST L132
 -> Auth requireAuth([admin, manager, sales]) L133
 -> Permission: sales forced assignedTo=createdBy=authed.name L142-147 (name string; impersonation suffix)
 -> Validation buildLeadPayload L32-65 (required name/phone, enum course/source/stage; ANY stage allowed incl. Enrolled/Paid)
 -> Business: dup check phone regex, input whitespace stripped only, exact match vs stored raw L150-157 (no email, no index, race)
 -> DB  counters.$inc("lead") L159 ; leads.insert L161
 -> Audit logAudit(created Lead) L162        Accounting: none   Notify: none (no assignee notification)
 -> Response 201 {lead} | 409 {duplicate}
 -> UI refresh: loadLeads() refetch GET /api/leads (L345-359)
```

### 1b. Assign (single / bulk)
```
UI LeadsClient bulkAssign L632 -> Promise.all(fetch PATCH /api/leads/:id {assignedTo}) L640-646  (no res.ok check)
 -> API app/api/leads/[id]/route.ts PATCH L119 -> requireAuth([admin,manager,sales]) L120
 -> Permission canAccessLead L99-106 (name match) ; sales: body.assignedTo deleted L135
 -> Validation buildUpdate L45-91 ; assignedTo "" -> undefined -> stripped (cannot unassign, CRM-10)
 -> DB leads.findById L129 ; leads.findByIdAndUpdate L144
 -> Audit "Assigned to: X" L154-158      Notify: none
 -> UI: notice + loadLeads()
```

### 1c. Follow-up
```
UI LeadsClient saveFollowUp L493
   create: POST /api/follow-ups {contactName, phone, course, leadId, followUpDate, type, notes, status, assignedTo} L515
           THEN PATCH /api/leads/:id {nextFollowUpDate} L529 (result not checked; not atomic)
   edit:   PATCH /api/follow-ups/:id L505
   bulk:   bulkFollowUp L662 -> POST /api/follow-ups WITHOUT leadId L675-686 (CRM-30)
UI follow-ups/page.tsx: lead search GET /api/leads?search L141 ; create with leadId L155 ; mark Done PATCH L188 ; delete L205
 -> API app/api/follow-ups/route.ts POST L87 -> requireAuth L88
 -> Permission: sales assignedTo forced L108 ; NO check that leadId exists / is owned (L121)
 -> Validation required contactName/phone/date, enum type/status L101-105 ; date string not validated
 -> DB followups.insert L111
 -> Audit L124
 -> Timeline read: GET /api/leads/[id]/follow-ups (route.ts L11-37, sales ownership L23-31) -> followups.find({leadId})
 -> UI refresh: loadViewTimeline/loadEditTimeline + loadLeads (L540-543)
 PATCH/DELETE app/api/follow-ups/[id]/route.ts L32/L99 ; ownership canAccessFollowUp L20-30 ; hard delete (history lost) L116
```

### 1d. Status change / closed stage
```
UI edit drawer stage select L1743 -> saveLead PATCH /api/leads/:id {stage}
 -> API leads/[id] PATCH: stage enum only, no transition table L74-78
 -> Business: on transition into CLOSED_STAGES {Enrolled, Paid, Lost, Not Interested, Invalid Number} L38, L163-178
      leads.updateOne $unset nextFollowUpDate ; followups.updateMany {leadId, Pending} -> Done ; audit
 -> Enrolled transition -> auto enrollment (1e)
```

### 1e. Convert (direct) - admin/manager button AND sales via edit drawer
```
UI LeadsClient convertToEnrollment L570 -> PATCH /api/leads/:id {stage:"Enrolled"} L574-578
   res.ok NOT checked L579-589 -> router.push(/enrollments?new=<id>) or /enrollments
   Sales row shows "Request enrollment" instead L1302-1313, BUT the edit drawer stage select still lets sales set Enrolled.
 -> API leads/[id] PATCH L183-212 (roles include sales L120)
 -> Business: if newStage==Enrolled && existing.stage!=Enrolled:
      enrollments.findOne({leadId}) L184 -> (no unique index; race) -> counters.$inc("enrollment") L186
      -> enrollments.insert {totalFee:0, amountPaid:0, status Active, no teacher/hours} L189-201
 -> Audit "Auto-created from lead" L203-208   Accounting: NONE (fee 0)   Notify: NONE   LearnerProfile: NONE
 -> Response {lead, enrollmentId}
 -> UI enrollments/page.tsx L147-170: GET /api/enrollments/:new -> opens edit drawer (emiratesId/nationality prefilled "" L161)
    -> save L259 PATCH /api/enrollments/:id -> (1g)
```

### 1f. Enrollment request (sales) -> review
```
UI LeadsClient openEnrollmentRequest L597 -> submitEnrollmentRequest L605 -> POST /api/enrollment-requests
     body {leadId, leadRef, leadName, leadPhone, course, notes, expectedStartDate} (all client-supplied)
 -> API app/api/enrollment-requests/route.ts POST L47 -> requireAuth([admin,manager,sales]) L48
 -> Validation name/phone/course non-empty only L55-61 ; no lead existence / ownership / already-enrolled / pending-duplicate check
 -> DB enrollmentrequests.insert L63 ; Audit NONE ; Notify NONE (admins not told)
 -> UI notice only (lead row unchanged -> button stays -> repeat submits)

UI enrollment-requests/page.tsx submitReview L82 -> PATCH /api/enrollment-requests/:id {status, reviewNote} L87
 -> API enrollment-requests/[id]/route.ts PATCH L30 -> requireAuth([admin,manager]) L32
 -> Validation status in enum L43-46 ; NO transition guard (Approved<->Pending<->Rejected, re-approve)
 -> DB enrollmentrequests.findByIdAndUpdate L55
 -> Business: NOTHING ELSE. No enrollment, no lead stage change, no audit, no notify to salesEmail
 -> UI notice + load() refetch
```

### 1g. Enrollment create / edit / delete (admin, manager)
```
UI enrollments/page.tsx save L259 -> POST /api/enrollments | PATCH /api/enrollments/:id
 POST app/api/enrollments/route.ts L83 requireAuth([admin,manager]) L84
   validation L96-106 ; leadId from body not validated L125 ; teacherIds filtered to valid ObjectIds (not existence) L129-137
   DB counters, enrollments.insert L111 ; teachers.find + enrollment.save (names) L151-162
   Notify each trainer L164-173 ; Accounting postStudentInvoice L177-187 ; payments.insert + postCustomerReceipt L189-225 (postSafely swallows errors)
   Audit L227
 PATCH enrollments/[id]/route.ts L61 : free status transitions L87-91 ; completion guard L136-143 ;
   teachers: teacherId/teacherName set to undefined when list emptied -> stripped (CRM-09) L165-168 ;
   teacherPayRate "" -> undefined -> stripped (CRM-10) L117-118 ;
   amountPaid delta -> payments.insert + receipt posting L205-243 ; fee change -> reverse + repost invoice L246-260 ; audit L267
 DELETE enrollments/[id] L276 : enrollments.findByIdAndDelete ; reverse Invoice only ; audit
   ORPHANS: payments(+receipt JEs), classsessions, houradjustments, learnerprofiles, assessments, iqasamples, lead stage stays Enrolled
 UI refresh: await load() (L283) ; students/page.tsx StatusCell PATCH {status} L50 -> local onUpdated
 GET /api/enrollments allows sales + finance + trainer (L36) ; trainer scoped by applyTaughtBy L67-73 ; sales/finance unscoped
```

### 1h. Student / learner record
```
/students page (admin, manager) -> GET /api/enrollments (the "student" IS the Enrollment; no separate Party/Student)
/my-students (trainer) -> GET /api/my/students (route.ts L15-72) taughtByFilter + ClassSession stats (hoursThisMonth sums all Completed, ignores attendance L41-44)
/learner-profiles -> POST /api/learner-profiles (route.ts L39-97) roles admin/manager/iqa/assessor ; 1:1 enrollmentId unique ; dup check L54-60 ;
   created MANUALLY (no link from conversion) ; isActive never synced with enrollment status/deletion
   PATCH [id] L34-123 documents full replace, commsLog $push, audit
```

### Fragile points (W1)
1. Two conversion paths (direct PATCH stage=Enrolled vs request approval); approval does nothing; sales can use the direct path (CRM-01, CRM-02).
2. Check-then-create on `Enrollment.leadId` with no unique index. A double click, two tabs, or edit-drawer save plus Convert creates two enrollments (CRM-03).
3. The UI ignores `res.ok` on conversion and on the follow-up to lead-date PATCH (CRM-04).
4. Phone dedupe only strips whitespace, has 4 inconsistent implementations and no index (CRM-05).
5. Lead ownership by display name breaks on rename, impersonation and name collisions (CRM-29).
6. Clearing fields is a silent no-op (CRM-10).
7. Hard deletes orphan follow-ups, requests, enrollments, payments, sessions and profiles (CRM-11, CRM-12).
8. No stage/status state machine; imports can land leads directly in Enrolled/Paid (CRM-13).
9. Bulk follow-ups have no `leadId`: lost timeline, not auto-closed (CRM-30).
10. No request dedupe, no notifications, no audit on request/review (CRM-32, CRM-02).
11. The auto-created enrollment has fee 0, no invoice, no teacher and no learner profile; an abandoned drawer leaves a half-registered student (CRM-38).

---

## Workflow 2 - Enrollment -> course -> teacher -> class session / attendance -> hours

### 2a. Teacher assignment
```
UI enrollments/page.tsx teacherIds multi-select -> PATCH /api/enrollments/:id {teacherIds}
 -> enrollments/[id] L146-200: validate ObjectIds + existence L152-160 ; set teacherIds/Names, teacherId=ids[0]
 -> Notify added/removed trainers (userEmail) L177-199 ; Audit generic "Details updated"
 (course is a free string on Enrollment - no FK to courses collection; lead course list is constants/leads.ts, a different list)
```

### 2b. Class session (hours-bearing) - ClassHistoryDrawer
```
UI components/shared/ClassHistoryDrawer.tsx (used by students/page.tsx and my-students/page.tsx)
   load GET /api/class-sessions?enrollmentId L89 ; submit POST|PATCH L136-156 ; delete L163 ; adjust POST /api/hour-adjustments L187
   refresh: refreshHours(d.hours) local state + onHoursChanged() + load() L101-104, L152-154
 -> API app/api/class-sessions/route.ts POST L49 requireAuth([admin,manager,trainer]) L50
 -> Permission trainer: getTeacherForUser + isTaughtBy L69-79 (scalar teacherId OR teacherIds) ; admin picks teacher L84-100
 -> Validation deliveredHours>0 L103-106 ; attendance/class status NOT enum-checked in route (schema enum on create) ;
    NO enrollment.status check (Dropped/Completed/On Hold accepted) ; remaining-hours guard for charging sessions L112-122 (not atomic)
 -> DB enrollments.findById L61 ; classsessions.insert L124 (unique idx only if startTime present, includes teacherName: ClassSession.ts L63-66)
 -> Business lib/hours.ts recalcEnrollmentHours L32-81: sessions+adjustments -> completedHours clamped to total (silent) L53 -> enrollment.save ; low/complete notify roleTarget admin
 -> Audit L145-150 ; 409 on E11000 L154-156
 PATCH class-sessions/[id] L19-74 admin/manager: no remaining-hours guard (empty if-block L49-54), no payoutId lock, recalc, audit,
    notify roleTarget "trainer" (ALL trainers) L63-67
 DELETE L77-99: hard delete even if payoutId set ; recalc ; audit
 Payroll lib/payroll.ts L74 unpaid = payoutId null ; teacher-payouts route L156 stamps payoutId
```

### 2c. Attendance register (NOT hours-bearing) - classes page
```
UI app/(dashboard)/classes/page.tsx : GET /api/attendance L88 ; GET /api/enrollments?status=Active L102 (roster) ;
   save L157 POST /api/attendance | PATCH /api/attendance/:id {course, batchName, sessionDate, sessionNumber, topic, trainerName, records[]} L173
   refresh fetchSessions() ; delete L192
 -> API app/api/attendance/route.ts POST L55 requireAuth([admin,manager,trainer])
 -> Permission trainer: trainerName forced L71-79 ; records filtered to taughtBy students L94-101 (POST only)
 -> Validation course/date L64-66 ; record status enum L105-114 ; enrollmentId/studentName from client, not verified, not deduped
 -> DB attendancesessions.insert L116 (no unique course+date+trainer) ; NO audit ; NO hours impact
 PATCH attendance/[id] L45-94 : trainerOwnsSession by trainerName string L18-25 ; records replaced WITHOUT taughtBy filter L74-85 ; no audit
 DELETE L96-113 hard delete, no audit
```

### Fragile points (W2)
1. There are two attendance models (`AttendanceSession` vs `ClassSession`) with no reconciliation. A student marked Absent in the register can still be charged hours (CRM-18).
2. Sessions are accepted for non-Active enrollments (CRM-14).
3. Session PATCH/DELETE ignore remaining hours and payout lock; recalc clamps silently, so paid hours no longer equal consumed hours (CRM-15).
4. The duplicate guard depends on optional `startTime` and includes `teacherName`; POST check-then-create is not atomic (CRM-16).
5. Attendance PATCH lets a trainer inject other teachers' students; there is no dedupe and no existence check (CRM-17).
6. Trainer attendance scope uses a name string, and teacher rename/delete does not cascade (`teachers/[id]` PATCH L41-73, DELETE L90) (CRM-18, CRM-41).
7. Emptying the trainer list keeps the stale scalar `teacherId`, so the removed trainer keeps access (CRM-09).
8. The edit notification is broadcast to every trainer (CRM-19).
9. The `my/students` hoursThisMonth rule differs from `sessionCharges` (CRM-45).
10. `teacher-scope.test.ts` only exercises pure helpers, not the route persistence (CRM-39).

---

## Workflow 6 - Learner -> qualification -> assessment -> IQA -> EQA -> compliance dashboard

```
Qualification  UI qualifications/page.tsx POST L113 ; qualifications/[id]/page.tsx PATCH L130
 -> app/api/qualifications/route.ts POST L20 requireAuth([admin,manager,iqa]) ; [id] PATCH L28
 -> Validation: title/level via schema ; tutorId/assessorId/iqaId unchecked (can be same user / non-ObjectId CastError) ; units sanitizeUnits (lib/qualification-utils.ts L2-17) FULL REPLACE L55
 -> DB qualifications ; Audit "Details updated" (no diff)

Learner profile  (see 1h) - qualificationIds never written (only read in lib/serializers.ts L312)

Learner assessment  UI: NONE creates or edits (assessments/page.tsx is list-only L69; no fetch POST/PATCH to /api/assessments anywhere)
 -> app/api/assessments/route.ts POST L28 requireAuth([admin,manager,assessor,iqa])
 -> Validation ObjectId format only L36-41 ; no existence of profile/qualification ; unitCode not in qualification.units ; status from body (may be "Passed") ; no uniqueness learner+qual+unit
 -> DB learnerassessments.insert ; Audit "Status: X"
 PATCH [id] L27-82 : any assessor/iqa/manager edits any assessment (no assessorId==user) ; no transition guard ; no lock after IQA ; resubmissions $push ; Audit new status/grade only

IQA sample  UI iqa/page.tsx list L69 + PATCH {status, outcome} L89 (local state update L96) ; NO create UI
 -> app/api/iqa-samples/route.ts POST L28 requireAuth([admin,manager,iqa])
 -> Validation ObjectId format only ; learnerProfileId/qualificationId/unitCode from body, not derived from assessment ; assessment status not checked ; sampler vs assessor not checked
 -> DB iqasamples.insert (unique assessmentId, IQASample.ts L56 -> raw E11000 message) ; Audit
 PATCH [id] L14-55 : Completed without outcome ; outcome editable after Completed ; no effect on assessment ; Audit after-state only

EQA  : no model, no route, no UI action. Role "eqa" = GET-only on assessments/iqa/profiles/qualifications/staff-compliance.
Certificate / claim : no entity exists (grep: none) -> no "all units assessed" gate possible.

Compliance dashboard  UI compliance/page.tsx GET L63
 -> app/api/compliance/dashboard/route.ts L6-79 roles admin/manager/iqa/eqa/assessor
 -> reads learnerprofiles only ; doc "Present" status only (ignores expiry) L36-39 ; ignores assessments, IQA, staff compliance
Staff compliance  app/api/staff-compliance/route.ts GET [admin,manager,iqa,eqa] L9 ; POST [admin,manager] L18 ; not linked to assessor/IQA eligibility
```

### Fragile points (W6)
1. There is no segregation of duties. An IQA user can grade (assessments PATCH roles L28) and then sample the same work, and sampler identity is a name string (CRM-22, CRM-23).
2. A result can change after IQA sign-off, with no lock and no before/after audit (CRM-22, CRM-40).
3. An IQA sample can point at a different learner/unit than its assessment, or at unassessed work (CRM-23).
4. Assessments can be created as Passed, duplicated, or reference non-existent units; replacing units orphans them (CRM-26).
5. No EQA or certification entity exists, so certification cannot be gated (CRM-24).
6. No UI exists for creating assessments or IQA samples (CRM-25).
7. The dashboard treats expired documents as present and ignores enrollment status (CRM-27).
8. Assessor/EQA roles read all learners' passport/visa/DOB unscoped (CRM-28). This is a PDPL/safeguarding touchpoint.

---

## Notifications, search, import/export

```
Notifications  producers: enrollments POST/PATCH (trainer userEmail), lib/hours.ts (roleTarget admin), class-sessions/[id] PATCH (roleTarget trainer - broadcast)
  consumer: app/api/notifications/route.ts GET L7-33 {userEmail OR roleTarget} ; PATCH L36-51 marks roleTarget docs read for WHOLE role ; ids unvalidated
  UI components/layout/NotificationPanel.tsx L94, Sidebar.tsx L94 (also poll follow-ups today)
  Not produced for: lead assignment, enrollment request submit/review, assessment/IQA outcomes, document expiry.

Search  app/api/search/route.ts GET L19-166 requireAuth() any role
  Students: admin/manager/finance/trainer (trainer scalar teacherId only L45 - co-teachers excluded) ; Leads: admin/manager/sales (sales ownership L66-69)
  Courses: all roles ; Trainers: admin/manager ; Vouchers/Accounts: admin/manager/accountant ; Receipts: admin/manager/finance
  finance hits link to /students which middleware denies to finance (permissions.ts L36)

Import (generic)  UI import-export/ImportExportClient.tsx : Papa.parse client-side, "preview" = first 5 rows + required-field check on first 2 template fields L166-186, L403-426
   -> POST /api/import/:entity {rows[]} L194 -> app/api/import/[entity]/route.ts L28 requireAuth() + IMPORT_EXPORT_PERMISSIONS[entity] L34-37
   -> per-row sequential create, per-row try/catch, max 500, invalid enums coerced to defaults, exact-phone dedupe (leads L71, enrollments phone+course L130)
   -> no dry-run, no transaction, no audit, no accounting for enrollments/payments, no createdBy on leads
   -> UI shows result counts + failed rows
   key mismatch: client maps students->enrollments perms L125-131, server looks up "students" -> 403 ; "classes" branch unreachable (perm key is "attendance")
Import (leads page)  LeadsClient importLeads L728 -> POST /api/leads/import multipart L736 -> app/api/leads/import/route.ts
   -> own CSV parser L12-34 ; header check ; per-row validation ; NO dedupe ; NO per-row try/catch -> CastError aborts with 500 mid-file ; no audit ; no createdBy
Export (generic)  GET /api/export/:entity -> JSON rows -> Papa.unparse (no escapeFormulae) L212-226 ; leads/followups unscoped for sales L37-62
Export (leads page)  GET /api/leads/export (sales-scoped L38-41) -> csvEscape (lib/utils.ts L64-67, no formula neutralising)
```

### Fragile points (misc)
1. Sales can export all leads/follow-ups via the generic export (CRM-07).
2. Role-broadcast notifications leak student data and share a read flag (CRM-19, CRM-20).
3. Import has no server preview; coercion hides bad data; partial imports; no audit; enrollment import bypasses the ledger (CRM-06, CRM-33, CRM-34).
4. CSV formula injection (CRM-35).
5. Audit is fire-and-forget with no before/after (CRM-40).

---

## Existing test coverage vs these flows
- `tests/crm/lead-conversion.test.ts`: re-implements `closeChase` and `CLOSED_STAGES` locally (L27, L46-49) and never calls the route. It covers follow-up closing and the dashboard overdue query only. It does not cover enrollment auto-creation, idempotency or races, sales permission, the request approval path, lead delete, or stage regressions.
- `tests/crm/teacher-scope.test.ts`: pure helpers (`taughtByFilter`, `applyTaughtBy`, `isTaughtBy`, `resolveTeacherAssignment`). `resolveTeacherAssignment` is not used by the enrollments route, which has its own inline logic. The test misses the `$set undefined` persistence bug, class-session/attendance/search scoping, and the notification broadcast.
- No tests for: follow-ups, enrollment requests, class sessions/hours routes, attendance, qualifications/assessments/IQA, notifications, search, import/export routes. `tests/utils/csv.test.ts` exists for `csvEscape`.

## Specialist hand-offs
- **accounting-engineer / finance-controller**: CRM-12 (enrollment delete leaves receipts and payroll sessions), CRM-15 (paid sessions editable), CRM-34 (import of fees/payments with no postings), CRM-10 (`teacherPayRate` cannot be cleared). `postSafely` swallows posting failures.
- **security-reviewer**: CRM-07, CRM-08, CRM-19, CRM-28, CRM-29 (impersonation attribution), CRM-35, `requireAuth` fail-open (CRM-44).
- **PDPL / safeguarding**: learner passport/visa/DOB/emergency contacts readable by all assessors/EQA; exports unaudited; notifications broadcast student names.
