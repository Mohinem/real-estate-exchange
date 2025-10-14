import React from 'react';
import Layout from '../components/Layout';
import { listThreads, getThread, sendMessage, markRead } from '../lib/messages';

type Thread = {
  exchange_id: number;
  status: string;
  created_at: string;
  counterparty_id: number;
  counterparty_name: string;
  last_at: string | null;
  unread: number;
};

type Msg = {
  id: number;
  exchange_id: number;
  from_user_id: number;
  to_user_id: number;
  body: string;
  is_read: boolean;
  created_at: string;
};

export default function Inbox() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const isAuthed = !!token;

  const [threads, setThreads] = React.useState<Thread[]>([]);
  const [active, setActive] = React.useState<number | null>(null);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [err, setErr] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!isAuthed) return;
    (async () => {
      try {
        setLoading(true);
        const t = await listThreads();
        setThreads(t);
        if (t.length && active == null) setActive(t[0].exchange_id);
      } catch (e:any) {
        setErr(e.message || 'Failed to load inbox.');
      } finally { setLoading(false); }
    })();
  }, [isAuthed]);

  React.useEffect(() => {
    if (!isAuthed || active == null) return;
    (async () => {
      try {
        const m = await getThread(active);
        setMsgs(m);
        await markRead(active);
        // also zero unread in local state
        setThreads(ts => ts.map(th => th.exchange_id === active ? { ...th, unread: 0 } : th));
      } catch (e:any) {
        setErr(e.message || 'Failed to load thread.');
      }
    })();
  }, [active, isAuthed]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || active == null) return;
    setSending(true);
    try {
      const m = await sendMessage(active, input.trim());
      setMsgs(prev => [...prev, m]);
      setInput('');
    } catch (e:any) {
      setErr(e.message || 'Failed to send.');
    } finally { setSending(false); }
  }

  if (!isAuthed) {
    return (
      <Layout>
        <section className="max-w-5xl mx-auto px-6 sm:px-10 py-12">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
            You must be logged in to view your inbox. <a className="ml-2 text-blue-700 underline" href="/login">Login</a>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-8">
        <h1 className="text-2xl font-bold">Inbox</h1>

        {err && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{err}</div>}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          {/* Left: threads */}
          <aside className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="px-4 py-3 border-b text-sm font-medium text-gray-700">Conversations</div>
            <ul className="max-h-[70vh] overflow-auto">
              {loading ? (
                <li className="p-4 text-sm text-gray-500">Loading…</li>
              ) : threads.length === 0 ? (
                <li className="p-4 text-sm text-gray-500">No conversations yet.</li>
              ) : (
                threads.map(t => (
                  <li key={t.exchange_id}>
                    <button
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between ${active===t.exchange_id ? 'bg-gray-50' : ''}`}
                      onClick={() => setActive(t.exchange_id)}
                    >
                      <div>
                        <div className="font-medium text-gray-900">{t.counterparty_name}</div>
                        <div className="text-xs text-gray-500">Swap #{t.exchange_id} · {t.status}</div>
                      </div>
                      {t.unread > 0 && (
                        <span className="ml-3 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-2 text-xs font-semibold text-white">
                          {t.unread}
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </aside>

          {/* Right: messages */}
          <main className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 flex flex-col h-[70vh]">
            <div className="px-4 py-3 border-b text-sm text-gray-600">
              {active ? <>Conversation for swap <span className="font-medium">#{active}</span></> : 'Select a conversation'}
            </div>

            <div className="flex-1 overflow-auto px-4 py-4 space-y-3">
              {active == null ? (
                <div className="text-sm text-gray-500">Choose a thread on the left.</div>
              ) : msgs.length === 0 ? (
                <div className="text-sm text-gray-500">No messages yet. Say hello 👋</div>
              ) : (
                msgs.map(m => (
                  <div key={m.id} className={`max-w-[75%] rounded-xl px-3 py-2 text-sm shadow-sm ring-1
                    ${m.from_user_id === parseInt(localStorage.getItem('user_id') || '-1')
                      ? 'ml-auto bg-blue-600 text-white ring-blue-600/10'
                      : 'bg-white text-gray-900 ring-gray-100'}`}>
                    <div>{m.body}</div>
                    <div className="mt-1 text-[11px] opacity-70">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>

            {/* Composer */}
            <form onSubmit={onSend} className="border-t p-3 flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Write a message…"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                disabled={active == null}
              />
              <button
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${sending ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                disabled={sending || active == null || !input.trim()}
              >
                Send
              </button>
            </form>
          </main>
        </div>
      </section>
    </Layout>
  );
}
