# Validation Report

## Five requested workflow improvements - 21 October 2026

Status: implemented and validated as a production candidate.

- Brand actions now report `Brand Added`, `Brand Deleted`, `Brand Activated`, or `Brand Deactivated` in one consistent notice below the New Brand form. Successful messages dismiss after three seconds; errors stay visible.
- Complaint and technician-job detail pages now use one compact Complete Service form. Actual Problem Found, Work Performed, and Service Amount are required. The separate inspection, work-log, and status-update forms were removed, along with Completion Notes and Collected Now. Payments remain in Service Collections.
- Technician create/edit supports an optional direct image upload or image URL with an immediate preview. Uploaded images are resized and compressed in the browser. The new nullable `Technician.photoUrl` migration is applied to the configured Supabase database.
- One complaint can now have several active technicians. Office users can add or remove technicians, every assigned technician can access the job, completion records the full team, and all active assignments close when service is completed.
- New Bill Details now presents State before City. Indian states are immediately available; the selected state's full city list is lazy-loaded, with a manual City fallback if the dataset has no entry for a territory.

Verification completed after the final changes:

- Prisma reports all 12 migrations applied to the configured Supabase database.
- TypeScript passed with no errors.
- All 59 automated tests passed, including focused regression checks for these five changes.
- The optimized Next.js production build passed. New Bill Details loads about 119 kB initially; the city dataset is kept out of the initial page bundle.
- The read-only Supabase-backed live sweep passed 35 checks across authentication protection, list/detail/edit routes, CSV/PDF exports, and public assets. It changed no business records.
- The guarded write-based HTTP workflow test was not run against Supabase because it deliberately accepts only a local database. The old optional local PostgreSQL cluster remains stopped because it is documented as corrupted; its safety guard was not bypassed.

## Production-readiness audit - 17 October 2026

Status: the application is a production candidate, with the external acceptance items listed below still required before calling the release 100% complete.

- Repaired authentication routing by moving NextAuth middleware beside the `src/app` application. The optimized build now contains a compiled Middleware bundle, and anonymous protected-page requests return an immediate 307 redirect directly to `/login`.
- Updated Next.js from 15.5.26 to 15.5.28 and pinned patched transitive PostCSS/source-map packages. `npm audit --omit=dev` now reports zero production dependency vulnerabilities. The Docker runtime stage prunes development-only build/test packages.
- Added `npm run test:live-smoke`, a password-free, read-only authenticated smoke check for local application servers. It signs a short-lived session for an existing active office account, does not create or update business records, and refuses non-local application URLs.
- All 49 automated UI/logic/security tests passed. TypeScript passed after the final build, and the normal optimized production build completed with all application routes plus the authentication middleware.
- All 11 migrations applied successfully to a fresh isolated PostgreSQL 17 database. Production seeding created only the owner and brand master data. All 16 real PostgreSQL workflow checks passed, including Unit/Kg purchases, multi-machine bills, complete bill editing, atomic rollback, complaint protection, dashboard totals, and technician email/username authentication.
- Supabase is reachable and reports all 11 migrations applied. The read-only production-mode live sweep passed 35 available pages, detail/edit routes, brand/logo/avatar assets and CSV/PDF report exports. Anonymous route protection passed. No Supabase business records were changed.
- Warm production measurements against the configured Supabase pooler: dashboard about 44 ms; ordinary tested pages below that same order after warm-up; CSV export about 1.3 seconds; PDF export about 2.1 seconds. Development timings are intentionally excluded because compilation made them slower.

Remaining external acceptance:

- No browser surface was available to this audit session, so desktop/mobile visual layout, keyboard interaction and client-device printing still require the UAT checklist. HTTP, DOM/unit and build checks do not replace visual approval.
- This computer is running Node 24 while the project and deployment target Node 22. The build passed, and `.nvmrc`, `package.json` and Docker all specify Node 22; deploy and run the final hosting check on Node 22.
- The old optional local PostgreSQL data folder on port 55432 has system-table corruption and remains stopped. It was not reset because doing so could destroy old local data. Supabase is healthy, and all database validation used a separate clean isolated PostgreSQL cluster that was stopped after testing.
- Docker is not installed on this machine, so the Docker image itself could not be built here. The Vercel/Node production build passed.

## Nine requested workflow, loading and performance changes - 16 October 2026

1. Added shared navigation progress and a spinning loading indicator for internal page links, browser back/forward, GET filters and server-action forms. Pending form buttons retain their own spinner and duplicate-submit protection. Route fallbacks show a visible spinner while server content loads. Logout and report generation/downloads also show progress and recover on errors. Hash-only history changes and file downloads do not leave a permanent page-navigation spinner.
2. Product selectors on bill complaint creation, New Complaint and complaint equipment linking now show only equipment name, model and serial. Options/selection expose the full title, and a wrapping selected-product preview keeps long values readable without widening the page. Internal equipment IDs remain form values, not option captions.
3. Added the office-only New Complaint header shortcut to `/complaints/new`. Removed All Customers and All Equipment filters and their two master-list queries from Service Complaints. Technician-only accounts do not see office shortcuts.
4. Moved Edit Bill to the Bill Details register, between Open Details and Delete. It opens the full prefilled editor at `/bill-details?editBill=...`: customer profile, invoice number, purchase date, every product, Unit/Kg quantity, serials, prices, notes and warranty. Products can be added/removed before saving everything atomically. The previous `bill-details/[id]/edit` URL is now only a compatibility redirect, not a separate editor, and its header button was removed from bill details.
   - Any complaint/service history on any product blocks the whole invoice edit with a readable complaint-already-raised message. This is checked when opening and again when saving, not only in the button UI. Related bill write actions are protected too.
   - Complaint creation/linking serializes with bill edits. Bill, customer and machine version tokens reject stale edits. Duplicate invoices and invalid product IDs roll back the entire change. Retained machine IDs are preserved, and reducing quantity while renaming an invoice removes only the correct unused extras.
5. Added optional Technician and Office Notes to New Complaint. Technician assignment, assignment history and busy status are saved in the same transaction; office assignment permissions and technician availability are checked. Office Notes are also displayed on the office complaint page and assigned technician's job page.
6. Removed the New Equipment button, associated fields and create-new-equipment branch from standalone complaint registration. Existing Equipment and Not Known remain; a new/external customer can still register a complaint without a purchase bill. Office follow-up equipment linking remains available separately.
7. Technician email is mandatory on create/edit, normalized and stored on both profile and login account. Both email/password and username/password sign-in are supported. Case-insensitive/cross-field identifier collisions are rejected. Removed the specialization placeholder on technician editing. No existing passwords or accounts were reset, and no email-sending integration was added.
8. Adding a brand displays exactly Brand Added, clears its name field and removes the success message after 3 seconds. Errors remain visible and do not auto-dismiss.
9. Reduced navigation-related database work: request-scoped authorization deduplication without cross-request permission caching; parallel layout reads; one dashboard KPI query instead of eleven; four grouped Teams counts instead of four counts per technician; three grouped Reports counts instead of three per technician; narrower bill-register projections; removal of unused complaint filter queries.

Verification:

- All 48 automated UI/logic tests passed, including navigation lifecycle, overlapping operations, back/hash navigation, brand-message timing, full editor prefill, required fields, product titles/previews, report download/preview loading and existing Unit/Kg/auth regressions.
- All 16 isolated PostgreSQL integration checks passed, covering legacy migrations, multi-machine/weight handling, complete bill edits, atomic rollback, safe removal, complaint protection, dashboard aggregate correctness and real database-backed technician email/username authentication. Each run applies the existing migration chain to its own guarded temporary database and removes only that database afterward. The separate QA cluster was stopped after testing.
- TypeScript, the isolated production build and HTTP core-script syntax checking passed. The HTTP core script was updated for required technician email, email sign-in, standalone assignment/notes and the removed equipment-registration mode, but a new full HTTP/browser workflow run was not performed. No physical-device or screenshot acceptance is claimed.
- A read-only Supabase benchmark compared the old eleven-query dashboard KPI calculation with the new one-query calculation. Across three warmed samples, mean elapsed time was 1,262 ms versus 888 ms; all metrics matched. This measures KPI database reads only, not complete browser navigation, and is not a guarantee for every network or deployment.
- No Supabase business records, credentials or `.env.local` values were changed in this pass. No schema migration was needed. For realistic local speed testing use `npm run build` followed by `npm start`; development mode includes compilation overhead.

## Unit / Kg inside Quantity - 16 October 2026

- Added a Unit/Kg selector inside the Quantity control on New Bill, Add Product and Edit Product. Unit is selected by default and retains whole-count validation, one independently tracked machine per unit, optional per-machine serials and the existing history protections.
- Kg accepts positive weights with up to two decimal places. Serial inputs are omitted and stale serial payloads are ignored. One grouped equipment record links the weighted product to complaints, warranty and service history; the weight is never used to generate machine or serial counts. The price label becomes Price per Kg and the line amount remains quantity multiplied by that price.
- Saved bill quantities include their Unit/Units or Kg label. Kg complaint choices show the purchase weight instead of Machine 1. Editing restores the selected measurement, weight and concurrency token. Typed Unit serial drafts survive a temporary switch to Kg and back; fractional weights are not silently rounded when switching to Unit.
- Updated bill machine limits to count tracked records rather than summing kilograms. Mixed Unit/Kg purchases work together. Weight changes preserve the grouped product ID. Changing Unit/Kg is blocked if any linked complaint/service history exists. Unused products can change measurement while retaining the first product ID and safely removing only unused extras.
- Equipment editing keeps Kg product metadata synchronized with its bill even when the weight is fractional or greater than 1, and does not allow a serial number on that grouped product.
- Added migration `20261016000100_bill_quantity_unit`: an enum-backed quantityUnit column defaults existing rows to UNIT, with database constraints for positive Kg weights and whole Unit counts. No existing business records are deleted or rewritten.

Verified:

- All 39 automated tests passed, including Unit default, required quantity, decimal Kg validation, no serial fields in Kg mode, measurement switching, preserved serial drafts, saved Kg editing and quantity labels.
- All 11 targeted PostgreSQL integration checks passed in an isolated temporary database: historical migration preservation; existing multi-machine behaviour; Kg create/edit/serial suppression; mixed purchases; safe conversions; complaint/history protection; safe deletion; and database quantity constraints.
- All 11 migrations applied to another fresh isolated database; production seeding added only owner/brand master data, not demo business records. Both temporary test databases were removed by their guarded cleanup routines.
- TypeScript and the isolated production build passed. Tests used React DOM/JSDOM and real isolated PostgreSQL; no physical-browser visual acceptance or new HTTP end-to-end run is claimed.
- Created and verified a readable private Supabase backup at `.runtime/database-backups/before-quantity-unit-2026-10-15T19-46-55-289Z.dump` (UTC-stamped filename, 71,880 bytes) before migration. It contains business data and remains excluded from Git/Docker.
- Applied migration 11 to Supabase. Before/after hashes and record counts matched across all 19 application tables after excluding only the new column. All four existing bill products retained UNIT and their original machine counts. No live test purchases, customers, complaints or services were created.
- Stopped only this project's Next.js development processes to release the locked Windows Prisma driver, then regenerated Prisma Client successfully. Restart the app with `npm run dev`. Credentials and `.env.local` were not changed. The separate local QA cluster was stopped after testing; the older local customer database was untouched.

## Required field indicators and Quantity validation - 15 October 2026

- Reviewed all 183 shared Field instances, including create/edit forms, read-only details and optional filters. All 70 explicitly required Field instances have matching required controls. The shared Field component also detects required children, preventing required controls from losing their red star if a label flag is omitted later.
- New product rows start with Quantity blank and an Enter quantity placeholder. Saving without it is blocked with "Please enter Quantity." Correcting the value clears the message. Saved products retain their existing quantities. Whole-number limits of 1-100 still apply on both client and server.
- Added missing indicators on customer editing, equipment name, complaint equipment linking and technician assignment. Teams assignments now have a labelled, required technician selector. Inline brand names have a red star without changing the requested Brand table heading.
- Reassignment reason is required and starred only when replacing an assigned technician. Service Amount is required on both office and technician completion forms; an explicit 0 remains valid for warranty/free work. Optional notes, serials, contact extras and filters remain optional.
- Tightened server-side blank checks for quantity, unit price, company name, customer type, assignment identifiers, service amount and collection amount. Missing quantities return the same helpful message through the action-feedback layer rather than a database error.
- All 34 automated tests passed, covering React DOM quantity entry/correction, blocked invalid submissions, saved quantity preservation, required/optional control validity, conditional reassignment reason, server feedback and a source-level audit of all starred form fields. TypeScript and the isolated production build passed.
- No database migrations, business-record writes, environment changes or credential changes were performed. Validation used automated DOM/source checks; no physical-browser visual acceptance is claimed.

## Multiple machines per purchased product - 15 October 2026

Fixed two separate issues: Supabase round trips expired Prisma's default five-second interactive transaction, and a bill line previously registered only one equipment record regardless of quantity. A read-only sixteen-query transaction reproduced `P2028` at about 5.3 seconds. Bill transactions now allow 60 seconds, batch equipment/unit creation, serialize edits to a bill and show a specific timeout message rather than incorrectly calling every timeout a database connection failure. The same read-only transaction passed after the fix in about 7.8 seconds.

- Quantity 5 now remains one purchased line but creates five independently identified machines. Serial numbers are optional; each unit has a unique equipment code, its own warranty data and separate complaint/service links.
- The product form accepts whole quantities, renders per-machine serial inputs and preserves entered values. Duplicate serials, invalid quantities and excessive amounts return readable validation messages.
- Bill details show every machine, individual complaint/history actions and per-machine warranties. Complaint selectors, linking and technician jobs show equipment IDs so identical machines without serials can be distinguished. Bill search includes secondary machines' serials/codes.
- Quantity increases retain old machine IDs and add units. Reductions remove unused trailing units only, and are rejected when they would remove complaint/service history. Bill deletion checks all units. Price-only edits preserve individually changed machine warranties; single-machine edits do not overwrite siblings.
- Migration `20261015000100_individual_bill_machines` is additive. The original equipment link is retained as the first-unit compatibility link, with the unit table authoritative for multi-machine operations. Existing quantities are backfilled while preserving the original machine ID and all history.

Verified:

- All 25 automated UI/logic tests passed, including changing quantity to 5 in React DOM, preserving serial input, unique field names, optional serials and whole-number validation.
- All 10 migrations applied to a fresh isolated local database.
- Seven targeted PostgreSQL integration checks passed against a separate temporary database: legacy quantity-5 upgrade/history preservation; new five-machine purchase; safe quantity increases/reductions; price-only warranty preservation; atomic serial swaps; machine-specific complaints/protected reductions; duplicate-serial rollback and serial-less machines.
- TypeScript and the isolated production build passed. The HTTP core test script was extended for multi-machine workflows and passed syntax validation, but its HTTP run was not performed because the environment blocked launching the test web server. No browser visual acceptance is claimed.
- Before applying the migration to Supabase, created a readable custom-format public-schema backup at `.runtime/database-backups/before-individual-machines-2026-10-15T15-37-12-386Z.dump`. Keep this private; it contains business data and is excluded from Git/Docker through `.runtime`.
- Applied migration 10 to Supabase. Compared hashes of every original record across 17 existing tables: all remained unchanged. Existing customer/bill/item counts stayed at 2/2/2. Equipment increased from 2 to 5: three missing machines were registered for the existing quantity-4 purchase. All five purchased units have machine links. No live demo customers, bills, complaints or repairs were added.

The development server was stopped only to release Windows' locked Prisma driver for regeneration. Restart it with `npm run dev` before checking the updated screens. Database credentials and `.env.local` were not changed. The old local customer database was not started or modified; testing used a new isolated PostgreSQL cluster under `.runtime/quantity-qa-20261015`.

## Larger Customer Notes field - 15 October 2026

Changed Customer Notes on New Bill Details from a single-line input to a full-width, vertically resizable textarea using the same shared styling as Item Notes. It starts with three rows and retains the existing `newCustomerNotes` field name and save logic.

- TypeScript checking and all 22 regression tests passed.
- Authenticated page/DOM checks confirmed the textarea, full-width wrapper, matching Item Notes styling and preservation of multiline content in FormData. The form was not submitted and no database records were changed.

## Updated logo and owner avatar - 15 October 2026

The supplied replacement logo is now displayed in its original colours in the sidebar and login card. Removed the sidebar's forced black filter and the login's single-colour image mask. The sidebar logo links to Dashboard for office users and My Jobs for technicians. The supplied `avatar.png` replaces the owner's initial badge next to Welcome back / D SATHYAN; other users retain their own initials.

- Added content-versioned asset URLs that refresh after file replacements, and metadata-aware PDF image loading instead of a process-lifetime logo cache. Original uploaded images were not edited.
- Configured Next Image for the versioned local URLs and explicitly included both image files in deployment traces. Verified their inclusion for login, dashboard, New Bill Details and the report export endpoint.
- All 22 regression tests passed, including image availability, changing logo bytes refreshing the browser URL and PDF contents, owner-avatar markup and preserving other users' identity displays. TypeScript checking and the isolated production build passed.
- Live HTTP checks verified the current login/sidebar logo URLs, Dashboard logo link, owner avatar and successful optimized image responses.
- Following the PDF skill's render-and-inspect workflow, downloaded a current report PDF and visually checked its rendered page: the replacement full-colour logo fits the header and remains legible. Used the installed PyMuPDF renderer because Poppler was unavailable. This was an empty summary report; no business records were created for the check.
- Temporary PDF/PNG previews remain under ignored `tmp/pdfs/`; automated cleanup was blocked. They are excluded from Git and Docker build context. A physical browser screenshot/layout review was not performed.
- No database records, credentials or environment settings were changed during this work. The user's development server was not stopped or duplicated.

## Header Add Bills shortcut - 15 October 2026

Added a themed, keyboard-accessible `Add Bills` link beside Logout in the shared header. It opens `/bill-details/new` directly for Admin and Office Staff, matching the destination's existing authorization. Technicians do not see the office-only shortcut. Header actions wrap onto a separate row on small screens instead of crowding the owner name.

- All 18 regression tests passed, including rendered-header checks for Admin, Office Staff and Technician roles. TypeScript checking passed.
- Authenticated HTTP checks verified the header link and a successful response displaying the New Bill Details form at its destination.
- No bill/customer submissions, database migrations, data transfers or record deletions were performed. Browser screenshots and physical-device layout approval were not performed in this pass.

## Supabase owner account and email sign-in - 15 October 2026

Updated the login label and placeholder to "Email or Username". The existing NextAuth credentials flow now looks up either field case-insensitively, trims the identifier but preserves the password exactly, and rejects ambiguous identifiers and disabled users/technician profiles. Existing username sign-in remains supported. This continues to use the application's [NextAuth Credentials provider](https://next-auth.js.org/providers/credentials), not Supabase Auth.

- Confirmed all 9 existing migrations were already applied to Supabase. No additional schema changes or migration commands were needed.
- Created the requested D SATHYAN owner account with username `admin`, the requested owner email and a bcrypt cost-12 password hash. Initialized company settings and document sequences without adding customer, bill or equipment records.
- The supplied password is not stored in application source, tests, documentation or client defaults. Seed output no longer prints a default password or implies existing credentials were reset. Database/session environment settings were not changed.
- All 16 regression tests passed, including email/username normalization, incorrect/malformed credentials, identifier collisions, disabled accounts, active technician requirements and exact password preservation. TypeScript checking passed.
- Live HTTP checks against the running app and Supabase passed for the new login label, email sign-in, mixed-case/padded email sign-in, username sign-in, owner identity/session, protected dashboard access, incorrect password rejection and logout.
- Isolated production build passed in `.next-validation`; the user's existing development server was not stopped or duplicated.
- HTTP and automated checks do not constitute browser visual approval or a complete business-workflow test on Supabase. Replace the chat-shared password before production/client handover.

## Dependency corruption recovery - 15 October 2026

The reported Prisma generation failure was caused by invalid UTF-8 and embedded null bytes in `node_modules/effect/dist/cjs/Graph.js`. This was an installed dependency failure, not a Supabase authentication or schema error.

- Preserved the old dependencies at `.runtime/node_modules-corrupt-20261015-155240` and installed all 262 packages again from the existing lockfile using a fresh, project-local npm cache. No package versions were upgraded. See the [npm clean-install documentation](https://docs.npmjs.com/cli/v11/commands/npm-ci/).
- Checked 20,886 dependency source/JSON files: no invalid UTF-8 or embedded null bytes remained. Syntax checks passed for Effect Graph/index, the Prisma CLI and Lucide Icon.
- Prisma Client generation and schema validation passed using the installed Node 22.11.0 runtime, matching the project's Node 22 engine target. The exact `npm run db:generate` command also passed in the user's current Node 24.15.0 environment after repair.
- TypeScript checking passed; all 10 regression tests passed under Node 22.
- `.env.local`, `package.json` and `package-lock.json` remained unchanged. No database migrations, seed operations or business-record writes were performed during this repair.
- Next step: apply the existing migrations to Supabase with `npm run db:deploy`, then securely initialize the owner account. The full application workflow against Supabase is not yet verified.

## Login background and password visibility — 15 October 2026

Replaced the reference-style dots and corner rings with diagonal violet/ice-blue bands, a faint grid and asymmetric apricot/lavender panels. The logo now uses its original transparent shape in brand violet over a very light lavender panel, instead of the black image filter.

The password field has a dedicated visibility control with an explicit button type, accessible state, pointer layering and focus/cursor restoration. Native duplicate password-eye controls are hidden. The form preserves native browser-filled values when visibility changes.

- `npm test`: 10 passed, including React DOM tests for reveal/hide, exact typed value, cursor selection, unchanged form payload, no accidental submission, disabled behaviour and browser-filled values without input events.
- TypeScript validation: passed.
- Updated login markup, logo mask and all 7 referenced CSS/JavaScript assets: passed.
- Invalid credentials were rejected; existing admin sign-in, session creation and redirect were verified without modifying database records.
- Component interactions were tested in JSDOM. A connected browser was unavailable for a screenshot or physical-device visual review.

## Simple login interface — 15 October 2026

Replaced the split login layout with a single centred card based on the supplied reference: Vellore logo, Welcome Back heading, username and password inputs with icons, password visibility control, and a full-width Login button. The existing violet/apricot/ice-blue palette supplies the background, corner rings, focus states and actions. Sign-in shows progress, rejects duplicate submissions and retains entered values on failure.

- Isolated production build, including TypeScript validation: passed. Existing regression tests: 7 passed.
- Anonymous login HTML, logo, labelled controls and all 7 referenced CSS/JavaScript assets: passed.
- Invalid credentials were rejected; existing admin credentials produced a session and redirected authenticated requests away from login.
- Browser preview was unavailable. Screenshot matching and hydrated password-toggle/keyboard interactions were not visually verified.
- The user's running development server was left running; no duplicate server was started and no database records were changed.

## Chunk-loading recovery — 14 October 2026

Two Next.js development instances were found on ports 3000 and 3001 for the same project, sharing their generated cache. The reported equipment chunk was responding again during inspection, so the original browser failure was transient; concurrent cache writers were a plausible cause and have been removed.

- Stopped both development instances and archived only their generated caches under `.runtime`.
- Development now uses `.next-dev`; production uses `.next`; the verification-output override remains supported.
- `npm run dev` uses fixed port 3000. A duplicate default start was rejected without opening port 3001.
- Chunk-loading errors now show a dedicated full-page reload action instead of treating them as entered-information errors.
- Regression tests: 7 passed, including chunk-error recognition and preserving the normal retry path for database/form errors.
- Production build passed while development remained running.
- Ten authenticated routes and all 35 referenced JavaScript assets returned successful responses, including the exact reported Equipment chunk URL on port 3000.
- The Equipment development chunk stayed unchanged after the production build and route checks.
- Database records and application source data were not removed. The app remains available on localhost:3000; the duplicate localhost:3001 server was stopped.

## UI theme verification — 14 October 2026

Applied the client's violet, apricot, grey and ice-blue palette throughout the website. The sidebar stays light lavender-white, the workspace uses a pale ice-blue tint, and cards stay white. Darker matching violet and neutral shades keep buttons, links and text readable. Dashboard highlights, report charts, badges, login, tables, search controls, brand actions and multi-product bill controls share these theme tokens.

The four original values are retained in CSS variables and exposed through Tailwind:

- Violet: `oklch(70.2% 0.183 293.541)` for highlights and lavender surfaces.
- Apricot: `oklch(83.7% 0.128 66.29)` for warm accents, date and collection panels.
- Grey: `oklch(72.3% 0.014 214.4)` for neutral accents and control hover borders.
- Ice blue: `oklch(95.1% 0.026 236.824)` for cool dashboard surfaces and product accents.

Primary action shade: `#6942BA`; hover: `#5832A2`. Light accents are paired with darker text rather than white labels. Success and destructive actions retain distinct green and red colors.

The dashboard now uses compact metric cards, a quieter hero, a monthly service chart and responsive side-by-side Service Progress / Quick Actions cards. Monthly chart categories count each non-cancelled complaint once instead of overlapping open and in-progress totals.

Verified in this pass:

- TypeScript checking and the final isolated Next.js production build passed.
- Existing regression tests: 5 passed.
- Read-only production smoke checks: 28 admin page checks and 1 technician page check passed, plus login and anonymous-access checks. Existing bill product edit/add screens were included.
- Compiled OKLCH colors, primary/success/danger actions, hover, disabled and keyboard-focus styles were verified. The development server was restarted to load the updated Tailwind configuration; its served palette was checked separately.
- Primary button contrast: 6.80:1; muted text on white: 6.14:1; selected navigation text: 5.95:1. All checked text pairs meet 4.5:1, and the three checked chart shades exceed 3:1 against white.
- Existing database records were only read. The development app remains on localhost:3000.

Browser preview was unavailable in this session. Desktop/mobile screenshots, hydrated form interactions and final visual approval were not performed; the checks above do not claim those results.

## Previous core verification — 4 October 2026

Status: the core workflows pass automated local checks. Browser visual/interaction acceptance and the real Supabase deployment are still unverified.

### Verified in this pass

- `npm test`: 5 regression tests passed (India date boundaries, expiry-day warranty, invalid dates/numbers, invoice numbering beyond 1,000 records).
- `npm run typecheck`: passed.
- `npm run build:full` with an isolated `.next-validation` output: passed, including fresh Prisma Client generation and all application routes.
- Prisma schema validation: passed after dependency repair.
- Local database migration status: all 6 migrations applied, schema up to date.
- `npm run test:migrations`: all 6 migrations applied to a new temporary local database. Production seeding created only the owner; no demo customers, bills or technicians. The temporary database was removed afterward.
- `npm run test:core`: **77 checks passed** against the production server on localhost:3100, using real credentials authentication, server-action requests and database assertions.

The core test covered multi-product bills, editable invoice numbers, simultaneous automatic numbering, required PIN validation, duplicate rejection, saved-product addition/editing, two-way equipment synchronization, safe/protected deletion, technician creation/editing, office assignment restrictions, diagnosis, work logs, completion, permanent history, partial/final payments, concurrent overpayment protection, repeat complaints, cancelled-job protection and external customers without purchase bills. It also checked authenticated page rendering, CSV/PDF response generation, technician export restrictions and disabled-session access.

Temporary QA records were removed in each test's cleanup. Existing client records were preserved. Document-number sequences may have gaps from the test transactions; existing numbers were not changed.

### Repairs and usability changes

- Shared navy/white/teal interface, quieter page/card headings, solid primary buttons and visible keyboard focus.
- Mobile navigation uses a labelled dialog with keyboard dismissal/focus management; mobile content has room below the floating menu.
- Forms show pending/success/error feedback and retain entered values after validation failures.
- Saved warranty dates are no longer recalculated merely by opening an edit form; new date/duration changes still calculate expiry.
- Dashboard/report balances use payments linked to the relevant services; totals no longer silently stop at the first 100 report records.
- Zero-value charts no longer draw a nonzero segment. India report boundaries and date defaults are independent of the server timezone.
- Export dates/formats are validated; CSV text beginning with spreadsheet formula characters is escaped.
- Bill Details is covered by authentication middleware; restricted technician navigation no longer redirects in a loop.
- Database scripts load `.env.local`; Docker excludes local secrets/data and generates Prisma Client during its build.

### Local environment findings

The installed Prisma WebAssembly file did not match the official package of the same version; additional library files were unreadable. A clean dependency installation from the existing lockfile replaced the damaged installation. Recovery copies remain in `.runtime/node_modules-before-repair-20261004` and `.runtime/node_modules-unreadable-20261004` (excluded from Git).

PostgreSQL later returned an internal allocation error for new connections. A clean stop/start resolved it; migration status and the 77-check workflow suite passed afterward. No database reset was performed.

Final handover: the development app was restored on localhost:3000; `/login` returned HTTP 200 and TypeScript passed after its development types regenerated. QA user/customer counts were both zero. A full custom-format `pg_dump` completed successfully at `.runtime/vfe-local-backup-1791137141339.dump`. Keep a copy outside this machine as well.

The installed Node version during these checks was 24.15.0. The project targets Node 22 for deployment. The earlier Prisma crash was confirmed as a corrupted local dependency, not established as a Node-version incompatibility.

### Remaining acceptance checks

- Browser connection returned no available browser. No desktop/mobile screenshots, hydrated button interactions, keyboard walkthrough or visual approval were performed in this pass. HTTP route checks are not a substitute for those tests.
- PDF endpoints returned valid PDF responses; printed layout still needs client/device approval.
- Connect Supabase and repeat deployment/login/workflow checks there; GitHub push and hosting deployment have not been performed.
- Because Windows reported unreadable local directories, preserve a current backup of source and database before relying on this machine for client data.

See `docs/CLIENT_GUIDE.md` for the daily workflow and `docs/UAT_TEST_PLAN.md` for client acceptance.

## Historical validation notes

Validated on 24 September 2026 against an isolated PostgreSQL 17 database.

## Automated and build checks

- Prisma schema validation: passed
- Both committed Prisma migrations applied successfully: passed
- Seed execution: passed
- TypeScript `tsc --noEmit`: passed
- Optimized Next.js production build: passed (all application and API routes compiled)

Revalidated on 29 September 2026 after the complaint-entry and equipment-linking updates:

- TypeScript `tsc --noEmit`: passed
- Prisma schema validation: passed
- Optimized Next.js production build: passed
- Local PostgreSQL helper `npm run db:local:status`: passed
- Authenticated smoke checks for dashboard, complaint creation, complaint detail, service history and service-report PDF: passed

Revalidated on 29 September 2026 after Bill Details updates:

- Prisma migration `20260929131631_add_bill_details`: applied successfully
- Prisma Client generation: passed after stopping the running dev server that held the Prisma DLL
- Seed execution with login/company data only: passed
- TypeScript `tsc --noEmit`: passed
- Prisma schema validation: passed
- Optimized Next.js production build: passed
- Authenticated `/bill-details`: 200
- Authenticated `/bill-details/[id]`: 200
- Authenticated complaint creation shortcut from Bill Details customer/equipment: 200

Revalidated on 29 September 2026 after Bill Details UX improvements:

- Added guided Bill Details flow cards: passed build/typecheck
- Added direct complaint creation from a bill with equipment dropdown and technician assignment: passed build/typecheck
- Added protected Delete Bill and Delete Item controls: passed build/typecheck
- TypeScript `tsc --noEmit`: passed
- Optimized Next.js production build: passed
- Authenticated `/bill-details`: 200
- Authenticated `/bill-details/[id]`: 200
- Authenticated global search: 200

Revalidated on 29 September 2026 after demo-data cleanup and UX wording pass:

- Removed seeded/demo/QA business records from local database: passed
- Updated `prisma/seed.ts` to create only company settings, login users and technician profiles: passed
- Verified seed no longer recreates demo customer, demo bill, demo complaint or demo service records: passed
- Visible app/docs scan for old demo names/numbers: passed
- TypeScript `tsc --noEmit`: passed
- Prisma schema validation: passed
- Optimized Next.js production build: passed
- Authenticated smoke checks for dashboard, customers, customer detail, equipment, equipment detail, bill details, bill detail, complaints, new complaint, assignments, technicians, technician detail, jobs, service history, reports, users and settings: passed

## Live workflow checks

- Credentials authentication for Admin and Technician: passed
- Create customer, equipment and service complaint through server actions: passed
- Create Bill Details for a customer and register purchased equipment/warranty in the same flow: passed
- Create a complaint while creating a new customer/equipment from the same complaint form: passed
- Link or create equipment later for a complaint originally registered with unknown equipment: passed
- Assign and reassign technicians while preserving assignment and ending reasons: passed
- Technician inspection, actual problem, work log and no-parts workflow: passed
- Required completion validation and permanent `ServiceRecord` creation: passed
- Historical customer, equipment, technician and warranty snapshots: passed
- Second complaint for the same equipment and repeat-issue detection: passed
- Existing completed history remained unchanged after the second complaint: passed
- Service amount capture, Service Collections and permanent service history: passed
- Service report PDF generation: passed
- Report CSV and PDF export: passed
- Technician export restrictions: passed
- Disabled-account session invalidation: passed
- Global security response headers: passed

## Release checks still required with the client

Technical validation cannot replace business acceptance. Before production, complete `docs/UAT_TEST_PLAN.md` using the client's real company details, tax rules, warranty policy, users and devices. Verify the final visual appearance in the deployment browsers and print one real service report.
# Final Delivery Validation — 25 October 2026

The completed application was revalidated from source, against a disposable
fresh PostgreSQL database, and against the configured Supabase database.

- TypeScript validation: passed.
- Automated regression suite: **70/70 passed**.
- Fresh database: **12/12 migrations applied successfully**.
- Production seed: owner and eight default brands only; no demo customers,
  bills, equipment, complaints or technicians.
- Authenticated end-to-end workflow: **106/106 checks passed**.
- Supabase read-only route/export smoke test: **37/37 passed**, including 11
  dynamic record pages, CSV export and both PDF exports.
- Optimized Next.js production build: passed for all application routes.
- Production dependency audit: **0 known vulnerabilities**.
- Git reachable-object integrity: passed.
- Environment safety: `.env.local` is ignored and not tracked; required
  variables are documented in `.env.example`.
- Temporary QA records, databases, servers and validation build folders were
  removed after testing.

The tested workflow covers authentication and permissions; customer, invoice,
product and warranty management; multiple physical machines per invoice line;
complaint registration; multi-technician assignment and completion credit;
permanent service history; protected deletion; service collections; reports;
PDF/CSV exports; account disabling; and all owner/office/technician routes.

Delivery note: commit and push the current working tree before deploying from
GitHub/Vercel. The configured remote still points to the earlier first commit
until that handoff step is completed.
