# Nitaq Operations CRM

Full-stack role-based Academy CRM — Next.js 14 · TypeScript · Tailwind · MongoDB Atlas

## Quick Start

### 1. Install
```bash
npm install
```

### 2. Configure .env.local
```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.xxxxx.mongodb.net/nitaq-crm
NEXTAUTH_SECRET=your-32-char-random-secret
NEXTAUTH_URL=http://localhost:3000
```

### 3. Seed admin user
```bash
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='a-strong-password' npm run seed:dev
```
Creates the admin user plus the Chart of Accounts and accounting settings.
Credentials are read from the environment only, and the password must be at
least 12 characters. For a throwaway local database, run `npm run db:dev` first
and point `MONGODB_URI` at the URI it prints.

### 4. Run
```bash
npm run dev
```

## Deploy to Vercel
1. Push to GitHub
2. Import at vercel.com
3. Add env vars (MONGODB_URI, NEXTAUTH_SECRET, NEXTAUTH_URL=https://your-domain.vercel.app)
4. Deploy

## Roles
Defined once in `lib/permissions.ts` (`ALL_ROLES`). Page access and sidebar
visibility are driven from that file; each API route declares its own allowed
roles inline via `requireAuth([...])`.

- admin — full operations
- manager — operations, no settings
- sales — leads and follow-ups
- finance — payments, expenses, payroll
- trainer — own classes, students and attendance
- assessor — learner assessments
- iqa — internal quality assurance sampling
- eqa — external quality assurance, read-only
- accountant — accounting module

## Modules Built (MVP)
Dashboard · Leads CRM · Students · Courses · Subjects · Teachers
Subject Mapping · Manual Allocation · Enrollments · Classes
Payments · Import/Export CSV · Settings · Users
