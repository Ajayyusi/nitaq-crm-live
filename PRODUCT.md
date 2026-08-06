# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Staff of Nitaq Academy (Sharjah, UAE) working across nine roles: admin, manager, sales (front-desk admissions), finance, accountant, trainer, assessor, IQA, EQA. Sales staff live in leads/follow-ups/enrollments daily; finance and the accountant work payments, expenses, payroll, and the double-entry books; trainers log class sessions and attendance (often between classes, sometimes on phones); compliance roles (assessor/IQA/EQA) track UK-style qualification evidence. EQA is an external read-only auditor.

## Product Purpose

An operations CRM for a private training academy: convert enquiries into enrolled, paying students; run classes and teacher payroll; keep real double-entry books that always reconcile; and stay compliant with awarding-body (IQA/EQA) requirements. Success = fewer dropped leads, collected fees, books that close cleanly, audits passed.

## Positioning

Owner-confirmed: internal tool for Nitaq's business today, **to be sold to other academies later**. Design and code quality should meet the bar of a sellable multi-academy SaaS product, even while single-tenant. The differentiating mechanism a generic CRM cannot copy: one system spanning admissions → academy ops → true double-entry accounting (trial balance reconciles by construction) → UK-qualification compliance.

## Operating Context

- Currency AED; dates DD MMM YYYY style; Sharjah/Dubai timezone.
- WhatsApp is the follow-up channel (prefilled message links from lead records).
- Printable artifacts matter: payment vouchers, receipts, journal vouchers are printed/filed.
- CSV import/export used for bulk data (leads, payments, journal entries).
- Admin "open as trainer" impersonation exists for support; an attribution banner must stay visible.
- Deployed on Vercel at app.nitaqacademy.com; MongoDB Atlas; auth is NextAuth credentials + optional TOTP 2FA.

## Capabilities and Constraints

- 27 dashboard modules; central RBAC in lib/permissions.ts drives pages, sidebar, and API — redesign must not alter permission behavior.
- Accounting engine invariants are covered by vitest (`npm test`); these must stay green.
- **Trainer pay is a property of the student registration, not the trainer.** The same trainer earns different rates on different courses, so each enrollment may carry its own rate and basis (Per Hour · Per Class · Fixed for Course). A registration without a rate falls back to the trainer's default rate. Monthly-salaried trainers are paid a flat amount and ignore per-registration rates. A fixed course fee is paid once per registration and never re-paid in a later batch.
- Next.js 16 App Router + Tailwind 4 + shadcn-style components; Turbopack.
- Every existing feature and workflow must be preserved exactly (owner requirement).
- **Language (owner-confirmed): English and Arabic both wanted.** Foundations must be RTL-ready (logical properties, direction-agnostic layouts, Arabic-capable type stack). Full Arabic string translation is a follow-on workstream, not silently dropped.

## Brand Commitments

Owner-confirmed: the current green exists because of Nitaq Academy branding. The *system* may carry its own product branding, **but keep a little green** (green stays present as an accent, not necessarily the primary surface color).

## Evidence on Hand

- Real Chart of Accounts (114 accounts) from Chart_of_Accounts-NITAQ.xlsx in lib/accounting/coa-seed.ts.
- Real course categories, expense taxonomy, and role structure throughout models/.
- No testimonials, customer logos, or marketing claims exist — never fabricate any.

## Product Principles

1. Trust through precision — money and compliance screens must feel exact: aligned numerals, clear debit/credit, no ambiguity.
2. Speed for repetitive work — sales and finance staff repeat the same flows dozens of times daily; fewer clicks and keyboard paths beat visual novelty.
3. One system, one language of components — the same table, form, and status vocabulary everywhere, so learning one module teaches all 27.
4. Sellable by sight — every screen should look like a product another academy would pay for, without breaking what Nitaq staff already know.
5. Bilingual-ready by construction — nothing in layout or type should need rework when Arabic lands.
