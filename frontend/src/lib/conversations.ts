const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function authHeaders(opts?: { json?: boolean }): Headers {
  const h = new Headers();
  if (opts?.json) h.set('Content-Type', 'application/json');
  const t = localStorage.getItem('jwt');
  if (t) h.set('Authorization', `Bearer ${t}`);
  return h;
}

export async function listConversations() {
  const r = await fetch(`${API_URL}/conversations`, {
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error('Failed to load conversations.');
  return r.json();
}

export async function ensureConversation(exchange_id: number) {
  const r = await fetch(`${API_URL}/conversations/ensure`, {
    method: 'POST',
    headers: authHeaders({ json: true }),
    body: JSON.stringify({ exchange_id }),
  });
  if (!r.ok) throw new Error('Failed to ensure conversation.');
  return r.json() as Promise<{ id: number }>;
}

export async function getMessages(conversation_id: number) {
  const r = await fetch(`${API_URL}/conversations/${conversation_id}/messages`, {
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error('Failed to load messages.');
  return r.json();
}

export async function sendMessage(conversation_id: number, body: string, exchange_id?: number) {
  const r = await fetch(`${API_URL}/conversations/${conversation_id}/messages`, {
    method: 'POST',
    headers: authHeaders({ json: true }),
    body: JSON.stringify({ body, exchange_id }),
  });
  if (!r.ok) throw new Error('Failed to send message.');
  return r.json();
}

export async function unreadCount() {
  const r = await fetch(`${API_URL}/conversations/unread/count`, {
    headers: authHeaders(),
  });
  if (!r.ok) return { count: 0 };
  return r.json();
}
