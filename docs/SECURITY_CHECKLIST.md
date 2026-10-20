# Production security checklist

Complete this checklist before giving real customer data access to users.

## Accounts and sessions

- Replace every demo password and do not seed demo users into the live database.
- Generate a unique, high-entropy `NEXTAUTH_SECRET` for each environment.
- Use HTTPS and set `NEXTAUTH_URL` to the exact production URL.
- Disable departed users immediately. Protected server requests re-check the current database account state.
- Give office users technician-assignment and billing permissions only when required.
- Review Admin accounts monthly and use individual accounts instead of shared credentials.

## Database

- Keep `DATABASE_URL` server-side; never prefix it with `NEXT_PUBLIC_`.
- Restrict the PostgreSQL/Supabase network policy and rotate database credentials periodically.
- Run `prisma migrate deploy` during releases; do not use `db push` in production.
- Enable automated backups, document retention, and perform a restore test before launch.
- Encrypt backups and restrict backup access to the owner/authorized administrator.

## Application and hosting

- Keep Node.js, Next.js, Prisma, NextAuth and transitive dependencies patched.
- Run `npm ci`, `npm run typecheck`, and `npm run build` for every release.
- Preserve the included security response headers at the reverse proxy/CDN.
- Put the application behind HTTPS, a firewall and rate limiting at Vercel, Nginx or the chosen edge provider.
- Do not expose PostgreSQL publicly from the Hostinger VPS.
- Review user roles, technician-assignment permissions, status changes and completed service records.

## Data handling

- Export reports only to authorized devices and delete temporary exports when no longer needed.
- Completed service snapshots are intentionally not editable through the application.
- Validate actual retention and privacy requirements with the business before go-live.

## Release evidence

- Record the deployed commit/archive checksum, migration version and deployment date.
- Complete `docs/UAT_TEST_PLAN.md` with the client.
- Confirm Admin, Office Staff and Technician access using separate test accounts.
