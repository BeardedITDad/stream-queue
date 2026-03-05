import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TOGGLE_SHORT_ID = '__submissions_toggle__';
const TOGGLE_STATUS = '__config__';

interface ToggleRow {
  id: string;
  is_priority: boolean | null;
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

    const existingToggles = await getToggleRows();

    // If already set to the requested value, avoid unnecessary database writes.
    if (existingToggles.length > 0 && (existingToggles[0].is_priority ?? true) === submissionsOpen) {
      return Response.json({ submissionsOpen, alreadyApplied: true }, { status: 200 });
    }

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

    return Response.json({ submissionsOpen }, { status: 200 });
  } catch (error) {
    console.error('Update submissions setting error:', error);
    return Response.json({ error: 'Unable to update submission setting.' }, { status: 500 });
  }
}