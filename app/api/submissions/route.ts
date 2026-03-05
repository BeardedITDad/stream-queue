import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SUBMISSIONS_SETTING_KEY = 'submissions_open';

function isSettingsTableMissing(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === 'PGRST205' ||
    maybeError.code === '42P01' ||
    maybeError.message?.toLowerCase().includes('app_settings') === true
  );
}

function isPermissionDenied(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === '42501' ||
    maybeError.message?.toLowerCase().includes('permission denied') === true
  );
}

async function getSubmissionsOpen() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value_boolean')
    .eq('key', SUBMISSIONS_SETTING_KEY)
    .maybeSingle();

  if (error) {
    if (isSettingsTableMissing(error)) {
      // Backward compatibility for installs that have not added app_settings yet.
      return true;
    }
    throw error;
  }

  if (!data) {
    return true;
  }

  return data.value_boolean ?? true;
}

export async function GET() {
  try {
    const submissionsOpen = await getSubmissionsOpen();
    return Response.json({ submissionsOpen }, { status: 200 });
  } catch (error) {
    console.error('Get submissions setting error:', error);
    return Response.json({ error: 'Unable to load submission setting.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { password, submissionsOpen } = await req.json();

    if (password !== process.env.ADMIN_PASSWORD) {
      return new Response('Unauthorized: Wrong Password', { status: 401 });
    }

    if (typeof submissionsOpen !== 'boolean') {
      return Response.json({ error: 'submissionsOpen must be a boolean.' }, { status: 400 });
    }

    const { error } = await supabase.from('app_settings').upsert(
      {
        key: SUBMISSIONS_SETTING_KEY,
        value_boolean: submissionsOpen,
      },
      { onConflict: 'key' }
    );

    if (error) {
      if (isSettingsTableMissing(error)) {
        return Response.json(
          {
            error: 'Submission toggle requires the app_settings table. Run the README SQL setup for app_settings first.',
          },
          { status: 500 }
        );
      }

      if (isPermissionDenied(error)) {
        return Response.json(
          {
            error: 'Unable to update app_settings due database permissions. Disable RLS on app_settings or add insert/update policies.',
          },
          { status: 500 }
        );
      }

      throw error;
    }

    return Response.json({ submissionsOpen }, { status: 200 });
  } catch (error) {
    console.error('Update submissions setting error:', error);
    return Response.json({ error: 'Unable to update submission setting.' }, { status: 500 });
  }
}