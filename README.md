# Vellore Fitness Equipments — Service Management System

A full-stack Service Management application for VELLORE FITNESS EQUIPMENTS built with **Next.js + TypeScript + Tailwind CSS + PostgreSQL + Prisma + NextAuth**.

The core data flow is:

**Bill Details / Customer → Equipment → Complaint → Technician Assignment → Inspection → Work Done → Parts / Service Amount → Completion → Service Collections → Permanent Service History**

## Included modules

- Role-based login: Admin, Office Staff, Technician
- Dashboard with service/technician KPIs
- Customer management
- Customer equipment management with warranty tracking
- Bill Details purchase/warranty register
- Fast complaint registration
- Dedicated one-page Technician Assignment screen
- Unified Team Management for technician profiles, workload, login accounts and permissions
- Technician job screen
- Separate Customer Complaint vs Actual Problem Found fields
- Inspection findings and work logs
- Service Collections with paid, partial and pending payment tracking
- Permanent immutable-by-application service history
- Equipment service timeline
- Repeat-problem indicator based on previous service wording
- Service report PDF
- Reports + CSV/PDF export
- Company branding/settings
- Responsive desktop/tablet/mobile UI

## Tech stack

- Frontend + server: Next.js App Router, TypeScript
- Styling: Tailwind CSS
- Database: PostgreSQL
- ORM: Prisma
- Authentication: NextAuth credentials + bcrypt password hashing
- PDFs: `@react-pdf/renderer`
- Deployment now: Vercel + Supabase PostgreSQL
- Deployment later: Hostinger VPS + PostgreSQL

## Quick start

### 1. Requirements

- Node.js 22 LTS
- PostgreSQL 15+ or a Supabase PostgreSQL project

### 2. Environment

```bash
cp .env.example .env.local
```

Set:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
```

Generate a secret with:

```bash
openssl rand -base64 32
```

### 3. Install and database setup

```bash
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
```

### 4. Start

```bash
npm run dev
```

Open `http://localhost:3000`.

Development uses a fixed port, `3000`, and keeps its generated files in `.next-dev`.
If that port is already in use, use the running app instead of starting a second copy.
Production builds use `.next`, while `VFE_DIST_DIR` can select a separate verification output.
This separation prevents concurrent development and production builds from replacing each other's page chunks.
After restarting or updating the app, reload any browser tab that still has old page files open.

### Local test database used in this workspace

This workspace uses an isolated PostgreSQL 17 data folder at `.runtime/postgres-data` on port `55432`.

If login shows `Can't reach database server at 127.0.0.1:55432`, start the local DB:

```powershell
npm run db:local:start
```

Check or stop it with:

```powershell
npm run db:local:status
npm run db:local:stop
```

## Seed logins

**Change these before client deployment.**

- Admin: `admin` / `Admin@123`
- Office staff: `staff` / `Staff@123`
- Technician Ramesh: `ramesh` / `Tech@123`
- Technician Suresh: `suresh` / `Tech@123`
- Technician Kumar: `kumar` / `Tech@123`

The seed creates only company settings, login users and technician profiles. It does not create demo customer, bill, complaint or service records.

## End-to-end test flow

1. Login as `admin`.
2. Create **Bill Details** for an existing or new customer.
3. Verify the purchased item is automatically available in Customer Equipment with bill number and warranty.
4. From Bill Details, click **Add Problem** to register a service complaint for that exact equipment.
5. Open **Technician Assignment** and assign a technician.
6. Login as that technician.
7. Open **My Jobs**.
8. Review previous equipment history.
9. Add inspection findings and Actual Problem Found.
10. Add Work Done.
11. Add completion notes describing the repair and any replacements.
12. Enter the service amount and any amount collected now.
13. Technician completes the service.
14. The system creates a new permanent Service Record.
15. Open **Service Collections** to collect pending payment later if required.
16. Download the Service Report PDF.
17. Create another complaint for the same equipment and verify the previous service remains visible.

## Important behavior

- A new service never overwrites an old completed service.
- Completion creates a new `ServiceRecord` snapshot with customer/equipment/technician/warranty details.
- Service Collections store who collected the amount, payment mode, date, notes and pending balance.
- Assignment changes create separate `ServiceAssignment` history rows.
- Status changes create separate `ServiceStatusHistory` rows.
- Technician server actions verify that the job is currently assigned to that technician.
- Technician service-history access is limited to equipment associated with jobs currently assigned to that technician.
- Company name and contact/billing details are stored centrally in `CompanySetting`.

## Production database changes

Development:

```bash
npx prisma migrate dev --name your_change
```

Production:

```bash
npx prisma migrate deploy
```

## Local PostgreSQL with Docker

```bash
docker compose up -d postgres
```

Then use:

```env
DATABASE_URL="postgresql://vfe:change-this-password@localhost:5432/vfe_service?schema=public"
```

## Deployment guides

- `docs/DEPLOY_VERCEL_SUPABASE.md`
- `docs/DEPLOY_HOSTINGER_VPS.md`
- `docs/SECURITY_CHECKLIST.md`
- `docs/VALIDATION_REPORT.md`
- `docs/ORIGINAL_SPECIFICATION.md`

## Scope note

The core workflow is tested through authenticated server actions, database assertions and production HTTP responses. See `docs/VALIDATION_REPORT.md` for the current results and the remaining browser/client acceptance checks.

Before production, connect the production PostgreSQL database, run `npm run db:deploy`, and seed with `NODE_ENV=production` and a unique `VFE_ADMIN_PASSWORD` of at least 12 characters. Production seeding creates only the owner account; add actual staff from Team Management. Existing passwords are never overwritten by seeding. Enter real company details and complete the UAT plan.

## Verification commands

```powershell
npm test
npm run typecheck
npm run build:full
```

`build:full` regenerates Prisma Client before building. Use it as the deployment build command. Database scripts load the same `.env.local` file as Next.js.

For local regression testing without replacing the development cache:

```powershell
$env:VFE_DIST_DIR = '.next-validation'
npm run build:full
$env:NEXTAUTH_URL = 'http://localhost:3100'
npm run start -- -p 3100
```

From a second terminal, run `npm run test:core`. It only accepts localhost targets, creates temporary QA records, and removes those records in a `finally` block. Document sequences may contain gaps afterward. `npm run test:migrations` uses a separate temporary local database, verifies all migrations and owner-only production seeding, then removes that temporary database. It requires a local database account with CREATE DATABASE permission.

Client instructions: [Daily workflow guide](docs/CLIENT_GUIDE.md).
