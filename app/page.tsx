"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

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

type SubmissionMode = 'review' | 'question';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ASSIGNED_CODE_STORAGE_KEY = 'stream_queue_assigned_code';
const QUESTION_MODE_SENTINEL_URL = '__question_submission__';

export default function Home() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [formData, setFormData] = useState<FormData>({ name: '', url1: '', url2: '', url3: '' });
  const [assignedCode, setAssignedCode] = useState<string | null>(null);
  const [submissionsOpen, setSubmissionsOpen] = useState(true);
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>('review');
  const [isLoadingSubmissionSetting, setIsLoadingSubmissionSetting] = useState(true);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState<string | null>(null);
  const [isAdminControlsOpen, setIsAdminControlsOpen] = useState(true);

  useEffect(() => {
    const savedCode = window.localStorage.getItem(ASSIGNED_CODE_STORAGE_KEY);
    if (savedCode) {
      setAssignedCode(savedCode);
    }

    fetchQueue();
    fetchSubmissionSetting();

    const channel = supabase.channel('public:queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, fetchQueue)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (assignedCode) {
      window.localStorage.setItem(ASSIGNED_CODE_STORAGE_KEY, assignedCode);
      return;
    }

    window.localStorage.removeItem(ASSIGNED_CODE_STORAGE_KEY);
  }, [assignedCode]);

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

      const data: { submissionsOpen: boolean; submissionMode?: SubmissionMode } = await res.json();
      setSubmissionsOpen(data.submissionsOpen);
      setSubmissionMode(data.submissionMode === 'question' ? 'question' : 'review');
    } catch {
      setSubmissionsOpen(true);
      setSubmissionMode('review');
    } finally {
      setIsLoadingSubmissionSetting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmissionError(null);

    if (!submissionsOpen) {
      setSubmissionError('Additional submissions are currently not being accepted.');
      return;
    }

    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const payload: { shortId?: string; error?: string } = await res.json();

    if (!res.ok || !payload.shortId) {
      setSubmissionError(payload.error ?? 'Unable to submit your request right now.');
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
    if (pass) {
      setAdminPassword(pass);
      setIsAdminControlsOpen(true);
    }
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
      try {
        const payload: { error?: string } = await res.json();
        alert(payload.error ?? 'Unable to update submission status.');
      } catch {
        alert('Unable to update submission status.');
      }
      return;
    }

    setSubmissionsOpen(nextState);
    if (!nextState) {
      setAssignedCode(null);
    } else {
      setSubmissionError(null);
    }
  };

  const handleToggleSubmissionMode = async () => {
    if (!adminPassword) return;

    const nextMode: SubmissionMode = submissionMode === 'review' ? 'question' : 'review';
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword, submissionMode: nextMode }),
    });

    if (res.status === 401) {
      alert('Wrong password!');
      setAdminPassword(null);
      return;
    }

    if (!res.ok) {
      try {
        const payload: { error?: string } = await res.json();
        alert(payload.error ?? 'Unable to update submission mode.');
      } catch {
        alert('Unable to update submission mode.');
      }
      return;
    }

    setSubmissionMode(nextMode);
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

  const handleSetPriority = async (id: string) => {
    if (!adminPassword) return;

    const res = await fetch('/api/priority', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: adminPassword }),
    });

    if (res.status === 401) {
      alert('Wrong password!');
      setAdminPassword(null);
      return;
    }

    if (!res.ok) {
      alert('Something went wrong setting priority.');
    }
  };

  const handleClearAll = async () => {
    if (!adminPassword) return;

    const confirmed = window.confirm('Are you sure you want to clear all entries from the queue?');
    if (!confirmed) return;

    const res = await fetch('/api/remove-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword }),
    });

    if (res.status === 401) {
      alert('Wrong password!');
      setAdminPassword(null);
      return;
    }

    if (!res.ok) {
      alert('Something went wrong clearing the queue.');
    }
  };

  return (
    <div className="min-h-screen bg-[#292e3d] text-white p-10 font-sans flex flex-col justify-between">
      <div className="flex flex-col items-center w-full mb-6 z-20 relative">
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

        <div className="text-center mt-0 -mb-2">
          <p className="text-gray-400 text-sm mb-1">Waiting for a review?</p>
          <a
            href="https://itcareeraccelerator.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ff6600] font-bold underline decoration-[#ff6600] underline-offset-4 hover:text-orange-400 transition"
          >
            Check out the full IT Career Accelerator Community &rarr;
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-fit">
          <h2 className="text-2xl font-bold mb-4">Submit</h2>
          <p className="mb-4 text-xs uppercase tracking-wide text-gray-400">
            Current mode: <span className="font-bold text-white">{submissionMode === 'review' ? 'Review Mode' : 'Question Mode'}</span>
          </p>

          {submissionError && (
            <div className="mb-4 rounded border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-300">
              {submissionError}
            </div>
          )}

          {isLoadingSubmissionSetting ? (
            <p className="text-gray-400 italic">Loading submission availability...</p>
          ) : assignedCode ? (
            <div className="bg-green-600/20 border border-green-500 p-4 rounded text-center">
              <h3 className="text-xl font-bold text-green-400">You are in the queue!</h3>
              <p className="mt-2 text-gray-300">
                To jump ahead, donate at{' '}
                <a
                  href="https://ko-fi.com/thebeardeditdad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline decoration-green-300 underline-offset-2 hover:text-white"
                >
                  ko-fi.com/thebeardeditdad
                </a>{' '}
                and include this exact code in your message:
              </p>
              <p className="text-4xl font-black text-white my-4 tracking-widest">{assignedCode}</p>
              <p className="text-xs text-green-200/90">This code is saved on this browser, so you can come back and still donate later.</p>
              <button onClick={() => setAssignedCode(null)} className="text-sm underline text-gray-300 hover:text-white mt-3">Submit another</button>
            </div>
          ) : !submissionsOpen ? (
            <div className="rounded border border-amber-500/70 bg-amber-500/10 p-4 text-amber-200">
              <h3 className="text-lg font-bold text-amber-300">Submissions are currently closed</h3>
              <p className="mt-2 text-sm">Additional submissions are currently not being accepted.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input required placeholder="Your Name / Handle" className="p-2 bg-gray-700 rounded text-white" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              {submissionMode === 'review' ? (
                <>
                  <input required placeholder="URL 1 (LinkedIn, GitHub, etc)" className="p-2 bg-gray-700 rounded text-white" value={formData.url1} onChange={e => setFormData({ ...formData, url1: e.target.value })} />
                  <input placeholder="URL 2 (Optional)" className="p-2 bg-gray-700 rounded text-white" value={formData.url2} onChange={e => setFormData({ ...formData, url2: e.target.value })} />
                  <textarea
                    placeholder="Any specific questions or context? (Optional)"
                    className="p-2 bg-gray-700 rounded text-white h-24 resize-none"
                    value={formData.url3}
                    onChange={e => setFormData({ ...formData, url3: e.target.value })}
                  />
                </>
              ) : (
                <textarea
                  required
                  placeholder="Your question"
                  className="p-2 bg-gray-700 rounded text-white h-24 resize-none"
                  value={formData.url3}
                  onChange={e => setFormData({ ...formData, url3: e.target.value })}
                />
              )}
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 font-bold p-3 rounded transition mt-2">Join Queue</button>
              <p className="text-xs text-gray-500 text-center mt-3 leading-tight">
                By clicking "Join Queue", you agree that your information will be
                <span className="text-gray-400 font-semibold"> displayed publicly</span> and
                reviewed on <span className="text-gray-400 font-semibold">live stream</span>.
              </p>
            </form>
          )}
        </div>

        <div className="flex flex-col gap-3 h-fit">
          {adminPassword && (
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-red-500/30">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-red-300">Admin Controls</p>
                  <p className="text-xs text-gray-400 mt-1">Manage submission mode and queue settings.</p>
                </div>
                <button
                  onClick={() => setIsAdminControlsOpen((prev) => !prev)}
                  className="text-xs font-bold px-3 py-1 rounded border border-gray-500 text-gray-200 hover:bg-gray-700 transition"
                >
                  {isAdminControlsOpen ? 'Hide Controls' : 'Show Controls'}
                </button>
              </div>

              {isAdminControlsOpen && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleToggleSubmissionMode}
                    className={`text-xs font-bold px-3 py-1 rounded border transition ${submissionMode === 'review' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500 hover:bg-indigo-500/30' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500 hover:bg-cyan-500/30'}`}
                  >
                    {submissionMode === 'review' ? 'Switch To Question Mode' : 'Switch To Review Mode'}
                  </button>
                  <button
                    onClick={handleToggleSubmissions}
                    className={`text-xs font-bold px-3 py-1 rounded border transition ${submissionsOpen ? 'bg-amber-500/20 text-amber-300 border-amber-500 hover:bg-amber-500/30' : 'bg-green-500/20 text-green-300 border-green-500 hover:bg-green-500/30'}`}
                  >
                    {submissionsOpen ? 'Close Submissions' : 'Open Submissions'}
                  </button>
                  <button
                    onClick={handleClearAll}
                    disabled={queue.length === 0}
                    className="bg-red-700 hover:bg-red-600 disabled:bg-red-900/40 disabled:text-red-200/40 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-1 rounded border border-red-500 transition"
                    title="Clear all queue entries"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-fit">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Live Queue ({queue.length})</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-gray-700 text-gray-200 px-2 py-1 rounded border border-gray-600">
                Total in list: {queue.length}
              </span>
              {adminPassword && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500">Admin Mode Active</span>}
            </div>
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
                  {user.url1 === QUESTION_MODE_SENTINEL_URL ? (
                    <p className="text-gray-200 text-sm mt-2 border-l-2 border-cyan-400 pl-2 break-words">
                      Q: {user.url3}
                    </p>
                  ) : (
                    <div className="text-sm text-blue-400 mt-2 flex flex-col gap-1 overflow-hidden">
                      <a href={user.url1} target="_blank" rel="noreferrer" className="truncate hover:underline">{user.url1}</a>
                      {user.url2 && <a href={user.url2} target="_blank" rel="noreferrer" className="truncate hover:underline">{user.url2}</a>}
                      {user.url3 && (
                        <p className="text-gray-300 text-xs italic mt-1 border-l-2 border-gray-500 pl-2 break-words">
                          "{user.url3}"
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {adminPassword && (
                  <div className="ml-4 flex items-center border-l border-gray-600 pl-4">
                    <div className="flex flex-col gap-2">
                      {!user.is_priority && (
                        <button
                          onClick={() => handleSetPriority(user.id)}
                          className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-3 rounded transition"
                          title="Manually set this user to priority"
                        >
                          Priority
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(user.id)}
                        className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-3 rounded transition"
                        title="Remove from queue"
                      >
                        X
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
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
