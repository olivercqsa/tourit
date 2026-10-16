# Tourit development handoff

**Audit date:** 16 October 2026
**Application version:** 0.1.0 (from `package.json`)
**Current state:** Early Vite/Supabase implementation; production readiness has not been established.

## Project overview

Tourit connects esports broadcast talent with tournament organisers and production teams. The browser app is a single-page Vite application: `index.html` loads `src/main.js`, which renders hash-based routes and styles in `src/styles.css`. Supabase JS provides email/password authentication, profile and job data, applications, saved jobs, shortlists, messaging, and public image uploads. SQL migrations under `supabase/migrations/` define tables, access policies, triggers, and RPC functions. `supabase/functions/purge-expired-jobs/index.ts` handles scheduled expiry cleanup and recruiter force deletion.

Major current routes include home, jobs/job details, talent search/profile, dashboard, posting, inbox, sign-in/reset, promise, community, contact, terms and privacy. `/demo` now points users back to the home page; local fictional samples are shown only in the development home preview. `dist/` is generated output. The root also contains brand assets and build archives.

## Release report and documentation state

`TOURIT-RELEASE-REPORT.md` is a historical report dated 15 October 2026. Its deployment notes predate the current Vercel inspection and should not be treated as current status. `CHANGELOG.md` is the ongoing record of repository changes. The contradictory `SETUP.md` was removed on 16 October 2026; use this handoff for current status and the release report only for historical context.

On 16 October 2026, the Vercel dashboard was inspected read-only. The `tourit` project exists in the `tourit1` team. Its production deployment is **Ready**, served at `cooperqsa.com` and `tourit-mauve.vercel.app`, and was created from a **Vercel Drop** two days earlier. A separate GitHub preview for `codex/platform-flow-integrations` is also **Ready**. Vercel still offers **Connect Git Repository** in the production checklist, so the production project is not configured for automatic deployments from GitHub. Connecting it requires the user to authorize repository access in Vercel. The live `cooperqsa.com` home page was opened and displayed the Tourit site.

Migration and release claims in the historical report are not a substitute for checking hosted state. Migration 008 was reported as applied by the user and publication/RPC state was previously checked read-only; do not rerun migrations.

## Cleanup performed

Removed the two unreferenced demo page renderers (`demoProfilesPage` and `demoTournamentPage`) and their inline tournament role data from `src/main.js`. The `/demo` route already rendered a “Preview moved” page, and those renderers had no callers. Kept the fictional profile and organisation data because the local development home preview still uses it. Kept demo-related CSS because a full selector audit was not warranted for this cleanup.

No migrations, auth/security code, assets, configuration, release documentation, or user data were deleted or changed.

## Validation

- `vite build` passed on 16 October after the availability changes. No test or lint scripts are defined.
- The live Vercel home page and deployment status were checked read-only. The test talent account had 31 available dates saved for October 2026; no database records were changed.
- Signup, role-based end-to-end flows, hosted RLS behavior, storage permissions, force deletion, and scheduled cleanup have not been tested in this session.
- No release archive was regenerated. The checked-in/ignored archives may not match current source.
- The project is on Git branch `codex/platform-flow-integrations`, pushed to `origin`. Do not assume the production Vercel project deploys from this branch; Git integration is not configured there.
- `.env.local` exists but was not inspected or modified. It is excluded from Git by `.gitignore`.

## Outstanding issues by priority

### CRITICAL

- None confirmed by this static review. Hosted configuration and runtime behavior were not tested, so this is not a security certification.

### HIGH

- Confirm hosted Supabase migration state before launch; do not blindly rerun migrations.
- Confirm production auth Site URL/redirect allowlist and SMTP/email confirmation behavior. The release report says these still need verification.
- Finish and review operator identity, jurisdiction, retention, and other legal disclosures. Current Terms and Privacy pages label themselves drafts and explicitly require operator review.
- Perform separate talent/host account tests for signup, profile privacy, job create/edit/crop, applications, messaging, deletion recovery/force delete, and mobile layouts before public signups.

### MEDIUM

- Connect the existing Vercel project to GitHub after authorizing repository access; configure and verify its production branch and automatic deployments.
- There are no test, lint, or type-check scripts. Add coverage as part of a planned quality task, especially for auth redirects, role-based access, and job deletion.
- OAuth providers remain hidden behind `socialSignInEnabled = false`; enable only after each provider is configured and tested.
- Review the Supabase security model in a live project. The migrations use RLS, restricted column grants, private participant checks, and service-role-only hard deletion, but static inspection cannot prove the hosted policies match these files.

### LOW

- Remove or consolidate the remaining orphaned CSS for retired demo profile/tournament layouts only after confirming no planned reuse. This was intentionally left untouched.
- Consider configuring analytics and community URLs only after production consent, privacy, and operator decisions are settled.

## Recommended next steps

1. Connect the existing Vercel `tourit` project to the GitHub repository after authorizing repository access, then configure/verify its production branch and automatic deployments.
2. Verify migration/function deployment state using read-only dashboard checks. Configure Supabase auth redirects and production email, then verify signup and confirmation flows.
3. Perform separate talent/host account tests for signup, profile privacy, job create/edit/crop, applications, messaging, deletion recovery/force delete, and mobile layouts.
4. Review legal disclosures and verify production behavior before public signups.

## Session readiness

The source builds and is suitable for continued local development. It is not ready to be treated as a verified production release: the live deployment, migration state, production auth settings, legal review, and critical multi-user flows still need confirmation. Do not deploy or rerun migrations based solely on the current documents.
