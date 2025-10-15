import React from 'react';
import Layout from '../components/Layout';
import { listConversations, getMessages, sendMessage } from '../lib/conversations';

type Conversation = {
  conversation_id: number;
  a_user_id: number;
  b_user_id: number;
  a_listing_id: number;
  b_listing_id: number;
  counterparty_id: number;
  counterparty_name: string | null;
  last_at: string | null;
  last_body: string | null;
  unread: number;
};

type Msg = {
  id: number;
  conversation_id: number;
  exchange_id: number | null;
  from_user_id: number;
  to_user_id: number;
  body: string;
  is_read: boolean;
  created_at: string;
};

/* ---------- small helpers ---------- */

// decode JWT without validating (client-side convenience)
function decodeJwtPayload(token: string | null): any | null {
  if (!token) return null;
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function humanDayLabel(d: Date) {
  const now = new Date();
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const key = dayKey(d);
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return d.toLocaleDateString();
}

function initialFromName(name?: string | null) {
  if (!name) return '?';
  const t = name.trim();
  if (!t) return '?';
  return t[0]!.toUpperCase();
}

/* ---------- component ---------- */

export default function Inbox() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const payload = decodeJwtPayload(token);
  // prefer explicit stored id, else fallback to JWT
  const me = Number(localStorage.getItem('user_id') || payload?.user_id || -1);
  const isAuthed = !!token;

  const [convs, setConvs] = React.useState<Conversation[]>([]);
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [err, setErr] = React.useState<string | undefined>();

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  // Load conversations
  React.useEffect(() => {
    if (!isAuthed) return;
    (async () => {
      try {
        setLoading(true);
        const t = await listConversations();
        setConvs(t);
        if (t.length && activeId == null) setActiveId(t[0].conversation_id);
      } catch (e: any) {
        setErr(e.message || 'Failed to load conversations.');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthed]);

  // Load messages of active conversation
  React.useEffect(() => {
    if (!isAuthed || activeId == null) return;
    (async () => {
      try {
        const m = await getMessages(activeId);
        setMsgs(m);
        // clear unread locally
        setConvs((cs) =>
          cs.map((c) => (c.conversation_id === activeId ? { ...c, unread: 0 } : c))
        );
      } catch (e: any) {
        setErr(e.message || 'Failed to load messages.');
      }
    })();
  }, [activeId, isAuthed]);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgs.length]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || activeId == null) return;
    setSending(true);
    try {
      const m = await sendMessage(activeId, input.trim());
      setMsgs((prev) => [...prev, m]);
      setInput('');
      setConvs((cs) =>
        cs.map((c) =>
          c.conversation_id === activeId ? { ...c, last_at: m.created_at, last_body: m.body } : c
        )
      );
    } catch (e: any) {
      setErr(e.message || 'Failed to send.');
    } finally {
      setSending(false);
    }
  }

  if (!isAuthed) {
    return (
      <Layout>
        <section className="max-w-5xl mx-auto px-6 sm:px-10 py-12">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
            You must be logged in to view your inbox.{' '}
            <a className="ml-2 text-blue-700 underline" href="/login">
              Login
            </a>
          </div>
        </section>
      </Layout>
    );
  }

  const active = convs.find((c) => c.conversation_id === activeId) || null;
  const otherName = active?.counterparty_name || (active ? `User ${active.counterparty_id}` : '');

  /* ----- build grouped view with day separators + sender groups ----- */
  type Row =
    | { kind: 'day'; id: string; label: string }
    | {
        kind: 'msg';
        msg: Msg;
        isMine: boolean;
        showAvatar: boolean;
        showLabel: boolean;
      };

  const rows: Row[] = [];
  let prevDay = '';
  let prevSender: number | null = null;

  msgs.forEach((m) => {
    const dt = new Date(m.created_at);
    const dk = dayKey(dt);
    const isMine = m.from_user_id === me;

    if (dk !== prevDay) {
      rows.push({ kind: 'day', id: dk, label: humanDayLabel(dt) });
      prevDay = dk;
      prevSender = null; // reset grouping on new day
    }

    const showLabel = prevSender !== m.from_user_id; // first in a sender group
    const showAvatar = showLabel && !isMine; // avatar only for the other side (cleaner)

    rows.push({ kind: 'msg', msg: m, isMine, showAvatar, showLabel });
    prevSender = m.from_user_id;
  });

  return (
    <Layout>
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-8">
        <h1 className="text-2xl font-bold">Inbox</h1>

        {err && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
            {err}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          {/* Left: conversations */}
          <aside className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="px-4 py-3 border-b text-sm font-medium text-gray-700">Conversations</div>
            <ul className="max-h-[70vh] overflow-auto">
              {loading ? (
                <li className="p-4 text-sm text-gray-500">Loading…</li>
              ) : convs.length === 0 ? (
                <li className="p-4 text-sm text-gray-500">No conversations yet.</li>
              ) : (
                convs.map((c) => (
                  <li key={c.conversation_id}>
                    <button
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between ${
                        activeId === c.conversation_id ? 'bg-gray-50' : ''
                      }`}
                      onClick={() => setActiveId(c.conversation_id)}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {c.counterparty_name || `User ${c.counterparty_id}`}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {c.last_body ? c.last_body : 'No messages yet'}
                        </div>
                      </div>
                      {c.unread > 0 && (
                        <span className="ml-3 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-2 text-xs font-semibold text-white">
                          {c.unread}
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
              {active ? (
                <>
                  Conversation with{' '}
                  <span className="font-medium">
                    {active.counterparty_name || `User ${active.counterparty_id}`}
                  </span>
                </>
              ) : (
                'Select a conversation'
              )}
            </div>

            {/* Messages list with groups, avatars, day separators */}
            <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-4 space-y-2">
              {activeId == null ? (
                <div className="text-sm text-gray-500">Choose a conversation on the left.</div>
              ) : msgs.length === 0 ? (
                <div className="text-sm text-gray-500">No messages yet. Say hello 👋</div>
              ) : (
                rows.map((row, i) => {
                  if (row.kind === 'day') {
                    return (
                      <div key={`day-${row.id}`} className="my-3 flex items-center gap-3">
                        <div className="h-px flex-1 bg-gray-200" />
                        <div className="text-[11px] text-gray-500">{row.label}</div>
                        <div className="h-px flex-1 bg-gray-200" />
                      </div>
                    );
                  }

                  const { msg, isMine, showAvatar, showLabel } = row;

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${isMine ? 'justify-end' : 'justify-start'} items-end`}
                    >
                      {/* Left avatar (only for the other side and only at group start) */}
                      {!isMine && showAvatar && (
                        <div
                          className="h-8 w-8 shrink-0 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-semibold select-none"
                          title={otherName}
                        >
                          {initialFromName(otherName)}
                        </div>
                      )}
                      {/* spacer to align when avatar not shown */}
                      {!isMine && !showAvatar && <div className="w-8" />}

                      <div className={`max-w-[72%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                        {/* Sender label at group start */}
                        {showLabel && (
                          <div className="mb-1 text-[11px] text-gray-500">
                            {isMine ? 'You' : otherName}
                          </div>
                        )}
                        {/* Bubble */}
                        <div
                          className={[
                            'px-4 py-2 text-sm break-words shadow-sm transition-all',
                            isMine
                              ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none'
                              : 'bg-gray-100 text-gray-900 rounded-2xl rounded-tl-none',
                          ].join(' ')}
                        >
                          <div>{msg.body}</div>
                          <div
                            className={`mt-1 text-[11px] opacity-70 text-right ${
                              isMine ? 'text-white/80' : 'text-gray-600'
                            }`}
                          >
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Composer */}
            <form onSubmit={onSend} className="border-t p-3 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Write a message…"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                disabled={activeId == null}
              />
              <button
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
                  sending ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                }`}
                disabled={sending || activeId == null || !input.trim()}
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
