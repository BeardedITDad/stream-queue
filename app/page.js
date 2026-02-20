"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [queue, setQueue] = useState([]);
  const [formData, setFormData] = useState({ name: '', url1: '', url2: '', url3: '' });
  const [assignedCode, setAssignedCode] = useState(null);

  // Fetch queue and subscribe to real-time changes
  useEffect(() => {
    fetchQueue();
    const channel = supabase.channel('public:queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, fetchQueue)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const fetchQueue = async () => {
    const { data } = await supabase
      .from('queue')
      .select('*')
      .eq('status', 'waiting')
      .order('is_priority', { ascending: false })
      .order('created_at', { ascending: true });
    if (data) setQueue(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const shortId = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code
    
    await supabase.from('queue').insert([{ 
      name: formData.name, 
      url1: formData.url1, 
      url2: formData.url2, 
      url3: formData.url3, 
      short_id: shortId 
    }]);

    setAssignedCode(shortId);
    setFormData({ name: '', url1: '', url2: '', url3: '' });
  };

  return (
    <div className="min-h-screen bg-[#292e3d] text-white p-10 font-sans">
    {/* --- LOGO & LINK SECTION START --- */}
<div className="flex flex-col items-center w-full mb-6 z-20 relative">
  
  {/* Clickable Logo */}
  <a 
    href="https://itcareeraccelerator.com/" 
    target="_blank" 
    rel="noopener noreferrer"
    className="hover:scale-105 transition-transform duration-200"
  >
    <img 
      src="/IT CAREER (1024 x 500 px).png" 
      alt="IT Career Accelerator" 
      className="h-40 w-auto object-contain" 
    />
  </a>

  {/* Subtitle Text Link */}
  <div className="text-center mt-0 -mb-2">
    <p className="text-gray-400 text-sm mb-1">Waiting for a review?</p>
    <a 
      href="https://itcareeraccelerator.com/" 
      target="_blank"
      className="text-[#ff6600] font-bold underline decoration-[#ff6600] underline-offset-4 hover:text-orange-400 transition"
    >
      Check out the full IT Career Accelerator Community &rarr;
    </a>
  </div>

</div>
{/* --- LOGO & LINK SECTION END --- */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
        
        {/* Submission Form */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Submit for Review</h2>
          {assignedCode ? (
            <div className="bg-green-600/20 border border-green-500 p-4 rounded text-center">
              <h3 className="text-xl font-bold text-green-400">You're in the queue!</h3>
              <p className="mt-2">To jump ahead, donate at <strong>https://ko-fi.com/thebeardeditdad</strong> and include this exact code in your message:</p>
              <p className="text-4xl font-black text-white my-3">{assignedCode}</p>
              <button onClick={() => setAssignedCode(null)} className="text-sm underline text-gray-400 hover:text-white mt-2">Submit another</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input required placeholder="Your Name / Handle" className="p-2 bg-gray-700 rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <input required placeholder="URL 1 (LinkedIn, GitHub, etc)" className="p-2 bg-gray-700 rounded" value={formData.url1} onChange={e => setFormData({...formData, url1: e.target.value})} />
              <input placeholder="URL 2 (Optional)" className="p-2 bg-gray-700 rounded" value={formData.url2} onChange={e => setFormData({...formData, url2: e.target.value})} />
              <input placeholder="URL 2 (Optional)" className="p-2 bg-gray-700 rounded text-white" value={formData.url2} onChange={e => setFormData({...formData, url2: e.target.value})} />
              {/* Changed URL 3 to a Question box */}
              <textarea 
                placeholder="Any specific questions or context?" 
                className="p-2 bg-gray-700 rounded text-white h-24 resize-none" 
                value={formData.url3} 
                onChange={e => setFormData({...formData, url3: e.target.value})} 
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 font-bold p-3 rounded transition mt-2">Join Queue</button>
              {/* Disclaimer Text */}
              <p className="text-xs text-gray-500 text-center mt-3 leading-tight">
                By clicking "Join Queue", you agree that your information will be 
                <span className="text-gray-400 font-semibold"> displayed publicly</span> and 
                reviewed on <span className="text-gray-400 font-semibold">live stream</span>.
              </p>
            </form>
          )}
        </div>

        {/* The Live Queue */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Live Queue</h2>
          <div className="flex flex-col gap-3">
            {queue.length === 0 && <p className="text-gray-400">Queue is empty. Be the first!</p>}
            {queue.map((user, index) => (
              <div key={user.id} className={`p-4 rounded border ${user.is_priority ? 'bg-yellow-500/10 border-yellow-500' : 'bg-gray-700 border-gray-600'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">#{index + 1} - {user.name}</span>
                  {user.is_priority && <span className="text-xs bg-yellow-500 text-black px-2 py-1 font-black rounded uppercase tracking-wider">Priority</span>}
                </div>
                <div className="text-sm text-blue-400 mt-2 flex flex-col gap-1 overflow-hidden">
  
                  {/* URL 1 */}
                  <a href={user.url1} target="_blank" rel="noreferrer" className="truncate hover:underline">{user.url1}</a>
  
                  {/* URL 2 */}
                  {user.url2 && <a href={user.url2} target="_blank" rel="noreferrer" className="truncate hover:underline">{user.url2}</a>}
  
                  {/* URL 3 (Question/Context - NO LINK TAG HERE) */}
                  {user.url3 && (
                    <p className="text-gray-300 text-xs italic mt-1 border-l-2 border-gray-500 pl-2 break-words">
                      "{user.url3}"
                    </p>
                   )}

                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
