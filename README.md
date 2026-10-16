# Tourit

Tourit connects esports broadcast talent with tournament organisers and production teams. The current application is a Vite single-page app with Supabase authentication, profiles, job listings, applications, saved jobs, shortlists, messaging, and image uploads.

## Run locally

Requirements: Node.js 20.19 or newer.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for your Supabase project.
3. Start Vite with `npm run dev`.

Use only a Supabase publishable/anon key in browser environment variables. Never put a service-role key or other secret in a `VITE_*` variable.

## Build

- `npm run build` creates the static production output in `dist/`.
- `npm run preview` serves the production build locally.

## Project notes

See [DEVELOPMENT-HANDOFF.md](DEVELOPMENT-HANDOFF.md) for the current project status and [CHANGELOG.md](CHANGELOG.md) for recorded changes. Treat deployment and migration status in [TOURIT-RELEASE-REPORT.md](TOURIT-RELEASE-REPORT.md) as historical/user-reported context unless independently verified.

## Current release readiness

The live Vercel site is available at `https://cooperqsa.com`, but its production deployment is currently a manual Vercel Drop rather than an automatic Git deployment. Production auth settings, hosted migration state, legal disclosures, and multi-user flows still require confirmation. See [DEVELOPMENT-HANDOFF.md](DEVELOPMENT-HANDOFF.md) for current status and follow-up work.
