"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Define our TypeScript interfaces so Next.js knows what our data looks like
interface QueueItem {
  id: string;
  name: string;
  url1: string;
  url2?: string;
  url3?: string;
  is_priority: boolean;
  short_id: string;
}

interface FormData {
  name: string;
  url1: string;
  url2: string;
  url3: string;
}

// Initialize Supabase (The '!' tells TypeScript we promise these environment variables exist)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [formData, setFormData] = useState<FormData>({ name: '', url1: '', url2: '', url3: '' });
  const [assignedCode, setAssignedCode] = useState<string | null>(null);

  // Fetch queue on load and subscribe to real-time database changes
  useEffect(() => {
    fetchQueue();
    
    const channel = supabase.channel('public:queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, () => {
        fetchQueue();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from('queue')
      .select('*')
      .eq('status', 'waiting')
      .order('is_priority', { ascending: false })
      .order('created_at', { ascending: true });
      
    if (data) setQueue(data as QueueItem[]);
    if (error) console.error("Error fetching queue:", error);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const shortId = Math.floor(1000 + Math.random() * 9000).toString(); // Generate 4-digit code
    
    const { error } = await supabase.from('queue').insert([{ 
      name: formData.name, 
      url1: formData.url1, 
      url2: formData.url2, 
      url3: formData.url3, 
      short_id: shortId 
    }]);

    if (!error) {
      setAssignedCode(shortId);
      setFormData({ name: '', url1: '', url2: '', url3: '' });
    } else {
      console.error("Error submitting to queue:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-10 font-sans">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
        
        {/* Submission Form */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Submit for Review</h2>
          {assignedCode ? (
            <div className="bg-green-600/20 border border-green-500 p-4 rounded text-center">
              <h3 className="text-xl font-bold text-green-400">You are in the queue!</h3>
              <p className="mt-2 text-gray-300">To jump ahead, donate at <strong>ko-fi.com/tylerramsbey</strong> and include this exact code in your message:</p>
              <p className="text-4xl font-black text-white my-4 tracking-widest">{assignedCode}</p>
              <button onClick={() => setAssignedCode(null)} className="text-sm underline text-gray-400 hover:text-white mt-2">Submit another</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input required placeholder="Your Name / Handle" className="p-2 bg-gray-700 rounded text-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <input required placeholder="URL 1 (LinkedIn, GitHub, etc)" className="p-2 bg-gray-700 rounded text-white" value={formData.url1} onChange={e => setFormData({...formData, url1: e.target.value})} />
              <input placeholder="URL 2 (Optional)" className="p-2 bg-gray-700 rounded text-white" value={formData.url2} onChange={e => setFormData({...formData, url2: e.target.value})} />
              <input placeholder="URL 3 (Optional)" className="p-2 bg-gray-700 rounded text-white" value={formData.url3} onChange={e => setFormData({...formData, url3: e.target.value})} />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 font-bold p-3 rounded transition mt-2">Join Queue</button>
            </form>
          )}
        </div>

        {/* The Live Queue */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Live Queue</h2>
          <div className="flex flex-col gap-3">
            {queue.length === 0 && <p className="text-gray-400 italic">Queue is empty. Be the first!</p>}
            {queue.map((user, index) => (
              <div key={user.id} className={`p-4 rounded border ${user.is_priority ? 'bg-yellow-500/10 border-yellow-500' : 'bg-gray-700 border-gray-600'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">#{index + 1} - {user.name}</span>
                  {user.is_priority && <span className="text-xs bg-yellow-500 text-black px-2 py-1 font-black rounded uppercase tracking-wider">Priority</span>}
                </div>
                <div className="text-sm text-blue-400 mt-2 flex flex-col gap-1 overflow-hidden">
                  <a href={user.url1} target="_blank" rel="noreferrer" className="truncate hover:underline">{user.url1}</a>
                  {user.url2 && <a href={user.url2} target="_blank" rel="noreferrer" className="truncate hover:underline">{user.url2}</a>}
                  {user.url3 && <a href={user.url3} target="_blank" rel="noreferrer" className="truncate hover:underline">{user.url3}</a>}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}