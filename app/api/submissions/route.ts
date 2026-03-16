import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MODE_SHORT_ID = '__submission_mode__';
const TOGGLE_STATUS = '__config__';

type SubmissionMode = 'review' | 'question';

interface ModeRow {
  id: string;
  url1: string | null;
}

async function getSubmissionMode(): Promise<SubmissionMode> {
  const { data, error } = await supabase
    .from('queue')
    .select('url1')
    .eq('short_id', MODE_SHORT_ID)
    .eq('status', TOGGLE_STATUS)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.[0]?.url1 ?? '').toString() === 'question' ? 'question' : 'review';
}

export async function GET() {
  try {
    const submissionMode = await getSubmissionMode();
    return Response.json({ submissionMode }, { status: 200 });
  } catch (error) {
    console.error('Get submissions setting error:', error);
    return Response.json({ error: 'Unable to load submission setting.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { password, submissionMode } = await req.json();

    if (password !== process.env.ADMIN_PASSWORD) {
      return new Response('Unauthorized: Wrong Password', { status: 401 });
    }

    if (submissionMode !== 'review' && submissionMode !== 'question') {
      return Response.json({ error: 'Provide submissionMode (review | question).' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('queue')
      .select('id, url1')
      .eq('short_id', MODE_SHORT_ID)
      .eq('status', TOGGLE_STATUS)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      throw error;
    }

    const modeRows = (data as ModeRow[] | null) ?? [];
    const currentMode = (modeRows[0]?.url1 ?? 'review').toString();
    if (currentMode !== submissionMode) {
      const { error: modeUpdateError } = modeRows.length > 0
        ? await supabase
            .from('queue')
            .update({ url1: submissionMode })
            .in('id', modeRows.map((row) => row.id))
        : await supabase.from('queue').insert([
            {
              short_id: MODE_SHORT_ID,
              name: 'SYSTEM_SUBMISSION_MODE',
              url1: submissionMode,
              status: TOGGLE_STATUS,
            },
          ]);

      if (modeUpdateError) {
        throw modeUpdateError;
      }
    }

    return Response.json({ submissionMode }, { status: 200 });
  } catch (error) {
    console.error('Update submissions setting error:', error);
    return Response.json({ error: 'Unable to update submission setting.' }, { status: 500 });
  }
}
