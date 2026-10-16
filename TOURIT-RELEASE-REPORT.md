# Tourit — release report and changelog

**Prepared:** 15 October 2026
**Production status:** Build verified; upload to Vercel was not completed from this session. The live site remains on its previous deployment.

## Release check

- `npm run build` completed successfully and produced the production site in `dist/`.
- The distributable archive is `tourit-production-build.zip` (1,168,105 bytes). It contains the built static files, not the project source or `.env.local`.
- No Vercel deployment ID or new live URL is available because the dashboard upload could not be completed. The Vercel project overview was open and showed `cooperqsa.com` as the production domain.
- The workspace has no configured Git remote or local Vercel project link, and the authenticated Vercel CLI could not be used. The desktop controls also prevented dropping the archive across application windows.

**Manual publish step:** In the Vercel dashboard, open the existing `tourit` project, then drag `tourit-production-build.zip` from File Explorer onto the project overview and complete the deployment prompt. Confirm the resulting deployment is marked **Ready** and visit `https://cooperqsa.com` to check it. The archive is at `C:\Users\olive\Documents\ChatGPT\tourit\tourit-production-build.zip`.

## Changelog of work covered in this conversation

### Product foundation and Supabase

- Reviewed the original Tourit HTML demo and mapped its transition toward a multi-user Supabase-backed app while preserving the existing design and features. The original HTML was to remain untouched.
- Connected the app configuration to the user’s Supabase project and worked through database/storage setup, migrations, OAuth onboarding, recoverable job deletion, and the force-delete Edge Function.
- The user reported applying migrations `003`, `004`, `0005_oauth_onboarding`, `0006`, and `0007_recoverable_job_deletion`, and deploying `purge-expired-jobs`. These are user-reported steps; this release check did not independently query the Supabase project.
- Diagnosed the force-delete request/CORS problem and deployed a corrected Edge Function after the user authorized deployment. Continued troubleshooting when local Docker was unavailable and requests from `localhost:5173` failed.

### Brand and visual design

- Added the Tourit app icon beside the wordmark and refined the wordmark typography, spacing, width, and graphic treatment.
- Created a 4K app icon, a consistent PNG brand asset pack, alternate logo treatments, and a cyan inverted logo.
- Added logo color switching between yellow and cyan with a simple spin when navigating between Find Talent and other pages; refined the animation after reports of a stuck/janky flip.
- Improved overall font choices, text sizing, page spacing, header layout, and responsive visual consistency.

### Landing page, navigation, and motion

- Reworked landing-page typography and content; removed demo-view and redundant Find Talent/Find Jobs prompts, and added generated demo profiles and tournaments for local building.
- Added subtle page-transition, icon-hover, scrolling, background, and header-button animations; tuned the header-button highlight to a solid yellow radial bubble and spaced the buttons.
- Reworked the landing and Our Promise backgrounds to fill the viewport edges, removed side bars/top peek gaps, and adapted the graphic circle into a logo-inspired background treatment.
- Added the Our Promise page explaining the lack of networking, experience, and consistent opportunity for Valorant casters/observers, and how Tourit serves talent and tournament organisers. Reduced cards and removed the numbered label and “The Gap” copy as requested.
- Swapped Find Jobs and Find Talent navigation order and applied the requested yellow/cyan accent treatments, then reverted the search-box accents when asked. Restored solid-white headings and removed the cyan border around the Find Talent filter card.
- Moved header Log in/Sign up controls to the left, beside the text logo.

### Talent and job features

- Added demo profile customisations and tournament examples.
- Added a Talent Dashboard profile preview.
- Added job image adjustment/cropping during job creation, then corrected the listing-card crop to fill the display box and match its intended aspect ratio after iterative visual feedback.
- Added Your Jobs controls to open/close listings, soft-delete with a 24-hour recovery window, move deleted jobs to the bottom in a muted style, show a countdown and recovery action, purge expired jobs, and offer confirmed force deletion.
- Added on-air-name validation capped at 16 characters and restricted unsafe characters.
- Improved Find Talent and Find Jobs filter dropdown styling, animations, alignment, and accent consistency.

### Authentication, consent, and communication pages

- Added vertically stacked social sign-in designs and company-logo assets for Google, Microsoft, X, and Discord; checked the Discord/X marks. These provider buttons were later temporarily hidden because provider credential setup in Supabase was confusing. They should not be considered enabled for users until each provider is configured and tested in Supabase.
- Added a clear post-email-confirmation message for returning users.
- Added a selective cookie-consent popup and analytics-cookie support. The local environment did not contain a Google Analytics measurement ID, so analytics collection is not configured by this release check.
- Added Contact, community links (Discord, X, Twitch), privacy/legal disclosures, and a more neutral Terms of Service page. Copy identifies Tourit temporarily and states that CooperQSA manages, maintains, and owns Tourit as its service provider.
- Added sticky-footer layout across pages.

## Items to finish after upload

- Configure any required Vercel production environment variables and redeploy if missing. The local `.env.local` was deliberately excluded from the archive. The Google Analytics measurement ID and community URL variables were not configured locally at build time.
- Verify production auth redirects and email confirmation URLs use the live domain; check Supabase Auth URL configuration and allowed redirect URLs.
- Configure and test each social provider only if/when desired; the social login buttons are currently hidden pending credentials.
- Test job create/edit/image crop, open/close, recover, force delete, expiry, profile preview, consent preferences, and mobile layouts on the live site.
- Review legal copy with the actual operator details and jurisdiction before treating it as final.
- For future one-click publishing, connect the Vercel project to a Git repository and configure a remote; this workspace currently has no Git remote.
