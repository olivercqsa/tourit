import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://tourit-mauve.vercel.app',
  'https://cooperqsa.com',
  'https://www.cooperqsa.com',
]);

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  const corsHeaders: Record<string, string> = origin && allowedOrigins.has(origin)
    ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tourit-cron-secret',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    }
    : {};
  const respond = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: corsHeaders });

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return respond({ error: 'Server configuration is incomplete' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: { action?: string; job_id?: string };
  try {
    body = await request.json();
  } catch {
    return respond({ error: 'Invalid request body' }, 400);
  }

  if (body.action === 'force-delete-job') {
    const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer || !body.job_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.job_id)) {
      return respond({ error: 'A signed-in user and valid job are required' }, 401);
    }

    const { data: { user }, error: authError } = await admin.auth.getUser(bearer);
    if (authError || !user) return respond({ error: 'Sign in to delete this job' }, 401);

    const { data: job, error: jobError } = await admin
      .from('jobs')
      .select('id,organisation_id,cover_path,deleted_at')
      .eq('id', body.job_id)
      .not('deleted_at', 'is', null)
      .maybeSingle();
    if (jobError) return respond({ error: 'Could not load this job' }, 500);
    if (!job) return respond({ error: 'This deleted job no longer exists' }, 404);

    const { data: membership, error: membershipError } = await admin
      .from('organisation_members')
      .select('user_id')
      .eq('organisation_id', job.organisation_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (membershipError) return respond({ error: 'Could not verify job ownership' }, 500);
    if (!membership) return respond({ error: 'You are not allowed to permanently delete this job' }, 403);

    if (job.cover_path) {
      const { error: storageError } = await admin.storage.from('tourit-job-covers').remove([job.cover_path]);
      if (storageError) {
        console.error('Could not remove job cover image', storageError);
        return respond({ error: 'Could not remove the job cover image; the job was not deleted' }, 500);
      }
    }

    const { error: deleteError } = await admin.from('jobs').delete().eq('id', job.id).not('deleted_at', 'is', null);
    if (deleteError) {
      console.error('Could not permanently delete job', deleteError);
      return respond({ error: 'Could not permanently delete this job' }, 500);
    }
    return respond({ deleted: true });
  }

  const expectedSecret = Deno.env.get('TOURIT_PURGE_SECRET');
  if (!expectedSecret || request.headers.get('x-tourit-cron-secret') !== expectedSecret) {
    return respond({ error: 'Unauthorized' }, 401);
  }

  const expiry = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: expiredJobs, error: selectError } = await admin
    .from('jobs')
    .select('id,cover_path')
    .not('deleted_at', 'is', null)
    .lte('deleted_at', expiry)
    .order('deleted_at', { ascending: true })
    .limit(100);

  if (selectError) {
    console.error('Could not load expired jobs', selectError);
    return respond({ error: 'Could not load expired jobs' }, 500);
  }
  if (!expiredJobs?.length) return respond({ deleted: 0 });

  const coverPaths = expiredJobs.map((job) => job.cover_path).filter((path): path is string => Boolean(path));
  if (coverPaths.length) {
    const { error: storageError } = await admin.storage.from('tourit-job-covers').remove(coverPaths);
    if (storageError) {
      console.error('Could not remove expired job cover images', storageError);
      return respond({ error: 'Could not remove expired job cover images' }, 500);
    }
  }

  const ids = expiredJobs.map((job) => job.id);
  const { error: deleteError } = await admin
    .from('jobs')
    .delete()
    .in('id', ids)
    .not('deleted_at', 'is', null)
    .lte('deleted_at', expiry);

  if (deleteError) {
    console.error('Could not permanently delete expired jobs', deleteError);
    return respond({ error: 'Could not permanently delete expired jobs' }, 500);
  }

  // Foreign keys cascade this deletion to applications, application history,
  // and saved-job rows. Tournament showcase data is static demo content today.
  return respond({ deleted: ids.length });
});
