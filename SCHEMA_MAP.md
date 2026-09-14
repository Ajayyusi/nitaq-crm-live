> **Audit document — generated during the full-system audit on 2026-09-14 (branch `audit/full-system-debug`).**
> File:line references point at the code as it was at commit `b2962a9`, before the audit fixes.
> Many findings below are now fixed — the authoritative status of every issue is the register in [SYSTEM_AUDIT.md](SYSTEM_AUDIT.md).

# Nitaq CRM — Schema Map

Source of truth: `models/**`, `models/accounting/**`, write paths in `app/api/**`, `lib/**`, server pages in `app/(dashboard)/*/page.tsx`.
Stack: Mongoose 8.24.2, single-tenant (no `tenantId` anywhere), no transactions anywhere, no `.populate()` / `$lookup` anywhere — every relationship is resolved by hand in route code.

Conventions used below
- **Ref(OID)** = `Schema.Types.ObjectId` with `ref`. **Ref(str)** = relationship held as a plain string (name, email, code, human ID).
- **Money** = JS `Number` (IEEE double) unless stated. No Decimal128 / integer-fils anywhere.
- **Date** = BSON Date. Every "date-only" business field is a Date. Typed values `YYYY-MM-DD` are parsed as UTC midnight (04:00 UAE). Auto-set values use `new Date()` (a full timestamp).
- **Delete** = what the DELETE route does. Nothing is soft-deleted except where noted, and **no delete cascades or checks for referencing records**.
- Mongoose 8 strips `undefined` from update docs (`node_modules/mongoose/lib/helpers/query/castUpdate.js:324-327`). Every `field = x || undefined` in a `findByIdAndUpdate` therefore **cannot clear** that field.

---

## 1. Model catalogue

### 1.1 Lead — collection `leads` — models/Lead.ts
Purpose: prospect in the sales pipeline.

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| leadId | String | no | — | `unique`. Human ID `L-001` from Counter `lead` |
| fullName | String | yes | — | max 120 |
| phone | String | yes | — | max 30. Not normalized, not indexed, not unique |
| email | String | no | — | lowercase, regex |
| course | String enum `constants/leads.courseList` | yes | "Other" | **Hard-coded list, not linked to the Course collection** |
| customCourse | String | no | — | used when course = Other |
| source | enum leadSources | yes | "Other" | |
| stage | enum leadStages (10 values) | yes | "Lead" | Lead, Contacted, Interested, Not Interested, Not Connecting, Not Answering, Invalid Number, Enrolled, Paid, Lost |
| notes | String | no | | |
| noteLog[] | {text, by(str), at} | | | unbounded embedded array |
| nextFollowUpDate | Date | no | | |
| assignedTo | Ref(str) User.name | no | | sales scoping key |
| createdBy | Ref(str) User.name | no | | sales scoping key |
| timestamps | yes | | | |

Indexes: `{leadId:1}` unique; `{stage:1,createdAt:-1}`; `{source:1,createdAt:-1}`; text `{fullName,phone,course}` (**unused — no `$text` queries**).
Delete: hard delete (`app/api/leads/[id]/route.ts:230`). Leaves FollowUp.leadId, Enrollment.leadId and EnrollmentRequest.leadId pointing at nothing.
Invariant hooks: none. On PATCH to a closed stage the route clears nextFollowUpDate and closes pending FollowUps (`:164-178`). On a transition to "Enrolled" it creates an Enrollment (`:183-212`).

### 1.2 FollowUp — `followups` — models/FollowUp.ts
| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| leadId | Ref(OID) Lead | no | | not validated to exist; import never sets it |
| contactName, phone | String | yes | | copied from the lead (denormalized, goes stale) |
| course | String | no | | free text |
| followUpDate | Date | yes | | |
| type | enum followUpTypes | yes | WhatsApp Message | |
| status | enum Pending/Done/No Response/Rescheduled | yes | Pending | |
| notes | String | | | |
| assignedTo, createdBy | Ref(str) User.name | | | |
Indexes: `{followUpDate:1,status:1}`, `{status:1,createdAt:-1}`. **Missing `{leadId:1}`** (used by `leads/[id]/follow-ups` and `updateMany({leadId,status})`).
Delete: hard.

### 1.3 EnrollmentRequest — `enrollmentrequests` — models/EnrollmentRequest.ts
| Field | Type | Req | Notes |
|---|---|---|---|
| leadId | Ref(OID) Lead | no | |
| leadRef | String | no | copy of Lead.leadId |
| leadName, leadPhone, course | String | yes | copies |
| salesName | Ref(str) User.name | yes | |
| salesEmail | Ref(str) User.email | yes | sales scoping key |
| notes, expectedStartDate(Date) | | no | |
| status | enum Pending/Approved/Rejected/More Info Needed | yes | default Pending |
| reviewedBy(str), reviewNote, reviewedAt(Date) | | no | |
Indexes: `{status:1,createdAt:-1}`, `{salesEmail:1,createdAt:-1}`.
Approving it only sets the status (`enrollment-requests/[id]/route.ts:48-56`). Creating the Enrollment is a manual UI link to `/enrollments?name&phone&course` **with no leadId** (`app/(dashboard)/enrollment-requests/page.tsx:326-333`, `enrollments/page.tsx:182`). No delete route.

### 1.4 Enrollment ("registration"/"student") — `enrollments` — models/Enrollment.ts
| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| enrollmentId | String | no | | `unique`. `E-001` from Counter `enrollment` |
| leadId | Ref(OID) Lead | no | | **no index, no uniqueness** |
| fullName, phone | String | yes | | copied from lead/request |
| email, emiratesId, nationality | String | no | | |
| course | Ref(str) Course.courseName (free text) | yes | | **string join to Course, by name** |
| batchName | Ref(str) Course.batches[].batchName | no | | |
| startDate, endDate, expectedCompletionDate | Date | no | | date-only semantics |
| schedule | String | no | | |
| format | enum In-Person/Online/Hybrid | no | In-Person | |
| status | enum Active/Completed/Dropped/On Hold | yes | Active | status field. Dropped is the de-facto "cancel" |
| paymentStatus | enum Paid Full/Instalment 1 Paid/Instalment 2 Pending/Overdue/Free | yes | **"Instalment 1 Paid"** | set by hand, never derived from money |
| totalFee | **Number** | yes | 0 | money, min 0. Treated as VAT-inclusive by postings |
| amountPaid | **Number** | yes | 0 | money, denormalized total. Only updated via Enrollment PATCH |
| notes | String | | | |
| registrationDate | Date | | Date.now | used as invoice JE date |
| arAccountCode | Ref(str) ChartOfAccount.code | no | | per-enrollment A/R sub-account |
| teacherId | Ref(OID) Teacher | no | | "mirrors teacherIds[0]" |
| teacherName | String | no | | denormalized |
| teacherIds[] | Ref(OID) Teacher | | | |
| teacherNames[] | String | | | index-aligned copies |
| teacherPayRate | **Number** | no | | money |
| teacherPayBasis | enum Per Hour/Per Class/Fixed for Course | no | | |
| totalRegisteredHours | Number | no | | |
| completedHours | Number | | 0 | derived by `lib/hours.ts` |
Indexes: `{enrollmentId:1}` unique; `{status:1,createdAt:-1}`; `{course:1,status:1}`; `{registrationDate:-1}`.
**Missing**: `{teacherId:1}`, `{teacherIds:1}` (trainer scoping `$or`, dashboards, my/students), `{leadId:1}`, `{phone:1,course:1}` (import duplicate check).
Delete: hard (`enrollments/[id]/route.ts:285`). Reverses the Invoice JE only. Payments (and their Receipt JEs), ClassSessions, HourAdjustments, LearnerProfile, AttendanceSession.records and TeacherPayout lines are left orphaned.

### 1.5 Course — `courses` — models/Course.ts
| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| courseCode | String | yes | | unique, uppercase. `NITAQ-001` from Counter `course` |
| courseName | String | yes | | **not unique**, yet it is the join key used by Enrollment/ClassSession/Payment/Attendance |
| category | enum 4 values | yes | | |
| description, speaActivity | String | | | |
| durationWeeks, totalSessions, sessionsPerWeek, hoursPerSession, totalHours | Number | | | |
| priceExVat | **Number** | yes | 0 | money (ex-VAT). **Never used for billing** |
| vatRate | Number | | 5 | per-course VAT. **Never used for billing** |
| maxStudentsPerBatch | Number | | | |
| status | enum Active/Coming Soon/Inactive | | Active | |
| deliveryMethod | enum | | | |
| assignedTeacherIds[] | Ref(OID) Teacher | | | |
| assignedTeacherNames[] | String | | | denormalized |
| batches[] | {batchId, batchName, start/endDate, schedule, format, trainerName(str), maxStudents, status enum Open/In Progress/Completed/Cancelled} | | [] | embedded (has _id). batchId from Counter `batch-<courseId>` |
Indexes: `{courseCode}` unique only.
Delete: hard (`courses/[id]/route.ts:116`). Enrollments keep the course name string.

### 1.6 ClassSession — `classsessions` — models/ClassSession.ts
Purpose: one delivered class for one Enrollment. Drives student hours and teacher pay.

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| enrollmentId | Ref(OID) Enrollment | yes | | |
| studentName, course | String | yes | | denormalized |
| teacherId | Ref(OID) Teacher | no | | |
| teacherName | String | yes | | snapshot |
| classDate | Date | yes | | |
| startTime, endTime | String "HH:MM" | no | | |
| deliveredHours | Number | yes | | min 0 |
| attendanceStatus | enum Present/Absent/Late/Excused | | Present | |
| classStatus | enum Scheduled/Completed/Cancelled/No Show | | Completed | |
| isChargeable | Boolean | | false | admin override |
| lessonTopic, notes, homework | String | | | |
| recordedBy | Ref(str) User.name | yes | | |
| payoutId | Ref(OID) TeacherPayout | | null | settlement stamp |
Indexes: `{enrollmentId:1,classDate:-1}`, `{teacherId:1,classDate:-1}`, unique partial `{enrollmentId,teacherName,classDate,startTime}` where startTime is a string.
Delete: hard, admin/manager. **Allowed even when payoutId is set.**

### 1.7 AttendanceSession — `attendancesessions` — models/Attendance.ts
Legacy batch attendance, separate from ClassSession.
| Field | Type | Req | Notes |
|---|---|---|---|
| course | Ref(str) Course.courseName | yes | |
| batchName | String | no | |
| sessionDate | Date | yes | |
| sessionNumber | Number | | |
| topic | String | | |
| trainerName | Ref(str) Teacher.fullName | no | **trainer authorization key** |
| records[] | {enrollmentId Ref(OID) Enrollment req, studentName req, status enum, notes} | | embedded, _id:false |
Index: `{course:1,sessionDate:-1}`. Delete: hard (trainer can delete own).

### 1.8 Teacher — `teachers` — models/Teacher.ts
| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| fullName | String | yes | | |
| fullNameAr, phone(req), email, emiratesId, nationality, specialisation, qualifications | String | | | **email is the link to User — not unique, not indexed** |
| tamamStatus | enum | | Not Registered | |
| tamamNumber | String | | | |
| contractStatus | enum | | No Contract | |
| contractStartDate, contractEndDate | Date | | | |
| paymentRate | **Number** | no | | money (hourly/class/monthly) |
| paymentType | enum Per Hour/Per Class/Per Course/Monthly/Per Session(legacy) | | Per Hour | |
| status | enum Active/Inactive | | Active | soft "archive" |
| notes | | | | |
No secondary indexes. Delete: hard (`teachers/[id]/route.ts:90`), no guard.

### 1.9 HourAdjustment — `houradjustments` — models/HourAdjustment.ts
| Field | Type | Req | Notes |
|---|---|---|---|
| enrollmentId | Ref(OID) Enrollment | yes | |
| adjustmentType | enum Add Hours/Deduct Hours/Correction | yes | Correction behaves like Deduct (`lib/hours.ts:279`) |
| hours | Number | yes | min 0.25 |
| reason | String | yes | 3-500 |
| createdBy | Ref(str) User.name | yes | |
Timestamps: createdAt only. Index `{enrollmentId:1,createdAt:-1}`. Append-only (no update/delete route).

### 1.10 TeacherPayout — `teacherpayouts` — models/TeacherPayout.ts
| Field | Type | Req | Notes |
|---|---|---|---|
| payoutNumber | String | yes | unique, `TP-0001` Counter `teacher-payout` |
| teacherId | Ref(OID) Teacher | yes | |
| teacherName | String | yes | snapshot |
| sessionIds[] | Ref(OID) ClassSession | | reverse of ClassSession.payoutId |
| periodFrom, periodTo | Date | | |
| basis | String (free) | yes | |
| rate, quantity, suggestedAmount | Number | | money-ish |
| amount | **Number** | yes | money paid |
| lines[] | {enrollmentRef **Ref(str)** Enrollment.enrollmentId, studentName, course, basis, rate, quantity, sessionCount, hours, amount, source} | | snapshot |
| adjustmentReason | String | | route-required when amount differs from suggested |
| paidDate | Date | yes | JE date |
| expenseAccountCode, paymentAccountCode | Ref(str) ChartOfAccount.code | yes | |
| journalEntryId | Ref(OID) JournalEntry | no | unset if posting failed |
| notes, createdBy(str) | | | |
Index `{teacherId:1,paidDate:-1}`. No update/delete/void route.

### 1.11 Payment — `payments` — models/Financial.ts
| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| paymentId | String | no | | unique, `P-001` Counter `payment` |
| enrollmentId | Ref(OID) Enrollment | no | | **not indexed**. Standalone payment = "advance" |
| studentName | String | yes | | copy |
| studentPhone, course | String | no | | copies |
| amount | **Number** | yes | | min 0. Refunds stored positive |
| paymentType | enum Full Payment/Instalment 1 of 2/Instalment 2 of 2/Deposit/Refund | yes | Full Payment | |
| paymentMethod | enum Bank Transfer/Cash/Card/Cheque/Online/Tabby | yes | Cash | |
| status | enum Received/Pending/Overdue/Refunded | yes | Received | mixes a schedule and a receipt in one doc |
| datePaid, dueDate | Date | no | | **Received with no datePaid is allowed** |
| receiptRef | String | no | | **not unique** |
| notes, recordedBy(str) | | | | |
| installmentNumber, totalInstallments | Number | | | |
| journalEntryId | Ref(OID) JournalEntry | no | | |
Indexes: `{paymentId}` unique; `{status:1,datePaid:-1}`; `{datePaid:-1}`.
Delete: hard, admin (`payments/[id]/route.ts:142`). Reverses the Receipt JE. **Does not adjust Enrollment.amountPaid.**

### 1.12 Expense — `expenses` — models/Financial.ts
| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| expenseId | String | no | | unique, `EXP-001` |
| category | enum 13 | yes | | not mapped to an account |
| amount | **Number** | yes | | VAT-inclusive total |
| expenseDate | Date | | Date.now | |
| payee, description, notes | String | | | |
| paymentMethod | enum | no | | |
| vatRate, vatAmount, amountBeforeVAT | Number | | 0 | |
| expenseAccountCode | Ref(str) COA | no | | falls back to defaultExpenseAccount |
| supplierId | Ref(OID) Supplier | no | | **never written by any route** |
| journalEntryId | Ref(OID) JournalEntry | no | | |
Indexes: `{expenseId}` unique; `{expenseDate:-1}`; `{category:1,expenseDate:-1}`. Delete: hard, reverses JE, no audit log.

### 1.13 Qualification — `qualifications` — models/Qualification.ts
| Field | Type | Req | Notes |
|---|---|---|---|
| title | String | yes | |
| awardingBody | String | yes | default Qualifi. `awardingBodies` enum exported but **not applied** |
| level | String | yes | |
| qualificationCode | String | no | not unique |
| credits, glh, tqt | Number | | |
| units[] | {unitCode req, unitTitle req, level, credits, glh, learningOutcomes, assessmentCriteria, isMandatory} | | _id:false. unitCode not unique within the array |
| tutorId, assessorId, iqaId | Ref(OID) **User** | no | |
| status | enum Active/Inactive/Pending Approval | | default Active |
Indexes `{awardingBody,status}`, `{level}`. No delete route. Model exported as `mongoose.models.Qualification ?? model(...)`, so it is typed `Model<any>`.

### 1.14 LearnerProfile — `learnerprofiles` — models/LearnerProfile.ts
| Field | Type | Req | Notes |
|---|---|---|---|
| enrollmentId | Ref(OID) Enrollment | yes | `unique` (1:1 with registration, not with the person) |
| fullName, phone | String | yes | copied from Enrollment at create |
| email, emiratesId, passportNumber, visaNumber, nationality, emergencyContact* | String | | copies/extra PII |
| emiratesIdExpiry, passportExpiry, visaExpiry, dateOfBirth | Date | | date-only |
| photoOnFile | Boolean | | false |
| documents[] | {docType enum, label, status enum, expiryDate, uploadRef, verifiedBy(str), verifiedAt, notes} | | embedded, replaced whole on PATCH |
| riskStatus | enum Low/Medium/High | | Low |
| riskNotes | String | | |
| commsLog[] | {note, by(str), at} | | unbounded |
| qualificationIds[] | Ref(OID) Qualification | | **never written by any route** |
| isActive | Boolean | | true (archive flag) |
Indexes: `enrollmentId` unique (path) **plus** `schema.index({enrollmentId:1})` (duplicate definition); text `{fullName}` (unused); `{riskStatus,isActive}`. No delete route.

### 1.15 LearnerAssessment — `learnerassessments` — models/LearnerAssessment.ts
| Field | Type | Req | Notes |
|---|---|---|---|
| learnerProfileId | Ref(OID) LearnerProfile | yes | |
| qualificationId | Ref(OID) Qualification | yes | |
| unitCode | String | yes | Ref(str) Qualification.units[].unitCode, **not validated** |
| unitTitle | String | yes | copy. Route may pass undefined, which fails validation |
| assignmentBrief, fileRef | String | | |
| dueDate, submittedAt, markingDeadline | Date | | |
| status | enum Not Submitted/Submitted/Under Assessment/Referred/Resubmitted/Passed | | |
| assessorId | Ref(OID) User | | |
| assessorFeedback, grade | String | | |
| resubmissions[] | {submittedAt, feedback, grade, by(str)} | | append via $push |
Indexes `{learnerProfileId}`, `{qualificationId,status}`, `{dueDate,status}`, `{markingDeadline,status}`. No uniqueness on (learner, qualification, unit). No delete.

### 1.16 IQASample — `iqasamples` — models/IQASample.ts
| Field | Type | Req | Notes |
|---|---|---|---|
| assessmentId | Ref(OID) LearnerAssessment | yes | unique index (one sample per assessment) |
| learnerProfileId | Ref(OID) LearnerProfile | yes | **client-supplied copy, not checked against the assessment** |
| qualificationId | Ref(OID) Qualification | yes | same |
| unitCode | String | yes | same (route allows "") |
| sampledBy | Ref(str) User.name | yes | |
| sampledAt | Date | | now |
| status | enum Planned/In Progress/Completed/Action Required | | Planned |
| outcome | enum Confirmed/Action Required/Referral Upheld/Referral Overturned/null | | null |
| feedback, actionRequired, actionDueDate, actionCompleted | | | |
Indexes `{learnerProfileId}`, `{qualificationId,status}`, `{assessmentId}` unique, `{sampledAt:-1}`.

### 1.17 StaffCompliance — `staffcompliances`
userId Ref(OID) User (optional); staffName/staffRole req; email, phone; documents[] {docType String, status String (**enum constants exist but are not applied**), issueDate, expiryDate, reference, notes}; notes; isActive (archive). Indexes text `{staffName}` (unused), `{isActive}`.

### 1.18 User — `users` — models/User.ts
name (req, **not unique, yet used as the ownership key everywhere**), email (req, unique, lowercase), password (select:false), role enum admin/manager/sales/finance/trainer/assessor/iqa/eqa/accountant (default sales), active (deactivate = archive), mobileNumber, lastLogin, twoFactorEnabled, twoFactorSecret/PendingSecret (select:false). Index: email unique. Delete: hard (`users/[id]/route.ts:80`), no guard.

### 1.19 AuditLog — `auditlogs`
userName/userRole/action/entity/entityId (String)/entityLabel/detail; createdAt only. Indexes `{createdAt:-1}`, `{userName,createdAt}`, `{entity,entityId}`. Written fire-and-forget (`lib/audit.ts`). No TTL, no immutability guard (no update/delete routes exist).

### 1.20 Notification — `notifications`
userEmail (Ref(str) User.email) or roleTarget (Ref(str) role); title; body; link; read (Boolean, **one flag shared by all recipients of a role**); createdAt. Indexes `{userEmail,read,createdAt}`, `{roleTarget,createdAt}`, TTL 60 days on createdAt.

### 1.21 ImpersonationToken — `impersonationtokens`
token (unique), targetUserId/createdById Ref(OID) User, target/createdBy email+name copies, isReturn, usedAt, expiresAt (req). TTL `expiresAt +300s`. Consumed atomically with `findOneAndUpdate({token, usedAt:{$exists:false}, expiresAt:{$gt:now}})` (`auth.ts:126-130`). OK.

### 1.22 Counter — `counters`
`{_id: String, seq: Number}`. `getNextSequence` = `findByIdAndUpdate($inc, upsert, new)`. Atomic, and the server retries an upsert on a duplicate `_id`. Keys: lead, enrollment, payment, expense, course, batch-<courseId>, journal-entry, student-ar-account, teacher-payout, supplier, supplier-bill, supplier-payment. Sequences can have gaps (a number is consumed before insert and the insert can fail).

### 1.23 Settings — `settings` (singleton)
Branding plus finance: currency, **vatEnabled, vatRate** (duplicates AccountingSettings), vatNumber, receiptPrefix, logoBase64. `getSettings` = `findOneAndUpdate({}, upsert)`. An empty filter has no unique key, so concurrent first calls can create two singletons.

### 1.24 Accounting models
**ChartOfAccount** `chartofaccounts`: code (unique, the join key for all journal lines, settings, suppliers, A/R), name, type enum, category, subCategory, mainAccount, parentCode Ref(str) self, isPosting, openingDebit/openingCredit (**Number**, editable at any time outside the journal), isActive, isSystem. Indexes `{type,isPosting}`, `{parentCode}`, text `{name}` (unused). Delete blocked if isSystem, used in any JE line, or has children.

**JournalEntry** `journalentries`: jvNumber (unique, `JV-000001`), date (Date), description, reference, sourceType enum (JV/Invoice/Receipt/Expense/SupplierBill/SupplierPayment/Refund/Advance/Opening/Reversal), sourceId (**String** of the source `_id`, polymorphic, no ref), sourceNumber, status enum Draft/Posted/Reversed/Cancelled (default Draft), lines[] {accountCode Ref(str) COA, accountName (copy), debit, credit (**Number**, min 0), description, studentRef/supplierRef/courseRef (name strings)}, totalDebit, totalCredit, createdBy/postedBy (str), postedAt, reversedByEntryId / reversesEntryId Ref(OID) self, attachment (select:false, base64 ≤1.5 MB inline). Indexes `{date:-1,status:1}`, `{"lines.accountCode":1,date:1}`, `{sourceType:1,sourceId:1}` (non-unique on purpose; the engine drops any legacy unique copy at runtime, `engine.ts:54-62`). **No schema-level immutability or balance validator.**

**AccountingSettings** (singleton, `findOne`/`create` race): account-code mappings (strings), courseRevenueMap (Map<string,string>, documented as keyed by **category**), vatEnabled/vatRate, autoPost* toggles, lockDate (Date).

**Supplier**: supplierCode (unique, also its COA account code), name, contact fields, trn, vatRegistered, defaultExpenseAccountCode, openingBalance (**Number**, duplicates COA openingCredit), isActive.

**SupplierBill**: billNumber unique `SB-0001`, supplierId Ref(OID) Supplier req, supplierName copy, billDate req, dueDate, reference (supplier invoice no., **not unique per supplier**), expenseAccountCode req, amountBeforeVAT/vatRate/vatAmount/totalAmount/amountPaid (**Number**), status enum Unpaid/Partially Paid/Paid/Cancelled (Cancelled never set by any route), journalEntryId. Indexes `{supplierId,status}`, `{billDate:-1}`.

**SupplierPayment**: paymentNumber unique `SPY-0001`, supplierId req, supplierName, billId Ref(OID) SupplierBill (**not checked to belong to the supplier**), paymentDate, amount (min 0.01), paymentAccountCode, reference, notes, journalEntryId, createdBy. Index `{supplierId,paymentDate:-1}`.

---

## 2. Relationship diagrams (derived from the write paths)

Legend: `==>` ObjectId ref · `-->` string ref (name/code/email) · `..>` copied (denormalized) values · `[x]` write site

### 2.1 Lead → FollowUp → EnrollmentRequest → Enrollment
```
                 assignedTo/createdBy --> User.name (sales scoping, case-insensitive name match)
 +---------+
 |  Lead   |<==leadId== FollowUp  (contactName/phone ..> copied; leadId optional, unvalidated)
 | leadId  |             [leads/[id] PATCH closed stage: FollowUp.updateMany{leadId,Pending}->Done]
 | stage   |
 | course  |--> constants/leads.courseList (NOT Course collection)
 +---------+
    |  \
    |   \==leadId== EnrollmentRequest (leadRef/leadName/leadPhone/course ..> copies,
    |                  salesEmail --> User.email)   status Pending->Approved (no side effects)
    |                         |
    |                         | UI link /enrollments?name&phone&course  (NO leadId passed)
    |                         v
    |               POST /api/enrollments  --> Enrollment{leadId: undefined}
    |
    | PATCH stage -> "Enrolled" (only this stage, not "Paid")
    |   [leads/[id]/route.ts:183-212] findOne({leadId}) then create  (non-atomic, no unique idx)
    v
 +-------------------------------------------------------------+
 | Enrollment  enrollmentId E-###  leadId==>Lead               |
 |  fullName/phone/email ..> from Lead (stale after lead edit) |
 |  course --> Lead.course | Lead.customCourse (string)        |
 |  totalFee 0, amountPaid 0, paymentStatus "Instalment 1 Paid"|
 +-------------------------------------------------------------+
```

### 2.2 Enrollment → Course / Teacher / ClassSession / Attendance / Hours
```
 Course{courseCode*, courseName, batches[]{batchName, trainerName-->Teacher.fullName}}
   ^  assignedTeacherIds[] ==> Teacher,  assignedTeacherNames[] ..>
   |
   | course --> Course.courseName   (string; GET /api/courses counts by name)
   | batchName --> Course.batches[].batchName
   |
 Enrollment ---- teacherId ==> Teacher (primary; should equal teacherIds[0])
   |        ---- teacherIds[] ==> Teacher ; teacherName/teacherNames ..> Teacher.fullName
   |        ---- teacherPayRate/Basis (overrides Teacher.paymentRate/paymentType)
   |        ---- completedHours  <= recalc(lib/hours.ts) from ClassSession + HourAdjustment
   |
   |<==enrollmentId== ClassSession{teacherId==>Teacher, teacherName..>, studentName..>, course..>,
   |                               payoutId==>TeacherPayout}
   |<==enrollmentId== HourAdjustment (append-only)
   |<==records[].enrollmentId== AttendanceSession{course-->Course.courseName,
   |                                              trainerName-->Teacher.fullName}
   |<==enrollmentId (unique)== LearnerProfile
   '<==enrollmentId== Payment

 Teacher{email} --> User.email  (lib/teacher.ts getTeacherForUser: findOne by email; not unique)
```

### 2.3 Enrollment → Payment → JournalEntry (+ per-student A/R account)
```
 Enrollment POST/PATCH(totalFee changed)
   [postings.postStudentInvoice]  sourceType=Invoice, sourceId=String(enrollment._id)
      Dr  COA[Enrollment.arAccountCode]  (created on demand: 10103##### via Counter student-ar-account,
                                           name "<fullName> (E-###)", parentCode 10103)
      Cr  resolveRevenueAccount(course NAME) -> courseRevenueMap[course] || defaultRevenueAccount
      Cr  outputVatAccount (VAT extracted from totalFee as inclusive, AccountingSettings.vatRate)

 Enrollment POST(amountPaid>0) / PATCH(amountPaid increased by delta)
   --> Payment{enrollmentId==>Enrollment, amount=delta, datePaid=new Date()}
   [postings.postCustomerReceipt]  sourceType=Receipt, sourceId=String(payment._id)
      Dr  resolvePaymentAccount(method)   Cash/POS/Tabby/Bank
      Cr  student A/R account (enrollmentId given) | feesAdvanceAccount (no enrollmentId)
   Payment.journalEntryId ==> JournalEntry

 POST /api/payments (direct)  --> Payment (Enrollment.amountPaid NOT updated)
   status Received -> Receipt JE  (paymentType "Refund" also posts Dr Cash / Cr A/R)

 PATCH /api/payments/[id]  amount/method/datePaid/status change:
   reverseEntryForSource("Receipt", id)  -> original.status=Reversed, new JE sourceType=Reversal
   update.journalEntryId = undefined   (STRIPPED by Mongoose -> old id stays)
   repost only if !payment.journalEntryId  -> never happens

 DELETE payment  -> reverse Receipt JE      (Enrollment.amountPaid unchanged)
 DELETE enrollment -> reverse Invoice JE     (Payments + Receipt JEs remain, A/R goes negative)

 JournalEntry{sourceType,sourceId(str)}  1 active entry per source: check-then-insert in engine
 JournalEntry{reversedByEntryId ==> JE, reversesEntryId ==> JE}
 All report queries: status="Posted" AND sourceType!="Reversal"   (a reversed pair vanishes
 from every period, including the original's period)
```

### 2.4 Teacher → HourAdjustment / TeacherPayout → JournalEntry
```
 Teacher{paymentRate, paymentType}
   |
   |<==teacherId== ClassSession{payoutId:null}  --previewTeacherPayout(lib/payroll.ts)-->
   |                   grouped by enrollmentId; rate = Enrollment.teacherPayRate || Teacher.paymentRate
   |
 POST /api/teacher-payouts
   1. preview (read)                                         (no lock / transaction)
   2. TeacherPayout.create{teacherId==>Teacher, sessionIds[]==>ClassSession,
                           lines[]{enrollmentRef-->Enrollment.enrollmentId ..snapshots}}
   3. ClassSession.updateMany({_id:{$in:sessionIds}}, {$set:{payoutId}})   (no payoutId:null guard)
   4. createJournalEntry sourceType="Expense", sourceId=String(payout._id)
        Dr expenseAccountCode (teacherSalaryAccount)  Cr paymentAccountCode (cash)
      TeacherPayout.journalEntryId ==> JournalEntry   (left unset if step 4 fails; no retry/backfill)

 HourAdjustment{enrollmentId==>Enrollment}  -> recalcEnrollmentHours -> Enrollment.completedHours
 (HourAdjustment has no link to Teacher or to pay)
```

### 2.5 Qualification / LearnerProfile / LearnerAssessment / IQASample
```
 User <==tutorId/assessorId/iqaId== Qualification{units[]{unitCode}}
                                         ^            ^
                    qualificationIds[]== |            | unitCode --> units[].unitCode (unvalidated)
                    (never written)      |            |
 Enrollment <==enrollmentId(unique)== LearnerProfile  |
                                         ^            |
                                         |            |
                 learnerProfileId ==     |            |== qualificationId
                                  LearnerAssessment{unitCode, unitTitle..>, assessorId==>User}
                                         ^
                                         | assessmentId (unique)
                                  IQASample{ learnerProfileId==>LearnerProfile  (copy, unverified)
                                             qualificationId==>Qualification   (copy, unverified)
                                             unitCode (copy, unverified)
                                             sampledBy --> User.name }
 StaffCompliance{userId==>User optional, staffName/email copies}
```

### 2.6 Users / AuditLog / Notification / ImpersonationToken / Counter / Settings
```
 User{_id, name, email*, role}
   <--userName (string)---------- AuditLog{entity, entityId(str)}   (fire-and-forget)
   <--userEmail | roleTarget----- Notification{read (shared per role doc)}  TTL 60d
   <==targetUserId/createdById=== ImpersonationToken{token*, usedAt, expiresAt}  TTL
   <--name------------------------ Lead.assignedTo/createdBy, FollowUp.*, ClassSession.recordedBy,
                                   HourAdjustment.createdBy, TeacherPayout.createdBy, JE.createdBy/postedBy,
                                   IQASample.sampledBy, EnrollmentRequest.salesName
   <--email----------------------- Teacher.email (trainer identity), EnrollmentRequest.salesEmail
 Counter{_id:key, seq}  <- every human ID and JV number
 Settings (singleton, branding + duplicate VAT)   AccountingSettings (singleton, posting map + lockDate)
```

---

## 3. Migration conventions found
- `scripts/` holds only `dev-db.mjs` (in-memory Mongo) and `seed-dev.ts`. The seed defines its **own** `User` schema (`phone` instead of `mobileNumber`, no 2FA fields).
- There is no migrations folder, no versioning and no migration log. Migrations ship as HTTP POST routes run by an admin:
  - `app/api/accounting/backfill/route.ts` (post JEs for existing enrollments/payments/expenses; "idempotent" via an in-memory `have` set plus the engine's duplicate guard; misses payouts/supplier docs)
  - `app/api/admin/backfill-payments/route.ts` (creates Payments from Enrollment.amountPaid; no JE, no dry-run)
  - `app/api/admin/migrate-roles/route.ts` (staff -> sales)
  - `app/api/accounting/receivables/route.ts` POST (**rewrites lines of Posted JEs** by student name)
  - `lib/accounting/engine.ts:54-62` drops an index at runtime on first posting
- No backup/snapshot step, batch/resume support, or count/checksum validation in any of them.
