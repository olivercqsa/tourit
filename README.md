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

## Supabase setup

See [SETUP.md](SETUP.md) for the current database, storage, authentication, and Edge Function setup notes. Treat deployment and migration status in the existing release report as historical/user-reported context until you verify the Supabase project.

## Current release readiness

This workspace is an early development implementation, not a verified production release. The release report records an incomplete deployment, and production auth settings, migration state, legal disclosures, and multi-user flows still require confirmation. See [DEVELOPMENT-HANDOFF.md](DEVELOPMENT-HANDOFF.md) for the latest audit and prioritized follow-up work.
