# Hostinger VPS deployment later

The application is PostgreSQL-provider neutral, so moving from Supabase PostgreSQL to a PostgreSQL server on a Hostinger VPS does not require rewriting the application.

## Suggested VPS setup

- Ubuntu LTS VPS
- Node.js 22 LTS
- PostgreSQL 16+
- Nginx reverse proxy
- PM2 or Docker
- HTTPS via Let's Encrypt/Certbot

## Migration outline

1. Export the Supabase database with `pg_dump`.
2. Create the PostgreSQL database/user on the VPS.
3. Restore with `pg_restore`/`psql`.
4. Change only `DATABASE_URL` in the production environment.
5. Run `npm run db:deploy`.
6. Run `npm run build:full`, then start the Next.js application.
7. Point Nginx to `localhost:3000` and enable HTTPS.

## Docker alternative

Build this repository's `Dockerfile` and connect it to your VPS PostgreSQL database using the `DATABASE_URL` environment variable.
