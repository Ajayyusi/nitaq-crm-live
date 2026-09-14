> **Audit document — generated during the full-system audit on 2026-09-14 (branch `audit/full-system-debug`).**
> File:line references point at the code as it was at commit `b2962a9`, before the audit fixes.
> Many findings below are now fixed — the authoritative status of every issue is the register in [SYSTEM_AUDIT.md](SYSTEM_AUDIT.md).

# Nitaq CRM: Multi-Tenancy Readiness

Scope: analysis only, no code changed. Repo `C:\Users\User\nitaq-crm-live`, branch `audit/full-system-debug` @ `b2962a9`.
Stack: Next.js 16 App Router, Mongoose 8 on MongoDB, NextAuth v5 beta (JWT sessions, Credentials provider).
Date: 2026-09-14.

> **Baseline note.** Analysis is anchored to commit `b2962a9`. While it was being written, another session had uncommitted changes in progress: 41 modified files plus a new `lib/money.ts`.
> - Accounting routes, `lib/accounting/engine.ts`, `lib/api-auth.ts`, `lib/audit.ts`, `models/accounting/JournalEntry.ts`.
> - `requireAuth` now fails closed.
> - `logAudit` is now awaited.
> - A partial unique index `uniq_posted_entry_per_source` was added.
>
> Where these changes affect a conclusion, the draft says so. Line numbers in files under active edit may drift. None of the changes add tenancy.

---

## 1. Current state and difficulty rating

### 1.1 What exists today

The app is strictly single-tenant. There is no `organization`, `tenant`, `academy` or `branch` concept anywhere in `models/`, `lib/` or `app/`. Every query runs against the whole collection.

| Measure (from grep) | Count |
|---|---|
| Model files in `models/` (`Financial.ts` defines two models, Payment and Expense) | 28 files, 29 models |
| API route handlers (`app/api/**/route.ts`) | 72 |
| Routes that call `requireAuth` | 70 of 72 (exceptions: NextAuth handler, `impersonate/exit`, which checks the session itself) |
| `requireAuth(...)` calls | 122 |
| Routes with an id/code path param (`[id]`, `[code]`, `[entity]`) | 23 |
| Direct `Model.<op>(` call sites in `app/api` | 231, across 70 files |
| Direct call sites in server pages (`dashboard`, `finance`, `reports` `page.tsx`) | 57, in 3 files |
| Direct call sites in `lib/` | 23 at HEAD (engine 8, postings 4, payroll 4, hours 3, others); 27 in the current working tree |
| Direct call sites in `models/` helpers (Counter, Settings, AccountingSettings) | 4 |
| Direct call sites in `auth.ts` | 4 |
| **Total direct call sites in the running app** | **~319-323** |
| `doc.save()` on loaded documents | 25 at HEAD, 23 in the working tree |
| Multi-document transactions (`startSession`/`withTransaction`) | 0 |
| `.aggregate(` pipelines | 41 (reports page 14, finance page 8, reports/export 8, dashboard 3, others) |
| id-based lookups (`findById` 48, `findByIdAndUpdate` 16, `findByIdAndDelete` 10) | 74 |
| Files that import a model directly | 81 |
| `.populate(` / `$lookup` | 0 / 0 |
| Raw `Model.collection.*` access | 1 (`lib/accounting/engine.ts:58-62`, drops an index at runtime) |
| `getNextSequence` call sites | 22, over 12 counter names |
| Globally `unique` business keys | 12 (section 2.2) |
| Singleton documents | 2 (`Settings`, `AccountingSettings`) |
| Files with hardcoded "Nitaq" branding | 20 |

Breakdown of the direct call sites by operation (app + lib): `find` 83, `findById` 49, `create` 45, `aggregate` 41, `findOne` 28, `countDocuments` 28, `findByIdAndUpdate` 16, `findByIdAndDelete` 10, `updateOne` 7, `updateMany` 5, `findOneAndUpdate` 2, `exists` 1.

There is no repository or data-access layer. Route handlers and server components import Mongoose models and query them inline. `lib/db.ts` is only a cached `mongoose.connect(MONGODB_URI)`.

### 1.2 What helps

- **One auth chokepoint.** `lib/api-auth.ts#requireAuth` is used by 70/72 routes and already does a live DB re-check of `active` and `role`. That is the natural place to resolve and verify the active tenant.
- **No `populate` or `$lookup`.** Nothing joins across collections at the database level, so no joins can silently cross tenants. All cross-collection reads are explicit second queries by ObjectId.
- **Ledger funnel.** Every journal entry goes through `lib/accounting/engine.ts#createJournalEntry`, and all postings go through `lib/accounting/postings.ts`.
- **No external per-tenant secrets yet.** WhatsApp is click-to-chat only (`lib/whatsapp.ts` builds `wa.me` links), there is no SMTP, no object storage, no cron, and the only env var is `MONGODB_URI` (plus NextAuth's implicit `AUTH_SECRET`).
- **Attachments are small and inline.** They are stored in the DB (`JournalEntry.attachment.dataBase64`, `Settings.logoBase64`), so they are isolated automatically once their parent document is scoped.
- **Test infrastructure.** `mongodb-memory-server` with `tests/helpers/db.ts` is the right base for two-tenant isolation tests.
- **Small codebase.** About 29 models and 72 routes.

### 1.3 What hurts

- About 319 unscoped call sites across 81 files. Every one must change or be caught by a guard.
- **The ledger is keyed by string account codes that are identical in every tenant.** They come from the same seed (`lib/accounting/coa-seed.ts`), and `ChartOfAccount.code` is globally unique. An unscoped `ChartOfAccount.find({ code: { $in } })` in `engine.ts:139` (`loadPostingAccounts`) would *succeed* against another tenant's accounts instead of failing. That is the worst kind of leak: silent, financial, and it looks correct.
- Two singletons, one global counter namespace, and 12 globally unique business numbers. Voucher and receipt numbers would interleave across tenants, which breaks sequential numbering expectations for tax documents.
- Ownership is keyed by display name in places: `Lead.assignedTo`/`createdBy` are matched by name regex, and `JournalEntry.createdBy` is a name. User-to-teacher linking is by email (`lib/teacher.ts:10`). Both become ambiguous once one identity can belong to several academies.
- Roles live on `User.role` (global) and in the JWT. Per-academy roles need a membership model plus session changes in `auth.ts`, `auth.config.ts` and `proxy.ts`.
- Academy-specific configuration is hardcoded as Mongoose `enum`s and constants: course categories, expense categories, payment methods (Tabby/Tamara), lead sources, course list, and the UAE country code.

### 1.4 Rating: Medium-High (6.5 / 10)

This is not a rewrite. Data shapes are simple, there are no DB joins, and auth is centralised. It is still a broad, mechanical change with a high blast radius. Every one of the ~319 call sites is a potential cross-tenant read or write, and the accounting module can leak *without erroring* because account codes collide by design. The real risk is less the volume of work than the need for fail-closed enforcement so that a missed call site cannot leak.

Rough total: **11-17 engineer-weeks for one experienced developer**, of which about 2-3 weeks (Phase 0) is useful even if multi-tenancy is never shipped. See section 5.

---

## 2. Models needing `organizationId` and globally unique values

### 2.1 Model classification

**Tenant-owned: add `organizationId` (required, indexed, immutable)**

| # | Model | File | Notes |
|---|---|---|---|
| 1 | Lead | `models/Lead.ts` | `assignedTo`/`createdBy` are name strings |
| 2 | FollowUp | `models/FollowUp.ts` | same |
| 3 | EnrollmentRequest | `models/EnrollmentRequest.ts` | `salesEmail` string |
| 4 | Enrollment | `models/Enrollment.ts` | `course` is a name string; `arAccountCode` references COA by code |
| 5 | LearnerProfile | `models/LearnerProfile.ts` | personal data (Emirates ID, emergency contact) |
| 6 | LearnerAssessment | `models/LearnerAssessment.ts` | |
| 7 | IQASample | `models/IQASample.ts` | |
| 8 | Qualification | `models/Qualification.ts` | could later become a platform catalogue plus a tenant copy |
| 9 | StaffCompliance | `models/StaffCompliance.ts` | personal data |
| 10 | Course (embedded `batches`) | `models/Course.ts` | |
| 11 | ClassSession | `models/ClassSession.ts` | |
| 12 | AttendanceSession | `models/Attendance.ts` | |
| 13 | HourAdjustment | `models/HourAdjustment.ts` | |
| 14 | Teacher | `models/Teacher.ts` | linked to logins by email |
| 15 | TeacherPayout | `models/TeacherPayout.ts` | financial |
| 16 | Payment | `models/Financial.ts` | financial |
| 17 | Expense | `models/Financial.ts` | financial |
| 18 | ChartOfAccount | `models/accounting/ChartOfAccount.ts` | financial; code is the ledger key |
| 19 | JournalEntry | `models/accounting/JournalEntry.ts` | financial; includes attachment blob |
| 20 | Supplier | `models/accounting/Supplier.ts` | |
| 21 | SupplierBill | `models/accounting/SupplierBill.ts` | financial |
| 22 | SupplierPayment | `models/accounting/SupplierPayment.ts` | financial |
| 23 | Settings | `models/Settings.ts` | singleton, becomes one per org |
| 24 | AccountingSettings | `models/accounting/AccountingSettings.ts` | singleton, becomes one per org |
| 25 | Counter | `models/Counter.ts` | key becomes `(organizationId, name)` |
| 26 | AuditLog | `models/AuditLog.ts` | also add actor ids (section 4.5) |
| 27 | Notification | `models/Notification.ts` | `roleTarget` is currently global |
| 28 | ImpersonationToken | `models/ImpersonationToken.ts` | a tenant admin may only mint tokens for the same org |

**Global (platform) models**

- `User` stays a global identity (email, password hash, 2FA). `role` moves out to a membership.
- New: `Organization` (tenant), `Membership` (`userId`, `organizationId`, `roles[]`, `branchIds[]`, `teacherId?`, `status`), `PlatformAuditLog`, `SupportAccessGrant`. Later: `Branch`, `Plan`/`Subscription`, `TenantIntegration`.

Subdocuments (`Course.batches`, `JournalEntry.lines`, `AttendanceSession.records`, `TeacherPayout` lines, `LearnerProfile` embedded arrays) inherit the parent's scope and do not need their own field.

### 2.2 Unique indexes that must become tenant-scoped

| Model . field | Where | Today | Target |
|---|---|---|---|
| `User.email` | `models/User.ts:27` | global unique | **Keep global** (identity). The create-user flow at `app/api/users/route.ts` (409 "An account with this email already exists") becomes "invite/attach existing identity", which must not reveal other tenants. |
| `Lead.leadId` (`L-001`) | `models/Lead.ts:38-41` | global unique, field not required | `{organizationId, leadId}` unique, partial on `leadId` exists. The current non-sparse unique on an optional field allows only one document without `leadId`. |
| `Enrollment.enrollmentId` (`E-001`) | `models/Enrollment.ts:68` | global unique, not required | `{organizationId, enrollmentId}` unique, partial |
| `Payment.paymentId` (`P-001`) | `models/Financial.ts:77` | global unique, not required | `{organizationId, paymentId}` unique, partial |
| `Expense.expenseId` (`EXP-001`) | `models/Financial.ts:142` | global unique, not required | `{organizationId, expenseId}` unique, partial |
| `Course.courseCode` (`NITAQ-001`) | `models/Course.ts:75-80` | global unique | `{organizationId, courseCode}` unique. The `NITAQ-` prefix is hardcoded in `app/api/courses/route.ts:73`. |
| `TeacherPayout.payoutNumber` (`TP-0001`) | `models/TeacherPayout.ts:49` | global unique | `{organizationId, payoutNumber}` |
| `ChartOfAccount.code` | `models/accounting/ChartOfAccount.ts:25` | global unique | `{organizationId, code}`. **Critical**: every tenant is seeded with the same codes. |
| `JournalEntry.jvNumber` (`JV-000001`) | `models/accounting/JournalEntry.ts:73` | global unique | `{organizationId, jvNumber}` |
| `JournalEntry` `uniq_posted_entry_per_source` `{sourceId, sourceType}` partial (status Posted) | `models/accounting/JournalEntry.ts:118-125` (uncommitted, working tree) | unique partial | Safe as is, because `sourceId` is an ObjectId string. Rebuild as `{organizationId, sourceId, sourceType}` with the same partial filter for query efficiency. The comment refers to `scripts/migrations/find-duplicate-postings.ts`, which does not exist in the tree yet. |
| `Supplier.supplierCode` (`SP001`) | `models/accounting/Supplier.ts:21` | global unique | `{organizationId, supplierCode}`. It is also a COA code (`app/api/accounting/suppliers/route.ts:88-91`). |
| `SupplierBill.billNumber` (`SB-0001`) | `models/accounting/SupplierBill.ts:29` | global unique | `{organizationId, billNumber}` |
| `SupplierPayment.paymentNumber` (`SPY-0001`) | `models/accounting/SupplierPayment.ts:21` | global unique | `{organizationId, paymentNumber}` |
| `Counter._id` (sequence name) | `models/Counter.ts:4` | global string `_id` | `_id: "<orgId>:<name>"` (keeps the atomic `findByIdAndUpdate` upsert) or `{organizationId, name}` unique |
| Settings singleton | `models/Settings.ts:52-58` (`findOneAndUpdate({})`) | "first document" | `{organizationId}` unique |
| AccountingSettings singleton | `models/accounting/AccountingSettings.ts:76-80` (`findOne()`) | "first document" | `{organizationId}` unique |
| `LearnerProfile.enrollmentId` | `models/LearnerProfile.ts:96` | unique ObjectId | can stay (ObjectIds are globally unique); add the org prefix for query efficiency |
| `IQASample.assessmentId` | `models/IQASample.ts:56` | unique ObjectId | can stay |
| ClassSession duplicate guard | `models/ClassSession.ts:63-66` `{enrollmentId, teacherName, classDate, startTime}` | unique partial | can stay (ObjectId prefix) |
| `ImpersonationToken.token` | `models/ImpersonationToken.ts:26` | random 32-byte hex | can stay global |

**Uniqueness enforced in code (also an existence oracle across tenants)**

- `Lead.findOne({ phone })`: `app/api/import/[entity]/route.ts:71`, `app/api/leads/import`
- `Enrollment.findOne({ phone, course })`: `import/[entity]/route.ts:130`
- `Teacher.findOne({ phone })`: `import/[entity]/route.ts:209`
- the duplicate-key message for `courseCode`: `import/[entity]/route.ts:193`
- `ChartOfAccount.findOne({ code })` in `app/api/accounting/seed-coa/route.ts:25`
- the supplier code check in `suppliers/route.ts:71`

Unscoped, each of these tells tenant B that tenant A has a lead or trainer with that phone.

**Sequence-numbered documents (22 `getNextSequence` sites, 12 names)**

`lead`, `enrollment`, `payment`, `expense`, `course`, `batch-<courseId>`, `supplier`, `supplier-bill`, `supplier-payment`, `teacher-payout`, `journal-entry`, `student-ar-account`.

`student-ar-account` also *generates COA codes* (`10103` + seq, `lib/accounting/postings.ts:53-55`), so it must be per tenant or the per-tenant codes will collide or leave gaps.

`Settings.receiptPrefix` exists but is not used by any ID generator. Per-tenant prefixes are a natural addition at the same time.

### 2.3 Non-unique, text and TTL indexes

- Every existing compound index should gain `organizationId` as its **leading** key, or tenant-scoped list queries will scan other tenants' data. Examples:
  - `AuditLog {createdAt:-1}` becomes `{organizationId, createdAt:-1}`
  - `JournalEntry {"lines.accountCode":1, date:1}` becomes `{organizationId, "lines.accountCode", date}`
  - `JournalEntry {date:-1, status:1}`, `Payment {status, datePaid}`, `Enrollment {status, createdAt}`
- Text indexes (one per collection in MongoDB):
  - `Lead.ts:116`
  - `LearnerProfile.ts:122`
  - `ChartOfAccount.ts:43`
  - `Supplier.ts:36`
  - `StaffCompliance.ts:73`

  Recreate each as `{organizationId: 1, <field>: "text"}`. Any `$text` query must then include an equality on `organizationId`. The global search route uses regex, not `$text`, so it is unaffected by this but still needs scoping.
- TTL indexes (`Notification.ts:32`, `ImpersonationToken.ts:41`) need no change.
- **Mongoose `autoIndex` caveat.** Models build indexes on first compile, but Mongoose never drops the old global unique indexes. Changing `unique: true` in a schema leaves the old index in place, and the second tenant's `JV-000001` then fails with E11000. Index changes must be explicit migrations, with `autoIndex` off in production.

---

## 3. Singletons and global config that must become per tenant

| Item | Location | Why it matters |
|---|---|---|
| **Settings singleton** | `models/Settings.ts` (`getSettings` = `findOneAndUpdate({}, …, upsert)`) | Academy name EN/AR, phone, WhatsApp number, email, address, city, logo (base64), currency, **VAT enabled/rate/TRN (`vatNumber`)**, receipt prefix. `GET /api/settings` is **unauthenticated** (`app/api/settings/route.ts:6`) and the login page reads it (`app/login/page.tsx:10`). Pre-login branding needs tenant resolution from the host (subdomain or custom domain), not from the session. |
| **AccountingSettings singleton** | `models/accounting/AccountingSettings.ts` (`findOne()`, else `create({})`) | Maps concepts to COA codes, with defaults hardcoded to Nitaq's COA (`1010200001` "RAK Bank", Tabby/Tamara, etc.). Also holds `courseRevenueMap`, auto-post toggles and the **books `lockDate`**. VAT is duplicated here and in `Settings` (two sources of truth); consolidate into one per-tenant tax profile. |
| **Chart of accounts seed** | `lib/accounting/coa-seed.ts` (1,154 lines, "AUTO-GENERATED from Chart_of_Accounts-NITAQ.xlsx"); `app/api/accounting/seed-coa/route.ts` | This is Nitaq's own COA, including bank names. The seed route also creates three **Nitaq-specific suppliers** (Etisalat, DEWA, Abu Khamseen Towers) as `SP001-003`, and `suppliers/route.ts:68` offsets the sequence by 3 because of them. Needs to become a **platform COA template** (a UAE training-centre template) copied into each tenant at onboarding, without the suppliers. |
| **Counters** | `models/Counter.ts` | Global sequence namespace (12 names). Per-tenant sequences are required. Tax invoices and receipts need an unbroken sequence per legal entity, and shared counters would also reveal other tenants' volumes. |
| **Schema enums and constants** | `models/Course.ts:3` `courseCategories`; `models/Financial.ts:3,22` `paymentMethods`, `expenseCategories`; `constants/leads.ts` `leadStages`, `leadSources`, `courseList`; `constants/modelConstants.ts` (Tamam statuses, trainer pay types, etc.) | Other academies will want their own categories, sources and payment methods. Enum validation has to move from the Mongoose schema to validation against tenant config, with the platform defaults as the seed. `courseRevenueMap` is keyed by these category labels. |
| **Roles and permissions** | `lib/permissions.ts` (`ALL_ROLES`, `PAGE_PERMISSIONS`, `SIDEBAR_VISIBILITY`, `IMPORT_EXPORT_PERMISSIONS`); `models/User.ts:3` `userRoles` | Fine as platform-wide definitions for v1. What changes is *where the role comes from*: `Membership`, not `User.role`. There is no platform (super admin) role today. `admin` is effectively "company admin". |
| **Country and phone default** | `lib/whatsapp.ts:12` `DEFAULT_COUNTRY_CODE = "971"` | Per-tenant default country. All current tenants being UAE makes this low priority. |
| **Currency and locale** | `"AED "` hardcoded in `app/(dashboard)/reports/page.tsx:27` and `app/api/search/route.ts:183`, plus other formatters | Should read `Settings.currency`. |
| **Timezone** | Month and day boundaries use server-local `new Date(y, m, 1)` (e.g. `reports/page.tsx:43`, dashboard) | Needs a per-tenant timezone (`Asia/Dubai` default). Latent bug today on UTC servers such as Vercel. |
| **Branding strings** | 20 files, e.g. `app/layout.tsx:22`, `app/manifest.ts:5`, `app/login/page.tsx:11,60`, `app/api/reports/export/route.ts:46`, `app/(dashboard)/collections/page.tsx:30` (WhatsApp template "this is Nitaq Academy"), export filenames `nitaq_*.csv`, `app/(dashboard)/accounting/page.tsx:149` | Must read tenant settings. |
| **Messaging credentials** | none today | When WhatsApp Business API, email or SMS is added, store them in a `TenantIntegration` collection with envelope-encrypted secrets, never in env. The platform-default sender can live in env. |
| **Env config** | only `MONGODB_URI` (`lib/db.ts:3`); `scripts/seed-dev.ts` uses `SEED_ADMIN_*` | Stays platform-level. A tenant-to-database registry would only be needed for the DB-per-tenant option. |
| **In-process caches** | `lib/api-auth.ts:14` `userStateCache` keyed by `userId`; `lib/rate-limit.ts:11` buckets; `lib/accounting/engine.ts:53` `indexChecked` | Cache key must become `userId:orgId` (the role is per membership). Rate limits need per-tenant keys and, for noisy-neighbour protection across serverless instances, a shared store (Redis/Upstash). The runtime index drop must move into a migration (section 6). |

---

## 4. Isolation strategy

### 4.1 Options

| | A. Shared DB + `organizationId`, enforced in code | B. Database per tenant | C. Hybrid (A by default, B for specific tenants) |
|---|---|---|---|
| Isolation strength | Logical. MongoDB/Atlas has no row-level security equivalent, so enforcement is entirely in application code and tests. | Physical. A missed filter cannot cross tenants. | Per tenant |
| Code change | ~319 call sites plus a guard plugin; models unchanged | **All 28 model files** register on the default connection (`mongoose.models.X \|\| mongoose.model(...)`) and 81 files import them directly. Each would need a per-request `connection.useDb(tenantDb).model(...)` lookup: every import changes. | A now; B later only if the data layer takes a context object (Phase 0 makes that possible) |
| Ops | One cluster, one migration run, one backup | N migrations per deploy, N index builds, per-DB backups; Atlas connection and collection limits grow with tenants | Two paths to maintain |
| Cross-tenant reporting (platform billing, usage) | Easy | Fan-out queries | Mixed |
| Tenant export and deletion | `find({organizationId})` over 28 collections; deletion must respect retention | Drop or dump the DB (trivial) | Mixed |
| Data residency | One region (Atlas UAE region, see below) | Per-tenant region possible | Enterprise tenants in their own DB or cluster |
| Cost for a small team | **Lowest** | High | Medium, deferred |

### 4.2 Recommendation

**Option A now, with the data access designed so Option C remains possible.** Reasons: a small team, fewer than tens of tenants in the first year, identical schema for all academies, and a codebase where DB-per-tenant would force touching every model import for little near-term benefit. Offer DB-per-tenant (or a dedicated cluster) later only as an enterprise or regulatory tier.

Because MongoDB has no RLS, enforcement must be **defence in depth and fail-closed**:

1. **Explicit tenant context.** `requireAuth` becomes `requireTenant()` and returns `ctx = { userId, organizationId, roles, branchIds, requestId, impersonatorId? }`. The `organizationId` comes only from the verified session plus a live membership check, never from the request body, query or headers. Server pages use an equivalent `requireTenantPage()` instead of raw `auth()` (the dashboard, finance and reports pages currently call `auth()` and query directly).
2. **A thin repository/scoping layer.** For example `db(ctx).Lead.find(filter)`, which merges `{organizationId: ctx.organizationId}` into filters, sets it on creates, and prepends `{$match: {organizationId}}` to aggregate pipelines. Services such as `lib/accounting/engine.ts` and `postings.ts` take `ctx` as their first argument, which also forces the change through the TypeScript compiler.
3. **A Mongoose guard plugin, applied globally and in assert mode (not inject mode).**
   - `pre` hooks on `find*`, `count*`, `distinct`, `update*`, `delete*`, `replaceOne`, `findOneAndX`: **throw** if the filter lacks an `organizationId` equality.
   - `pre('aggregate')`: throw unless the first stage is a `$match` on `organizationId`.
   - `pre('validate')` on save and `insertMany`: require `organizationId`.
   - `pre('updateOne'/'findOneAndUpdate')`: reject any `$set` of `organizationId`, and mark the field `immutable`.
   - Escape hatch: an explicit per-query option such as `{ platformScope: true }`, used only by platform jobs and written to the platform audit log.

   Asserting rather than silently injecting means a forgotten filter fails loudly in tests and CI instead of relying on hidden magic. AsyncLocalStorage-based auto-injection is possible, but context loss across `Promise` boundaries, fire-and-forget calls (`logAudit`, `notify` are not awaited) and Next.js internals makes it harder to reason about. Use ALS at most for logging correlation.
   - Known bypasses to lint for: `Model.collection.*` (one use today), `bulkWrite` (verify middleware coverage in the installed Mongoose 8 version), and sub-pipelines in `$lookup`/`$unionWith`/`$facet` if added later. A lint rule should forbid importing `@/models/*` outside `lib/data/**` once migration is complete.
4. **Two-tenant isolation test suite** in CI (section 6.3), using the existing `mongodb-memory-server` helpers.
5. **Compound unique indexes**, so an accidental cross-tenant *write* collision is detectable, and composite references: every lookup by business key (account code, supplier code, `jvNumber`) is `(organizationId, key)`.

**Data residency.** Host the shared cluster in a UAE region. Atlas lists AWS `me-central-1` (UAE) and Azure UAE North; confirm current tier availability before committing. Keep backups in-region.

### 4.3 Users in several academies

- `User` is the global identity: email (globally unique), password hash, 2FA secret, `lastLogin`. **Remove `role` from User** after migration.
- `Membership { userId, organizationId, roles: AppRole[], branchIds?: ObjectId[], teacherId?: ObjectId, status: invited|active|suspended, invitedBy, createdAt }`, with a unique index on `{userId, organizationId}`.
- **Login flow:**
  - authenticate the identity;
  - one active membership: select it automatically;
  - several: show an organisation picker;
  - optionally pre-select from the tenant subdomain.
- The JWT carries `activeOrganizationId` (and optionally `roles`, but `requireAuth` already re-checks live; keep doing that and key the cache by `userId:orgId`).
- **Switching academy:** a POST endpoint verifies the membership, re-issues the session via NextAuth `update()` (or sign-in with a switch ticket, as impersonation does), and writes an audit entry. Always a full page reload so client caches don't leak.
- `proxy.ts`/`auth.config.ts` page gating reads the role for the *active* membership.
- Teacher linking moves from email matching (`lib/teacher.ts:10`) to `Membership.teacherId`. The same email could be a trainer at academy A and a manager at academy B.
- Ownership fields stored as names (`Lead.assignedTo`, `FollowUp.assignedTo/createdBy`, name-regex filters at `app/api/search/route.ts:66-69`, `app/api/leads/export/route.ts:40`, `app/(dashboard)/dashboard/page.tsx:88-91`) should become `userId` (ObjectId), keeping the name only for display. Worth doing in Phase 0 regardless: renaming a user currently orphans their leads.
- **2FA:** stays per identity. A tenant policy "require 2FA for my staff" is checked against the identity at login or on switch.

### 4.4 Super admin and impersonation

Today `admin` can impersonate any non-admin user in the database (`app/api/admin/impersonate/route.ts`, `User.findById` unscoped), using a well-designed single-use 60-second token with audit.

**Tenant admin impersonation**

Keep this flow, but:
- the target must have a membership in `ctx.organizationId`;
- the token stores `organizationId`;
- the redeemed session is locked to that org;
- the exit (`app/api/impersonate/exit/route.ts`) returns to the same org.

**Platform staff: a separate path, not a tenant role**

- `User.platformRole: "super_admin" | "support" | null`. It gives **no** tenant data access by itself.
- Access goes through a `SupportAccessGrant`:
  - `{ staffUserId, organizationId, reason/ticket, scope: read_only|read_write, expiresAt (e.g. ≤ 60 min), approvedBy? (tenant admin, optional per plan) }`;
  - while the grant is active the session carries `organizationId` plus `supportGrantId`.
- Audit:
  - every request under a grant is written to `PlatformAuditLog`;
  - a mirrored entry goes to the tenant's `AuditLog`, so the academy can see "Platform support (name) viewed Payments";
  - read-only grants are enforced in `requireTenant` by rejecting non-GET methods.
- Field-level classification: financial, medical (LearnerProfile SEN/health notes, if present) and personal data (Emirates ID, passport) can be masked for support scope unless explicitly granted.
- Platform operations (tenant provisioning, migrations, billing) use `platformScope` queries. They never impersonate.

### 4.5 Audit logs

Current `AuditLog` (`models/AuditLog.ts`):
- stores only `userName`/`userRole` strings (impersonation is folded into the name: `"X (via Y)"` in `lib/api-auth.ts:83`);
- no user id, request id or IP;
- at HEAD, written fire-and-forget with errors swallowed (`lib/audit.ts:14`). The uncommitted working-tree change makes `logAudit` async and awaited, with clipping and error logging, which addresses durability but not attribution or scoping;
- read unscoped by `app/api/activity/route.ts:21`.

Target:
- `AuditLog { organizationId, actorUserId, actorName, actorRoles, impersonatorUserId?, supportGrantId?, action, entity, entityId, entityLabel, detail, before?/after? (financial), requestId, ip, userAgent, createdAt }`;
- index `{organizationId, createdAt:-1}`;
- append-only: no update or delete routes (none exist today; keep it that way), and ideally a restricted DB user without `remove` on that collection.
- For financial actions (posting, reversal, lock-date change, payout), make the audit write part of the same unit of work (await it, or a transactional outbox) instead of fire-and-forget.
- `PlatformAuditLog` is separate and never shown to tenants, except the mirrored support-access entries.
- Retention: keep at least as long as the financial records they describe.

### 4.6 Files and exports

- Today exports are generated in the request and streamed back as JSON or CSV (`app/api/export/[entity]`, `leads/export`, `reports/export`, `accounting/gl-dump`). Nothing is stored server-side, so isolation reduces to **scoping the query**. Also:
  - add an audit entry per export (none of these routes calls `logAudit` today);
  - rate-limit per tenant;
  - use tenant-slugged filenames.
- Inline blobs (`JournalEntry.attachment` up to ~1 MB, `Settings.logoBase64`) are isolated with their parent document. If they move to object storage later:
  - keys use the prefix `org/<organizationId>/…`;
  - downloads are always proxied through an authorised route or short-lived signed URLs generated after a tenant check;
  - bucket-level deny for any listing across prefixes;
  - never trust an object key sent by the client.
- Tenant data export (offboarding / PDPL access request): a platform job iterates the 28 collections with `{organizationId}` into a per-tenant archive. **Deletion** must respect retention: soft-offboard, then legal hold for financial records, then hard delete after the retention period. UAE VAT records are generally 5 years and Corporate Tax records 7 years; confirm with the `uae-tax-specialist` agent before encoding.

---

## 5. Phased migration path

Ground rules for every phase:
- Atlas snapshot before any data migration.
- Rehearse on a restored copy of production.
- Migrations are versioned scripts run in CI before deploy, never from HTTP routes.
- Seed data never runs in production.

### Phase 0: Prep that is valuable without tenancy (2-3 weeks)

| Step | Benefit now | Risk |
|---|---|---|
| 0.1 Create a migrations mechanism (e.g. `migrations/NNN-*.ts` with a `schemaMigrations` collection). Move the runtime index drop out of `lib/accounting/engine.ts:53-64` into migration 001. Set `autoIndex: false` in production and sync indexes via migration. | Stops runtime DDL on the hot posting path; reproducible environments | Low |
| 0.2 Replace ad-hoc HTTP "migration" routes (`app/api/admin/migrate-roles`, `admin/backfill-payments`, `accounting/backfill`) with scripts or platform jobs. Keep `seed-coa` only as a tenant-onboarding action. | Fewer admin-triggerable whole-DB operations | Low |
| 0.3 Introduce `RequestContext`. `requireAuth` returns `{userId, role, name, email, requestId, impersonatorId}` as structured fields, not a concatenated name. Add `requirePageAuth()` for server pages. | Correct audit attribution; one seam to add `organizationId` later | Low |
| 0.4 **Centralise data access** in `lib/data/<module>.ts` (or services), starting with accounting (`engine`, `postings`, trial balance, VAT report, ledger, finance page), then settings, then the three server pages (57 call sites). Services take `ctx` first. | Testable queries; the reports and finance pages get unit tests; tenancy later becomes one filter per function instead of ~319 edits | Medium (regressions in reports). Cover with the existing vitest plus snapshot tests of report totals before and after. |
| 0.5 Make singleton getters and counters take `ctx`: `getSettings(ctx)`, `getAccountingSettings(ctx)`, `getNextSequence(ctx, name)`. Consolidate VAT config into one place. | Removes the duplicated VAT source of truth | Low-Medium. VAT consolidation touches postings; follow the `financial-code-safety` skill. |
| 0.6 Ownership by id: add `assignedToUserId`/`createdByUserId` to Lead and FollowUp; link Teacher to User by `userId` instead of email. | Renaming a user no longer breaks ownership; fixes a real authz fragility | Medium (backfill by matching names; ambiguous names need manual review) |
| 0.7 Fix per-user read state for role-targeted notifications. Today `PATCH /api/notifications` marks a `roleTarget` notification read for *every* user of that role (`app/api/notifications/route.ts:42-49`). Use a `readBy[]` array or per-recipient fan-out. | Bug fix | Low |
| 0.8 Move hardcoded config to Settings or a platform-defaults module: branding strings (20 files), `NITAQ-` course prefix, currency formatter, timezone, country code. Split the COA seed into a template and remove the three suppliers from it. | Needed before any second customer; timezone fix is a latent bug on UTC hosts | Low |
| 0.9 Enrich AuditLog (`actorUserId`, `impersonatorUserId`, `requestId`); audit exports. | Compliance | Low |
| 0.10 Isolation test harness skeleton: helper to create "org A" and "org B" fixtures (a no-op until Phase 1). | Ready for Phase 4 | Low |

Bug found in passing (fix now): `app/(dashboard)/dashboard/page.tsx:156` counts `EnrollmentRequest` with `salesEmail: userName`. It compares the email field to the user's *name*, so a sales user's "my pending requests" is always 0.

### Phase 1: Tenancy schema, additive and non-breaking (1-1.5 weeks)

- Add `Organization`, `Membership`, `PlatformAuditLog`, `SupportAccessGrant` models.
- Add an optional `organizationId` (indexed, `immutable`) to the 28 tenant-owned models.
- Install the guard plugin in **log-only mode**: record unscoped queries with route and stack (structured log with `requestId`), no throwing.
- Session: add `activeOrganizationId` to JWT and session callbacks (`auth.config.ts`), defaulting to the single org.
- Risk: low; everything is additive. Watch the JWT size and the NextAuth v5 beta `update()` behaviour.

### Phase 2: Backfill with a default tenant (3-5 days including rehearsal)

1. Snapshot, then create `Organization { slug: "nitaq", name: "Nitaq Academy", … }`.
2. For each of the 28 collections: `updateMany({organizationId: {$exists: false}}, {$set: {organizationId: NITAQ}})`. Verify with `countDocuments({organizationId: {$exists: false}}) === 0`.
3. Create a `Membership` for each `User` from `User.role` (and `teacherId` from the email match, reviewed manually).
4. Settings and AccountingSettings: set `organizationId` on the single documents. Fail if more than one exists.
5. Counters: copy `_id: "journal-entry"` to `_id: "<orgId>:journal-entry"` with the same `seq`, for all 12 names plus the `batch-<id>` family. Keep the old documents until cut-over. **The sequence must not reset**, or duplicate numbers break the unique index and gaps or duplicates appear in tax documents.
6. Mark `organizationId` `required: true` in schemas once the backfill is verified.

Risks:
- Writes landing between steps 2 and 6 without an org. Mitigation: have writes set the default org from Phase 1 onward, or run the backfill in a brief maintenance window.
- Missed counters.

### Phase 3: Index rebuild (2-3 days)

1. For each row in section 2.2: create the new compound unique index `{organizationId, key}` first (safe, since the data is still one tenant), then **drop** the old global unique index.
2. Rebuild non-unique indexes with `organizationId` leading.
3. Recreate the five text indexes with the org prefix (MongoDB allows one text index per collection, so drop then create; the affected search is briefly slower).
4. Run in a low-traffic window. Atlas rolling index builds are available on dedicated tiers; shared or free tiers build in the foreground, so check the tier.

Risk: medium. A partial rollback leaves no uniqueness guarantee, so keep a scripted reverse migration.

### Phase 4: Code cut-over (4-6 weeks, the bulk)

- Convert all call sites to `ctx`-scoped access, module by module: accounting, then finance (payments, expenses, payouts), CRM (leads, follow-ups, enrollments), academy ops, compliance, then system (users, settings, notifications, search, import/export, activity).
- `requireTenant` resolves the membership live; the page proxy uses the active membership's role.
- The users admin screen becomes membership management (invite by email; never reveal whether the email exists elsewhere).
- Impersonation is scoped to the org; build the platform support-grant flow.
- Notifications carry `organizationId`; `roleTarget` resolves within the org.
- Rate limits keyed by `org:user` and `org`; move to a shared store.
- Structured logging with `organizationId` and `requestId`; tag the error tracker with the tenant.
- When the guard's log shows zero unscoped queries across full test and staging traffic, **switch the guard to throw**. Keep it throwing permanently.

Risks:
- Missed call sites. Mitigations: the guard, the lint rule banning direct model imports outside `lib/data`, and the isolation tests.
- Report totals changing. Mitigation: compare trial balance, VAT report and finance page figures for the Nitaq org before and after cut-over; they must match exactly.

### Phase 5: Second-tenant readiness (2-4 weeks)

- **Onboarding:**
  - create the org;
  - copy the COA template;
  - create AccountingSettings mapped to template codes;
  - create Settings;
  - initialise counters;
  - invite the first admin.
- Tenant resolution by subdomain or custom domain for pre-login branding. `GET /api/settings` returns only public branding for the host's tenant.
- Per-tenant configurable lists (course categories, lead sources, payment methods, expense categories) replace schema enums.
- Minimal entitlements (plan, seat or learner limits), decoupled from any payment provider.
- Tenant export job; offboarding with retention and legal hold.
- Staging environment with two or more synthetic tenants and its own database; production seed disabled.

### Phase 6: Hardening (1-2 weeks)

- External or internal penetration test focused on cross-tenant IDOR, using the 74 id-based lookups and 23 param routes as the target list.
- Restore drill: restore a single tenant's data from a snapshot into staging.
- Per-tenant noisy-neighbour limits on heavy endpoints (reports, `gl-dump`, exports, import).
- Dependency note: NextAuth v5 is still beta; pin it and test the session `update()` path used for org switching.

### Effort summary (one experienced developer; add ~30% for review and QA)

| Phase | Effort | Useful without tenancy? |
|---|---|---|
| 0 Prep | 2-3 wk | **Yes** |
| 1 Schema | 1-1.5 wk | Partly |
| 2 Backfill | 0.5-1 wk | No |
| 3 Indexes | 0.5 wk | No |
| 4 Cut-over | 4-6 wk | No |
| 5 Second tenant | 2-4 wk | No |
| 6 Hardening | 1-2 wk | Partly |
| **Total** | **~11-17 wk** | |

---

## 6. Tenant data-leak hotspots

### 6.1 Ranked by severity

1. **Ledger account-code resolution (silent cross-tenant financial writes).**
   - `lib/accounting/engine.ts:139` `ChartOfAccount.find({ code: { $in } })` (`loadPostingAccounts`, also used for draft edits)
   - `lib/accounting/postings.ts:49` `ChartOfAccount.findOne({ code })`, `:57` `ChartOfAccount.create` (student AR accounts)
   - `app/api/accounting/settings/route.ts:61`, `accounts/[code]/route.ts:17,49`, `suppliers/route.ts:88-91`, `seed-coa/route.ts:25`

   Every tenant has identical codes, so unscoped lookups return *someone's* valid account, and postings, balance checks and lock-date checks pass. Scope, plus `(organizationId, code)` unique. Also `getAccountingSettings()` (`findOne()` with no filter), which would give tenant B tenant A's lock date and account mapping.
2. **Ledger aggregations and reports.**
   - `lib/accounting/engine.ts:332` `aggregateBalances`, pipeline at `:345` (trial balance, balance sheet, P&L)
   - `getLedger` `:364`, query at `:391`
   - `app/api/accounting/trial-balance`, `vat-report`, `receivables` (aggregate), `suppliers` (2 aggregates), `dashboard`, `ledger`
   - `app/api/accounting/gl-dump/route.ts:21` (**full GL dump, CSV**)
   - `app/(dashboard)/finance/page.tsx` (8 aggregates plus a JournalEntry aggregate at `:25`)

   Every pipeline needs `$match: {organizationId}` as its first stage.
3. **Business reports and dashboards (server components that query directly).**
   - `app/(dashboard)/reports/page.tsx` (14 aggregates; e.g. `Lead.aggregate([{ $group … }])` at `:76-77` with **no `$match` at all**)
   - `app/(dashboard)/dashboard/page.tsx` (28 call sites)
   - `app/api/reports/export/route.ts` (8 aggregates)

   These bypass `requireAuth`, relying on page gating in `proxy.ts` plus `auth()`.
4. **Bulk export.**
   - `app/api/export/[entity]/route.ts`: `Lead.find({})`, `FollowUp.find({})`, `Enrollment.find({})` (includes `emiratesId`), `Course`, `Teacher` (includes `emiratesId`), `Payment`, `Expense`, `AttendanceSession`
   - `app/api/leads/export/route.ts:56`

   Whole-collection dumps of personal and financial data. Not audited today.
5. **Import.** `app/api/import/[entity]/route.ts` and `app/api/leads/import`:
   - duplicate checks by phone and course code are existence oracles across tenants;
   - created documents must get `organizationId` from `ctx`, never from CSV columns;
   - counters must be per tenant.
6. **Global search.** `app/api/search/route.ts` regex-scans 7 collections (Enrollment, Lead, Course, Teacher, JournalEntry, ChartOfAccount, Payment). Course search runs for *every* role with no filter (`:88`).
7. **Id-based access (IDOR).** 74 `findById*` calls across 23 param routes, e.g. `app/api/payments/[id]`, `enrollments/[id]`, `accounting/journal-entries/[id]` (returns the attachment blob at `:29`), `learner-profiles/[id]`, `users/[id]`. ObjectIds are hard to guess but are not secrets (they appear in URLs, exports and `sourceId` fields). Use `findOne({_id, organizationId})`, with 404 (not 403) on a mismatch.
8. **Users and identity.**
   - `app/api/users/route.ts:34` `User.find(filter)` lists *all* users (all tenants, once memberships exist); `:73` reveals email existence.
   - `lib/api-auth.ts:22` role cache keyed by `userId` only.
   - `auth.ts:66` login loads `User.role` globally.
   - `lib/teacher.ts:10` `Teacher.findOne({ email })` could bind a trainer login to another academy's Teacher record and expose its students (`app/api/my/students`, search trainer branch).
9. **Impersonation.** `app/api/admin/impersonate/route.ts:31,43` `User.findById`/`User.findOne({email})` unscoped, so a tenant admin could open a session as another tenant's user. `auth.ts:128` redemption does not check org.
10. **Notifications.**
    - `lib/notify.ts` creates with no org; `roleTarget: "trainer"` (`app/api/class-sessions/[id]/route.ts:64`) would broadcast "Class record updated: <student name>" to **every trainer in every academy**.
    - `app/api/notifications/route.ts:12,43` reads and updates by `roleTarget` globally.
11. **Audit log.** `app/api/activity/route.ts:21` `AuditLog.find(query)`, where the only filter is optional `userName`/`entity`. It would show one academy's audit trail, including names and amounts in `detail`, to another.
12. **Backfill, seed and migration routes (whole-DB operations triggered over HTTP).**
    - `app/api/accounting/backfill/route.ts:23-28,32,55,79`: `find` on all enrollments, payments, expenses, and posts journals
    - `app/api/admin/backfill-payments/route.ts:23`
    - `app/api/admin/migrate-roles/route.ts:21` `User.updateMany` (all tenants)
    - `app/api/accounting/seed-coa/route.ts`

    Must become tenant-scoped jobs or platform-only scripts.
13. **Runtime DDL.** `lib/accounting/engine.ts:58-62` `JournalEntry.collection.dropIndex`: a collection-wide operation triggered by any tenant's first posting after a deploy, and it bypasses Mongoose middleware. Move it to a migration.
14. **Unauthenticated settings.** `app/api/settings/route.ts:6` and `app/login/page.tsx:10` return the single Settings document (including VAT TRN, phone, logo) to anyone. With tenancy the tenant must be resolved from the host, returning public branding only.
15. **Other aggregate routes.**
    - `app/api/collections/route.ts:20,28` (enrollments with balances plus last-payment aggregate; the WhatsApp reminder template is hardcoded to Nitaq)
    - `app/api/compliance/dashboard/route.ts`, `app/api/courses/route.ts`, `app/api/my/students/route.ts`
    - `lib/payroll.ts:72,103,132` and `lib/hours.ts:33-38`: ObjectId-scoped, so lower risk, but should still take `ctx`.
16. **Duplicate-source guard.** `engine.ts:167` (`assertNoActiveEntryForSource`) and `postings.ts:160` `JournalEntry.findOne({sourceType, sourceId})`. `sourceId` is an ObjectId string, so collisions are unlikely, but scope it anyway: a reversal could otherwise target another tenant's entry via `reverseEntryForSource`.
17. **Caches and limits.** `lib/rate-limit.ts` is in memory per instance; there are no per-tenant limits, so one academy's large import (500 rows × sequential awaits) or GL dump can starve others.

### 6.2 Cron and background jobs

There are none today (no `vercel.json` crons, no queue). Fire-and-forget or post-response work (`notify`; `logAudit` at HEAD, now awaited in the working tree; `postSafely`-wrapped postings) runs inside the same request, so it must receive `ctx` explicitly; nothing ambient carries the tenant. Any future scheduled job must iterate tenants explicitly (`for org of activeOrgs: run(ctxFor(org))`) and log per-tenant outcomes.

### 6.3 Isolation test checklist (two tenants, A and B, seeded with the *same* COA codes and colliding numbers)

- [ ] For every list endpoint (all 72 routes' GET handlers and the 3 server pages), user A sees zero B documents; counts and totals equal A-only fixtures.
- [ ] For every `[id]`/`[code]` route with GET/PATCH/DELETE, A using B's id returns 404 and B's document is unchanged.
- [ ] `createJournalEntry` in A using an account code that exists only in B fails with "does not exist".
- [ ] Posting in A never reads B's `lockDate` or account mapping (B locked, A open: A's posting succeeds, and the reverse).
- [ ] Trial balance, VAT report, ledger, receivables, GL dump, finance page and reports export for A equal A's fixtures exactly (to the fils).
- [ ] Counters: A and B both produce `JV-000001`, `P-001`, `E-001` without E11000; A's sequence has no gaps caused by B.
- [ ] Search for B's student name, phone, `jvNumber` or account name as A returns nothing.
- [ ] Export for every entity as A contains only A rows.
- [ ] Import in A of a phone that exists only in B succeeds (no "duplicate" oracle), and imported rows get A's org even if the CSV has an `organizationId` column.
- [ ] Mass assignment: POST/PATCH bodies containing `organizationId: B` are ignored or rejected on every write route.
- [ ] A notification with `roleTarget` created in A is not visible to B users with that role; marking read in A does not affect B.
- [ ] The activity/audit log in A shows no B entries; support access to A appears in A's audit log.
- [ ] A user with memberships in A (trainer) and B (manager) has trainer permissions and data while active in A, manager permissions while active in B; switching org re-issues the session and old-org requests fail.
- [ ] A removed membership in A takes effect within the cache TTL even if the JWT still says A.
- [ ] Tenant admin of A cannot impersonate a B user; a redeemed impersonation token cannot switch org.
- [ ] Support grant: expired grant means 403; read-only grant rejects writes; every request is logged.
- [ ] Unauthenticated `GET /api/settings` on A's host returns A's public branding only, never the VAT TRN of B.
- [ ] Guard plugin: an unscoped `find`, `aggregate`, `updateMany` or `insertMany` throws in tests (meta-test that the guard itself works).
- [ ] Lint: no `@/models/*` import outside `lib/data/**` (after Phase 4).
- [ ] Backfill and seed jobs run for A do not touch B (document counts in B unchanged).
- [ ] Rate limit: exhausting A's export or import limit does not throttle B.
- [ ] Tenant export of A contains all 28 collections filtered to A and zero B documents; tenant deletion of A leaves B intact and respects retention holds.

---

## 7. Open questions for the owner

1. Will academies need **branches** (multiple centres per academy) in year one? This decides whether `branchId` is added in Phase 1 or later. Its absence today makes adding it alongside `organizationId` cheap.
2. Is each academy its own **VAT-registered legal entity**? This affects per-tenant tax profile, invoice numbering and e-invoicing (PINT-AE) readiness.
3. Must any prospective customer have **dedicated database or residency** guarantees contractually? This would pull Option C forward.
4. Should Qualifications (awarding bodies, units) be a **shared platform catalogue** that tenants subscribe to, or fully tenant-owned?
5. Is the Nitaq COA acceptable as the default template for other UAE training centres, or does the accountant want a cleaner generic template?
