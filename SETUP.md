# Tourit Supabase setup

## Current integration state

The workspace now contains a Vite frontend in `src/` using the Tourit CSS,
Supabase Auth, live talent/job reads, profile/job editing, applications, saved
jobs, shortlists, direct messaging and job/profile image uploads. Database
notifications are generated but not yet shown in the UI.
The URL and publishable key are loaded from `.env.local`. The original Downloads
HTML remains untouched. The web app is not deployed, and domain DNS has not been
changed.

The current UI is an implementation slice, not a launch-ready replacement for
every demo screen: About, Contact, legal pages, the editable availability
calendar, private application attachments, notification display and realtime
inbox updates remain to be completed. Messaging refreshes when you open or
revisit the inbox. You confirmed migrations 003 and 004 were run; read-only API
checks now confirm their tables and public media buckets are present.

## Manual step: install and start the local app

The local production build succeeds with the installed Node runtime and
dependencies. `npm` is not on this workspace's PATH, so start the dev server
with `node node_modules/vite/bin/vite.js --host 127.0.0.1`, or build with
`node node_modules/vite/bin/vite.js build`. `.env.local` contains the supplied
Supabase URL and publishable key. Do not add a secret/service-role key.

## Manual step: database and storage

1. Open the Supabase dashboard for project `ryrzspoumcussjznnadu`.
2. The Database > Migrations page in your screenshot tracks migrations run by
   the Supabase CLI. It does not list SQL Editor queries, so an empty page there
   does not mean the foundation is missing. Our read-only checks confirmed the
   foundation tables exist and the public organisation policy works. Skip
   migrations 001 and 002; do not rerun them.
3. If you want to verify in the dashboard, open **SQL Editor**, choose **New
   query**, and run this read-only check:

   ```sql
   select check_name, result
   from (values
     ('profiles table', to_regclass('public.profiles') is not null),
     ('talent_profiles table', to_regclass('public.talent_profiles') is not null),
     ('organisations table', to_regclass('public.organisations') is not null),
     ('organisation_members table', to_regclass('public.organisation_members') is not null),
     ('signup trigger', exists (
       select 1 from pg_trigger
       where tgname = 'create_tourit_account' and not tgisinternal
     )),
     ('public organisation policy', exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'organisations'
         and policyname = 'organisation_public_read'
     ))
   ) as checks(check_name,result);
   ```

   The table checks and public organisation policy should be `true`. If the
   signup trigger is `false`, pause before accepting registrations and let me
   know; do not rerun migration 001 because its tables are already present.
4. Migrations 003 and 004 have now been run. Read-only checks returned HTTP 200
   for `jobs`, `talent_availability`, and object listing in the public avatar
   and job-cover buckets. Private tables correctly deny anonymous access.

## Domain connection

The production Vite build is ready in `dist/`, but it is not hosted yet. The
recommended path is to deploy it to Vercel, add the chosen Tourit hostname to
the Vercel project, and copy the exact A/CNAME/TXT records shown by Vercel into
the domain's Squarespace DNS settings. Add only the requested web/verification
records; keep the existing Google Workspace MX, SPF, DKIM and DMARC records.
Do not change nameservers. After DNS validation, add the production URL to
Supabase Auth's Site URL and Redirect URLs. DNS changes can take time to
propagate. The domain name and hosting choice are still needed to do this.

The already installed authentication foundation creates an unpublished talent profile or organisation during
email/password signup. The signup request must supply `options.data.display_name` and
`options.data.account_type` (`talent` or `host`). Tourit stores no passwords.

The trigger applies to all new Auth users, including dashboard-created users.
Email/password users without the required metadata cannot sign up. Social
sign-in buttons are implemented for Google, Microsoft, X/Twitter and Discord.
Apply migration `202610150005_oauth_onboarding.sql` before enabling them; it
lets new social users choose talent or host after their first provider sign-in.
Existing Auth users are not backfilled by the original migration.

Account type and organisation membership are not client-editable. The name and
account type are the only fields in the general profile table; email remains
in Supabase Auth. Published talent records and their display names are public.
Unpublished records are visible only to their owner. Membership records are
visible only to their associated user. Team invitations and membership
management will require a separate restricted workflow.

## Manual step: authentication and hosting settings

- Enable email/password authentication and email confirmation.
- Add the exact app origins to Authentication > URL Configuration. OAuth
  returns to the current site origin and Supabase JS processes the callback.
- Configure a production SMTP provider before opening signups to the public.
- Choose the website host and domain. DNS and email-domain verification need
  access to your hosting/domain accounts.

## Manual step: social sign-in providers

The app uses Supabase provider IDs `google`, `azure` (Microsoft), `x`
(X/Twitter OAuth 2.0), and `discord`. Each provider needs its own OAuth app and
credentials. Store provider secrets in Supabase Auth settings, never in
`.env.local` or browser code.

1. Run `supabase/migrations/202610150005_oauth_onboarding.sql` in Supabase SQL
   Editor after migrations 001-004. It keeps new social accounts private until
   their owner chooses an account type, then completes setup through a
   restricted database function. Do not enable social signup before applying it.
2. In **Authentication > URL Configuration**, keep the production site as the
   Site URL and add `http://localhost:5173/` plus the current Vercel URL to
   **Redirect URLs**. Add the custom domain there after DNS is connected.
3. In **Authentication > Providers**, enable each provider and enter its client
   ID and secret. In each provider's developer console, allow the Supabase
   callback URL shown in the provider settings:
   `https://ryrzspoumcussjznnadu.supabase.co/auth/v1/callback`.
4. Create/configure the OAuth apps in Google Cloud, Microsoft Entra, X
   Developer, and Discord Developer Portal. Configure their consent and
   callback settings, then copy client credentials into Supabase. Microsoft
   sign-in requests the `email` scope.
5. Test each provider locally and on Vercel. A first-time social user should
   see Tourit's account setup form; an existing user should sign in normally.

## Manual step: talent on-air name validation

Talent on-air names are limited to 1–16 characters: ASCII letters, numbers,
spaces, hyphens, underscores and periods. Names must start and end with a
letter or number. Host organisation names keep their existing 1–100 character
limit. The browser validates new talent signups and OAuth onboarding; the
database constraint prevents API clients from bypassing the rule.

Run `supabase/migrations/202610150006_talent_on_air_name_validation.sql` in the
Supabase SQL Editor. It checks existing talent names first and stops without
changing the database if any need attention. If it stops, find those names with:

```sql
select id, display_name
from public.profiles
where account_type = 'talent'
  and not (
    char_length(display_name) between 1 and 16
    and display_name ~ '^[A-Za-z0-9]([A-Za-z0-9 ._-]{0,14}[A-Za-z0-9])?$'
  );
```

Update any returned names to valid values, then run the migration again.

## Manual step: Your Jobs and 24-hour deletion recovery

The recruiter dashboard now includes Open/Close and Delete controls. Delete
moves a listing into a grayed-out recovery section, where it can be restored
until its 24-hour countdown expires. A separate Force delete button asks for
confirmation, then immediately removes the cover image and job row; foreign
keys cascade to applications, application history and saved-job rows. At normal
expiry, the scheduled cleanup does the same. There is no tournament table in
this version of Tourit: the tournament showcase is static demo content, so it
is not part of a recruiter's saved job data.

Before using these controls on Supabase, apply
`supabase/migrations/202610150007_recoverable_job_deletion.sql` in the SQL
Editor. It adds the deletion timestamp, hides deleted listings from public job
search, enforces the 24-hour recovery deadline in the database, and removes
direct client permission to permanently delete jobs.

Permanent cleanup also needs a scheduled Edge Function. Until you complete
these steps, deleted jobs remain recoverable in the dashboard (the database
will still refuse recovery after 24 hours), but automatic permanent cleanup is
not active.

1. In **Database > Extensions**, enable `pg_cron`, `pg_net` and `supabase_vault`.
2. Install the Supabase CLI, sign in, and link the project. From the Tourit
   folder, run:

   ```powershell
   supabase login
   supabase link --project-ref ryrzspoumcussjznnadu
   supabase functions deploy purge-expired-jobs --project-ref ryrzspoumcussjznnadu --use-api
   ```

   `--use-api` avoids requiring Docker Desktop. Redeploy after local function
   changes so its CORS preflight handling and authenticated force-delete action
   are available.
   The same function verifies the signed-in user and organisation membership;
   no additional secret or SQL migration is needed for Force delete.

3. Generate a long random secret (for example, in a password manager). In
   **Edge Functions > Secrets**, add it as `TOURIT_PURGE_SECRET`. The Supabase
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied to the function
   by the platform; never put the service-role key in browser code.
4. In **SQL Editor**, replace `PASTE_THE_SAME_RANDOM_SECRET_HERE` below with
   that same secret, then run this once. Vault keeps the URL and secret out of
   the scheduled SQL definition; the schedule calls the function every five
   minutes.

   ```sql
   select vault.create_secret(
     'https://ryrzspoumcussjznnadu.supabase.co',
     'tourit_purge_project_url'
   );
   select vault.create_secret(
     'PLACEHOLDER',
     'tourit_purge_cron_secret'
   );

   select cron.schedule(
     'tourit-expired-job-purge',
     '*/5 * * * *',
     $job$
       select net.http_post(
         url := (select decrypted_secret from vault.decrypted_secrets
                 where name = 'tourit_purge_project_url')
                || '/functions/v1/purge-expired-jobs',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'x-tourit-cron-secret', (select decrypted_secret
                                    from vault.decrypted_secrets
                                    where name = 'tourit_purge_cron_secret')
         ),
         body := '{}'::jsonb
       );
     $job$
   );
   ```

   Run the schedule only once. If you need to recreate it, first remove the
   existing schedule with
   `select cron.unschedule('tourit-expired-job-purge');`.

The permanent cleanup calls the Storage API to remove the cover image before
deleting the database row. If image removal fails, the function reports an
error and tries the job again on a later schedule. It does not try to delete
Storage files with SQL.

## Remaining work

1. Finish remaining demo screens, calendar, private application attachments,
   live message refresh and notification display.
2. Add local, Vercel and eventual custom-domain URLs to Supabase Auth redirects;
   configure production SMTP and apply migration 005 before enabling OAuth.
3. Test with separate talent and recruiter accounts before making signups public.
4. Once you provide the domain and choose a host, add the production URL to
   Supabase Auth redirects and configure the host's DNS records. No domain
   changes are needed until deployment is selected.

The Auth settings endpoint is reachable with the supplied project URL and
publishable key. The latest read-only REST check returned HTTP 200 for
`profiles`, `talent_profiles`, and `organisations`; anonymous access to
`organisation_members` returned HTTP 401 as intended. Read-only checks also
confirm the tables and public bucket listings added in migrations 003 and 004.
