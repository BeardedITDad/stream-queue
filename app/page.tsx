"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [formData, setFormData] = useState<FormData>({ name: '', url1: '', url2: '', url3: '' });
  const [assignedCode, setAssignedCode] = useState<string | null>(null);
  const [submissionsOpen, setSubmissionsOpen] = useState(true);
  const [isLoadingSubmissionSetting, setIsLoadingSubmissionSetting] = useState(true);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const [adminPassword, setAdminPassword] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
    fetchSubmissionSetting();

    const channel = supabase.channel('public:queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, fetchQueue)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchQueue = async () => {
    const { data } = await supabase
      .from('queue')
      .select('*')
      .eq('status', 'waiting')
      .order('is_priority', { ascending: false })
      .order('created_at', { ascending: true });
    if (data) setQueue(data as QueueItem[]);
  };

  const fetchSubmissionSetting = async () => {
    try {
      const res = await fetch('/api/submissions');
      if (!res.ok) {
        throw new Error('Failed to load submission setting.');
      }

      const data: { submissionsOpen: boolean } = await res.json();
      setSubmissionsOpen(data.submissionsOpen);
    } catch {
      setSubmissionsOpen(true);
    } finally {
      setIsLoadingSubmissionSetting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmissionError(null);

    if (!submissionsOpen) {
      setSubmissionError('Additional reviews are currently not being accepted.');
      return;
    }

    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const payload: { shortId?: string; error?: string } = await res.json();

    if (!res.ok || !payload.shortId) {
      setSubmissionError(payload.error ?? 'Unable to submit your review request right now.');
      if (res.status === 403) {
        setSubmissionsOpen(false);
      }
      return;
    }

    setAssignedCode(payload.shortId);
    setFormData({ name: '', url1: '', url2: '', url3: '' });
  };

  const handleAdminUnlock = () => {
    const pass = prompt('Enter Admin Password:');
    if (pass) setAdminPassword(pass);
  };

  const handleToggleSubmissions = async () => {
    if (!adminPassword) return;

    const nextState = !submissionsOpen;
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword, submissionsOpen: nextState }),
    });

    if (res.status === 401) {
      alert('Wrong password!');
      setAdminPassword(null);
      return;
    }

    if (!res.ok) {
      alert('Unable to update submission status.');
      return;
    }

    setSubmissionsOpen(nextState);
    if (!nextState) {
      setAssignedCode(null);
    } else {
      setSubmissionError(null);
    }
  };

  const handleRemove = async (id: string) => {
    if (!adminPassword) return;

    const res = await fetch('/api/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: adminPassword }),
    });

    if (res.status === 401) {
      alert('Wrong password!');
      setAdminPassword(null);
    } else if (!res.ok) {
      alert('Something went wrong removing the user.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-10 font-sans flex flex-col justify-between">
      <div className="max-w-4xl mx-auto w-full flex flex-col items-center mb-10 text-center">
        <Image
          src="/logo.png"
          alt="Hack Smarter Logo"
          width={250}
          height={60}
          className="mb-4"
        />
        <p className="text-lg text-gray-300">
          While you wait for the review, go hack some labs at{' '}
          <a
            href="https://hacksmarter.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-400 hover:underline transition-colors font-semibold"
          >
            hacksmarter.org
          </a>!
        </p>
      </div>

      <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-fit">
          <h2 className="text-2xl font-bold mb-4">Submit for Review</h2>

          {submissionError && (
            <div className="mb-4 rounded border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-300">
              {submissionError}
            </div>
          )}

          {isLoadingSubmissionSetting ? (
            <p className="text-gray-400 italic">Loading submission availability...</p>
          ) : !submissionsOpen ? (
            <div className="rounded border border-amber-500/70 bg-amber-500/10 p-4 text-amber-200">
              <h3 className="text-lg font-bold text-amber-300">Submissions are currently closed</h3>
              <p className="mt-2 text-sm">Additional reviews are currently not being accepted.</p>
            </div>
          ) : assignedCode ? (
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

        <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-fit">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Live Queue</h2>
            {adminPassword && (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500">Admin Mode Active</span>
                <button
                  onClick={handleToggleSubmissions}
                  className={`text-xs font-bold px-2 py-1 rounded border transition ${submissionsOpen ? 'bg-amber-500/20 text-amber-300 border-amber-500 hover:bg-amber-500/30' : 'bg-green-500/20 text-green-300 border-green-500 hover:bg-green-500/30'}`}
                >
                  {submissionsOpen ? 'Close Submissions' : 'Open Submissions'}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {queue.length === 0 && <p className="text-gray-400 italic">Queue is empty. Be the first!</p>}
            {queue.map((user, index) => (
              <div key={user.id} className={`p-4 rounded border flex justify-between ${user.is_priority ? 'bg-yellow-500/10 border-yellow-500' : 'bg-gray-700 border-gray-600'}`}>
                <div className="w-full">
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

                {adminPassword && (
                  <div className="ml-4 flex items-center border-l border-gray-600 pl-4">
                    <button
                      onClick={() => handleRemove(user.id)}
                      className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-3 rounded transition"
                      title="Remove from queue"
                    >
                      X
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full mt-10 text-center flex flex-col items-center gap-2">
        <p className="text-gray-400 text-sm">
          Created by <a href="https://youtube.com/@TylerRamsbey" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline font-semibold transition">Tyler Ramsbey</a>. Open-source and free to use.
        </p>
        <button onClick={handleAdminUnlock} className="text-gray-800 hover:text-gray-600 text-xs transition mt-4">
          Admin Login
        </button>
      </div>
    </div>
  );
}