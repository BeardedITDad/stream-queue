import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    // Ko-fi sends data as form-urlencoded with a 'data' field containing JSON
    const text = await req.text();
    const params = new URLSearchParams(text);
    const dataString = params.get('data');
    
    if (!dataString) return new Response('No data found', { status: 400 });
    
    const payload = JSON.parse(dataString);
    const message = payload.message || '';

    // Fetch everyone currently waiting in the queue
    const { data: waitingUsers } = await supabase
      .from('queue')
      .select('id, short_id')
      .eq('status', 'waiting');

    // Check if the Ko-fi message contains any of the active 4-digit codes
    const match = waitingUsers?.find(user => message.includes(user.short_id));

    if (match) {
      // Upgrade them to priority!
      await supabase
        .from('queue')
        .update({ is_priority: true })
        .eq('id', match.id);
    }

    return new Response('Webhook processed', { status: 200 });
  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response('Error processing webhook', { status: 500 });
  }
}