import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TOGGLE_SHORT_ID = '__submissions_toggle__';
const TOGGLE_STATUS = '__config__';
const MODE_SHORT_ID = '__submission_mode__';
const QUESTION_MODE_SENTINEL_URL = '__question_submission__';

type SubmissionMode = 'review' | 'question';

interface ToggleRow {
  is_priority: boolean | null;
}

interface ExistingQueueEntry {
  name: string | null;
  url1: string | null;
  url2: string | null;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${normalizedPath}${parsed.search}`;
  } catch {
    // Keep a fallback for non-standard URL inputs so duplicate checks still work.
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

async function findDuplicateReason(
  name: string,
  url1: string,
  url2: string,
  submissionMode: SubmissionMode
): Promise<string | null> {
  const { data, error } = await supabase
    .from('queue')
    .select('name, url1, url2')
    .eq('status', 'waiting');

  if (error) {
    throw error;
  }

  const queueEntries = (data as ExistingQueueEntry[] | null) ?? [];
  const normalizedName = normalizeName(name);
  const normalizedIncomingUrls = submissionMode === 'review'
    ? [normalizeUrl(url1), normalizeUrl(url2)].filter(Boolean)
    : [];

  for (const entry of queueEntries) {
    if (normalizeName(entry.name ?? '') === normalizedName) {
      return 'A submission with this name is already in the queue.';
    }

    if (submissionMode !== 'review') {
      continue;
    }

    const normalizedExistingUrls = [normalizeUrl(entry.url1 ?? ''), normalizeUrl(entry.url2 ?? '')].filter(Boolean);
    const hasDuplicateUrl = normalizedIncomingUrls.some((incomingUrl) => normalizedExistingUrls.includes(incomingUrl));

    if (hasDuplicateUrl) {
      return 'A submission with one of these URLs is already in the queue.';
    }
  }

  return null;
}

async function getSubmissionsOpen() {
  const { data, error } = await supabase
    .from('queue')
    .select('is_priority')
    .eq('short_id', TOGGLE_SHORT_ID)
    .eq('status', TOGGLE_STATUS)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    throw error;
  }

  const row = (data?.[0] as ToggleRow | undefined) ?? null;
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

export async function POST(req: Request) {
  try {
    const submissionsOpen = await getSubmissionsOpen();
    const submissionMode = await getSubmissionMode();

    if (!submissionsOpen) {
      return Response.json(
        { error: 'Additional submissions are currently not being accepted.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = (body.name ?? '').toString().trim();
    const url1 = (body.url1 ?? '').toString().trim();
    const url2 = (body.url2 ?? '').toString().trim();
    const url3 = (body.url3 ?? '').toString().trim();

    if (submissionMode === 'review' && (!name || !url1)) {
      return Response.json({ error: 'Name and URL 1 are required in review mode.' }, { status: 400 });
    }

    if (submissionMode === 'question' && (!name || !url3)) {
      return Response.json({ error: 'Name and question are required in question mode.' }, { status: 400 });
    }

    const duplicateReason = await findDuplicateReason(name, url1, url2, submissionMode);
    if (duplicateReason) {
      return Response.json({ error: duplicateReason }, { status: 409 });
    }

    const shortId = Math.floor(1000 + Math.random() * 9000).toString();
    const queuePayload = submissionMode === 'question'
      ? {
          name,
          url1: QUESTION_MODE_SENTINEL_URL,
          url2: '',
          url3,
          short_id: shortId,
        }
      : {
          name,
          url1,
          url2,
          url3,
          short_id: shortId,
        };

    const { error } = await supabase.from('queue').insert([
      queuePayload,
    ]);

    if (error) {
      throw error;
    }

    return Response.json({ shortId }, { status: 200 });
  } catch (error) {
    console.error('Submit Error:', error);
    return Response.json({ error: 'Unable to submit request.' }, { status: 500 });
  }
}