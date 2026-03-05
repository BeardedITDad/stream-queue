import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TOGGLE_SHORT_ID = '__submissions_toggle__';
const TOGGLE_STATUS = '__config__';
const MODE_SHORT_ID = '__submission_mode__';

type SubmissionMode = 'review' | 'question';

interface ToggleRow {
  id: string;
  is_priority: boolean | null;
}

interface ModeRow {
  id: string;
  url1: string | null;
}

async function getToggleRows() {
  const { data, error } = await supabase
    .from('queue')
    .select('id, is_priority')
    .eq('short_id', TOGGLE_SHORT_ID)
    .eq('status', TOGGLE_STATUS)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    throw error;
  }

  return (data as ToggleRow[] | null) ?? [];
}

async function getToggleRow() {
  const rows = await getToggleRows();
  return rows[0] ?? null;
}

async function getSubmissionsOpen() {
  const row = await getToggleRow();
  if (!row) {
    return true;
  }

  return row.is_priority ?? true;
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

  const mode = (data?.[0]?.url1 ?? '').toString();
  return mode === 'question' ? 'question' : 'review';
}

export async function GET() {
  try {
    const submissionsOpen = await getSubmissionsOpen();
    const submissionMode = await getSubmissionMode();
    return Response.json({ submissionsOpen, submissionMode }, { status: 200 });
  } catch (error) {
    console.error('Get submissions setting error:', error);
    return Response.json({ error: 'Unable to load submission setting.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { password, submissionsOpen, submissionMode } = await req.json();

    if (password !== process.env.ADMIN_PASSWORD) {
      return new Response('Unauthorized: Wrong Password', { status: 401 });
    }

    const hasSubmissionsOpen = typeof submissionsOpen === 'boolean';
    const hasSubmissionMode = submissionMode === 'review' || submissionMode === 'question';

    if (!hasSubmissionsOpen && !hasSubmissionMode) {
      return Response.json(
        { error: 'Provide submissionsOpen (boolean) and/or submissionMode (review | question).' },
        { status: 400 }
      );
    }

    if (hasSubmissionsOpen) {
      const existingToggles = await getToggleRows();

      // If already set to the requested value, avoid unnecessary database writes.
      if (!(existingToggles.length > 0 && (existingToggles[0].is_priority ?? true) === submissionsOpen)) {
        const { error } = existingToggles.length > 0
          ? await supabase
              .from('queue')
              .update({ is_priority: submissionsOpen })
              .in('id', existingToggles.map((row) => row.id))
          : await supabase.from('queue').insert([
              {
                short_id: TOGGLE_SHORT_ID,
                name: 'SYSTEM_SUBMISSIONS_TOGGLE',
                url1: 'https://stream-queue.local/config',
                is_priority: submissionsOpen,
                status: TOGGLE_STATUS,
              },
            ]);

        if (error) {
          throw error;
        }
      }
    }

    if (hasSubmissionMode) {
      const { data: modeRows, error: modeRowsError } = await supabase
        .from('queue')
        .select('id, url1')
        .eq('short_id', MODE_SHORT_ID)
        .eq('status', TOGGLE_STATUS)
        .order('created_at', { ascending: true })
        .limit(50);

      if (modeRowsError) {
        throw modeRowsError;
      }

      const typedModeRows = (modeRows as ModeRow[] | null) ?? [];
      const currentMode = (typedModeRows[0]?.url1 ?? 'review').toString();
      if (currentMode !== submissionMode) {
        const { error: modeUpdateError } = typedModeRows.length > 0
          ? await supabase
              .from('queue')
              .update({ url1: submissionMode })
              .in('id', typedModeRows.map((row) => row.id))
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
    }

    const nextSubmissionsOpen = hasSubmissionsOpen ? submissionsOpen : await getSubmissionsOpen();
    const nextSubmissionMode = hasSubmissionMode ? submissionMode : await getSubmissionMode();

    return Response.json({ submissionsOpen: nextSubmissionsOpen, submissionMode: nextSubmissionMode }, { status: 200 });
  } catch (error) {
    console.error('Update submissions setting error:', error);
    return Response.json({ error: 'Unable to update submission setting.' }, { status: 500 });
  }
}