const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const auth = () => {
  const t = localStorage.getItem('jwt');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export async function listThreads() {
  const res = await fetch(`${API_URL}/inbox/threads`, { headers: { ...auth() } });
  if (!res.ok) throw new Error('Failed to load inbox.');
  return res.json();
}

export async function getThread(exchangeId: number) {
  const res = await fetch(`${API_URL}/inbox/thread/${exchangeId}`, { headers: { ...auth() } });
  if (!res.ok) throw new Error('Failed to load thread.');
  return res.json();
}

export async function sendMessage(exchange_id: number, body: string) {
  const res = await fetch(`${API_URL}/inbox/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ exchange_id, body }),
  });
  if (!res.ok) throw new Error('Failed to send message.');
  return res.json();
}

export async function markRead(exchange_id: number) {
  await fetch(`${API_URL}/inbox/mark-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ exchange_id }),
  });
}

export async function getUnreadCount() {
  const res = await fetch(`${API_URL}/inbox/unread-count`, { headers: { ...auth() } });
  if (!res.ok) return { count: 0 };
  return res.json();
}
