# Tourit development handoff

**Audit date:** 16 October 2026
**Application version:** 0.1.0 (from `package.json`)
**Current state:** Early Vite/Supabase implementation; production readiness has not been established.

## Project overview

Tourit connects esports broadcast talent with tournament organisers and production teams. The browser app is a single-page Vite application: `index.html` loads `src/main.js`, which renders hash-based routes and styles in `src/styles.css`. Supabase JS provides email/password authentication, profile and job data, applications, saved jobs, shortlists, messaging, and public image uploads. SQL migrations under `supabase/migrations/` define tables, access policies, triggers, and RPC functions. `supabase/functions/purge-expired-jobs/index.ts` handles scheduled expiry cleanup and recruiter force deletion.

Major current routes include home, jobs/job details, talent search/profile, dashboard, posting, inbox, sign-in/reset, promise, community, contact, terms and privacy. `/demo` now points users back to the home page; local fictional samples are shown only in the development home preview. `dist/` is generated output. The root also contains brand assets and build archives.

## Release report and documentation state

The sole release report, `TOURIT-RELEASE-REPORT.md`, is dated 15 October 2026. It records a successful production build and an incomplete Vercel upload; the live domain was said to remain on its previous deployment. It says migrations 003, 004, 005, 006 and 007 and the purge function deployment were user-reported, not independently checked. Social provider buttons were intentionally disabled pending provider configuration. Production analytics, auth redirects, production mail, legal review, and live end-to-end testing were still outstanding.

`SETUP.md` is a more current feature/setup guide in parts, but it contradicts the release report on migration state: it says 005 and 007 still need action, while the release report says they were reportedly applied. Neither document verifies the live Supabase state. `SETUP.md` also says About, Contact, legal pages and availability-calendar work remain; Contact/legal pages exist in the current UI, while the calendar and private application attachments do not. The report describes prior design/product work and must not be read as proof that each described capability is currently deployed.

## Cleanup performed

Removed the two unreferenced demo page renderers (`demoProfilesPage` and `demoTournamentPage`) and their inline tournament role data from `src/main.js`. The `/demo` route already rendered a “Preview moved” page, and those renderers had no callers. Kept the fictional profile and organisation data because the local development home preview still uses it. Kept demo-related CSS because a full selector audit was not warranted for this cleanup.

No migrations, auth/security code, assets, configuration, release documentation, or user data were deleted or changed.

## Validation

- `node node_modules/vite/bin/vite.js build` passed before cleanup. Run it again after the cleanup before the next session; the project defines no test or lint scripts.
- No browser-based flows or live Supabase checks were performed during this audit. Production auth, RLS behavior against the hosted project, storage permissions, force deletion, and scheduled cleanup therefore remain unverified here.
- No release archive was regenerated. The checked-in/ignored archives may not match current source.
- Git has no commits or configured remote, and all project files visible to Git are untracked. Preserve the existing workspace carefully; do not assume a clean baseline or use Git resets/checkout to recover files.
- `.env.local` exists but was not inspected or modified. It is excluded from Git by `.gitignore`.

## Outstanding issues by priority

### CRITICAL

- None confirmed by this static review. Hosted configuration and runtime behavior were not tested, so this is not a security certification.

### HIGH

- Confirm hosted Supabase migration state before launch. The report's migration status is user-reported and conflicts with `SETUP.md`; do not blindly rerun migrations.
- Confirm production auth Site URL/redirect allowlist and SMTP/email confirmation behavior. The release report says these still need verification.
- Finish and review operator identity, jurisdiction, retention, and other legal disclosures. Current Terms and Privacy pages label themselves drafts and explicitly require operator review.
- Build and test missing core flows: availability calendar, private application attachments, notification display, and live/realtime inbox refresh. Notifications are generated in the database but not displayed; inbox messages refresh on navigation/open.
- Perform separate talent/host account tests for signup, profile privacy, job create/edit/crop, applications, messaging, deletion recovery/force delete, and mobile layouts before public signups.

### MEDIUM

- Reconcile `SETUP.md` and the release report into one verified deployment/migration checklist; deployment status and archive freshness are not established by this workspace audit.
- There are no test, lint, or type-check scripts. Add coverage as part of a planned quality task, especially for auth redirects, role-based access, and job deletion.
- OAuth providers remain hidden behind `socialSignInEnabled = false`; enable only after each provider is configured and tested.
- Review the Supabase security model in a live project. The migrations use RLS, restricted column grants, private participant checks, and service-role-only hard deletion, but static inspection cannot prove the hosted policies match these files.

### LOW

- Remove or consolidate the remaining orphaned CSS for retired demo profile/tournament layouts only after confirming no planned reuse. This was intentionally left untouched.
- Consider configuring analytics and community URLs only after production consent, privacy, and operator decisions are settled.

## Recommended next steps

1. Establish a recoverable Git baseline (commit or otherwise archive the current untracked source) before larger edits.
2. Verify migration/function deployment state using read-only dashboard checks, then update `SETUP.md` and the release report to agree.
3. Decide production domain/host settings; configure Supabase auth redirects and production email, then verify signup and confirmation flows.
4. Complete the missing private attachments, availability, notification, and inbox refresh work in dependency order, with role-based tests.
5. Review legal disclosures and verify production behavior using separate talent and host accounts before public launch.

## Session readiness

The source builds and is suitable for continued local development. It is not ready to be treated as a verified production release: the live deployment, migration state, production auth settings, legal review, and critical multi-user flows still need confirmation. Do not deploy or rerun migrations based solely on the current documents.
