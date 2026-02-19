import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { id, password } = await req.json();

    // Check if the password matches your Vercel environment variable
    if (password !== process.env.ADMIN_PASSWORD) {
      return new Response('Unauthorized: Wrong Password', { status: 401 });
    }

    // If password is correct, delete the user from the queue
    const { error } = await supabase
      .from('queue')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return new Response('Successfully removed', { status: 200 });
  } catch (error) {
    console.error('Delete Error:', error);
    return new Response('Error processing request', { status: 500 });
  }
}