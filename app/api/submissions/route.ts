import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SUBMISSIONS_SETTING_KEY = 'submissions_open';

async function getSubmissionsOpen() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value_boolean')
    .eq('key', SUBMISSIONS_SETTING_KEY)
    .maybeSingle();

  if (error) {
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
      throw error;
    }

    return Response.json({ submissionsOpen }, { status: 200 });
  } catch (error) {
    console.error('Update submissions setting error:', error);
    return Response.json({ error: 'Unable to update submission setting.' }, { status: 500 });
  }
}