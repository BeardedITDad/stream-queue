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

export async function POST(req: Request) {
  try {
    const submissionsOpen = await getSubmissionsOpen();
    if (!submissionsOpen) {
      return Response.json(
        { error: 'Additional reviews are currently not being accepted.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = (body.name ?? '').toString().trim();
    const url1 = (body.url1 ?? '').toString().trim();
    const url2 = (body.url2 ?? '').toString().trim();
    const url3 = (body.url3 ?? '').toString().trim();

    if (!name || !url1) {
      return Response.json({ error: 'Name and URL 1 are required.' }, { status: 400 });
    }

    const shortId = Math.floor(1000 + Math.random() * 9000).toString();
    const { error } = await supabase.from('queue').insert([
      {
        name,
        url1,
        url2,
        url3,
        short_id: shortId,
      },
    ]);

    if (error) {
      throw error;
    }

    return Response.json({ shortId }, { status: 200 });
  } catch (error) {
    console.error('Submit Error:', error);
    return Response.json({ error: 'Unable to submit review request.' }, { status: 500 });
  }
}