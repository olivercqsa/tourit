# Changelog

Repository changes are recorded here as they are made. Entries describe source and project-document changes; deployments and hosted database changes are called out separately when verified. Earlier product and visual work is summarized from the historical [release report](TOURIT-RELEASE-REPORT.md); its dates and hosted-state claims are not independently verified here.

## 2026-10-16

### Account username validation

- Added a unique, lowercase account username for signup; talent on-air names remain separate display nicknames.
- Added a database uniqueness index and username format validation, with matching checks in signup and OAuth onboarding.
- Added a required username setup screen for existing talent accounts that have no username; it blocks normal app navigation until one is saved.
- Displayed usernames alongside published talent names and normalized signup/sign-in email input. Supabase Auth remains the authority preventing duplicate email accounts.
- Applied `supabase/migrations/20261016182953_account_usernames.sql` to the connected Supabase project. Verified the username column, format constraint, unique index, authenticated update grant, account trigger, and three-argument OAuth onboarding function.
- Applied `supabase/migrations/20261016183051_legacy_signup_username_compat.sql` so older signup submissions remain compatible; talent accounts created without usernames are routed to the required username setup on sign-in.
- Published the frontend to `main` as commit `95c0d4d`; Vercel reported the production deployment **Ready** for `cooperqsa.com` on 2026-10-16.

### Availability calendar polish

- Softened the availability markers and date styling; explicit unavailable dates now use a muted gray treatment without a shadow pulse.
- Added a slim vertical marker to today and locked editing of past dates in the profile availability calendar.
- Moved today's marker into the gap before the date square and added a hover/focus “Today” hint.
- Replaced the vertical marker with a white outline around today's date; kept the “Today” hover/focus hint.
- Reduced today's outline to a subtle, translucent highlight.
- User approved publishing these calendar changes on 2026-10-16.

### Availability calendar and talent status

- Added animated month transitions and date-selection feedback to the availability calendar, respecting reduced-motion preferences.
- Added talent availability status to Find Talent cards and talent profiles. Status is **Available** when at least 70% of the viewed month’s dates are available; otherwise it is **Limited availability**.
- Added the green/orange availability orb with context text to Find Talent cards.
- Changed calendar defaults so dates without an explicit unavailable record are available. Selecting a date marks it unavailable; selecting it again restores availability.
- Fixed the card label always showing “Limited”: the availability summary now returns the boolean used by the card text.
- Confirmed the test account had 31 saved available dates in October 2026; the database was only read, not modified.

### Platform work

- Integrated the availability calendar, private application attachments, notification display, and realtime inbox refresh.
- Corrected auth callback handling for email confirmation and added the confirmation return popup.
- Added Supabase migration 008 for realtime publication/security configuration. The user reported running migration 008; migrations were not rerun during this work.

### Project documentation and deployment inspection

- Removed the outdated and internally contradictory `SETUP.md`; updated links and current project handoff notes.
- Added this changelog and summarized earlier work from the historical release report.
- Inspected the Vercel dashboard: project `tourit` is connected to `olivercqsa/tourit`; its `codex/platform-flow-integrations` preview is **Ready**. The live production deployment at `cooperqsa.com` and `tourit-mauve.vercel.app` was **Ready** from a Vercel Drop, and Vercel identifies `main` as its production branch. The live home page responded with Tourit. The repository connection already existed when checked, so no additional Vercel setting needed changing.

### Validation and publishing

- `vite build` passed after the availability changes.
- Pushed source changes through commit `1b23320` to `codex/platform-flow-integrations` on GitHub. This did not deploy the live site.
- Pushed the verified branch to Vercel's `main` production branch as commit `72386ce`; Vercel created a Git-based production deployment and reported **Ready** for both production domains.
- Updated this handoff and changelog with the confirmed production deployment status.

### Earlier project work (historical summary)

- Built the Vite/Supabase application foundation, account onboarding, talent and organisation profiles, jobs, applications, messaging, and saved jobs/shortlists.
- Added recoverable job deletion, force deletion, scheduled expiry cleanup, image crop controls, profile preview/privacy behavior, email confirmation UI, cookie consent, and community/contact/legal pages.
- Refined Tourit branding, responsive layouts, search/filter controls, and page/calendar motion. Social sign-in remains disabled pending provider setup.
- Removed unused demo page renderers while retaining sample data used by the local development home preview.

See [DEVELOPMENT-HANDOFF.md](DEVELOPMENT-HANDOFF.md) for current outstanding work and verification limits.
