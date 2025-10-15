const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const auth = () => {
  const t = localStorage.getItem('jwt');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export async function listConversations() {
  const r = await fetch(`${API_URL}/conversations`, { headers: { ...auth() } });
  if (!r.ok) throw new Error('Failed to load conversations.');
  return r.json();
}

export async function ensureConversation(exchange_id: number) {
  const r = await fetch(`${API_URL}/conversations/ensure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ exchange_id }),
  });
  if (!r.ok) throw new Error('Failed to ensure conversation.');
  return r.json() as Promise<{ id: number }>;
}

export async function getMessages(conversation_id: number) {
  const r = await fetch(`${API_URL}/conversations/${conversation_id}/messages`, {
    headers: { ...auth() },
  });
  if (!r.ok) throw new Error('Failed to load messages.');
  return r.json();
}

export async function sendMessage(conversation_id: number, body: string, exchange_id?: number) {
  const r = await fetch(`${API_URL}/conversations/${conversation_id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ body, exchange_id }),
  });
  if (!r.ok) throw new Error('Failed to send message.');
  return r.json();
}

export async function unreadCount() {
  const r = await fetch(`${API_URL}/conversations/unread/count`, { headers: { ...auth() } });
  if (!r.ok) return { count: 0 };
  return r.json();
}
