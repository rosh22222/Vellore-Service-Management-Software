# Vercel + Supabase deployment

1. Create a Supabase project and copy its PostgreSQL connection string.
2. In the project, create `.env.local` from `.env.example`.
3. Set `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`.
4. Run locally once:
   ```bash
   npm ci
   npm run db:generate
   npm run db:deploy
   npm run dev
   ```
5. Push the project to GitHub/GitLab/Bitbucket and import it into Vercel.
6. Add the production environment variables in Vercel, select Node.js 22, and set the Build Command to `npm run build:full`. Do not upload `.env.local` or `.runtime` to GitHub.
7. Before/while deploying production database changes, run:
   ```bash
   npm run db:deploy
   ```
8. Set `NEXTAUTH_URL` to the final HTTPS production URL.
9. Seed the production database once with `NODE_ENV=production` and a unique `VFE_ADMIN_PASSWORD` (12+ characters), then run `npm run db:seed`. This creates only the `admin` owner account. Create real staff/technician accounts through Team Management. Seeding does not reset an existing owner's password.
10. Enter the real company contact details and complete the browser/device checks in `docs/UAT_TEST_PLAN.md`. Supabase connectivity and deployed behavior must be tested after connecting the real project.

## Supabase notes

- This application uses Supabase only as PostgreSQL database hosting. It does not depend on Supabase Auth.
- Keep the database service role/password server-side only. Never expose the PostgreSQL URL to client components.
- For serverless deployment, use the Supabase pooled database connection recommended for your project and Prisma version.
