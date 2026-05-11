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
npx tsx scripts/seed.ts
# Login: admin@nitaq.com / Nitaq@2024!
```

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
- super_admin — full access + users
- admin — full operations
- sales — leads + allocations
- teacher — own classes/attendance
- finance — payments/expenses/payroll
- academic — scheduling + allocations

## Modules Built (MVP)
Dashboard · Leads CRM · Students · Courses · Subjects · Teachers
Subject Mapping · Manual Allocation · Enrollments · Classes
Payments · Import/Export CSV · Settings · Users
