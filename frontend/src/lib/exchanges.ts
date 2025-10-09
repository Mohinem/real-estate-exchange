// frontend/src/lib/exchanges.ts
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

function authHeaders() {
  const jwt = localStorage.getItem("jwt");
  return {
    "content-type": "application/json",
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };
}

async function getJsonWithFallback(urls: string[]) {
  const headers = authHeaders();

  let lastErr = "";
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers, credentials: "include" });
      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) return res.json();
        // If backend returned HTML for some reason, try next candidate
        lastErr = "Server returned non-JSON response.";
        continue;
      }
      // For 404 try next, for others surface the body
      if (res.status !== 404) {
        lastErr = (await res.text().catch(() => "")) || `HTTP ${res.status}`;
        break;
      }
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  throw new Error(lastErr || "Endpoint not found");
}

// ---- Public API -------------------------------------------------------------

// List my swap requests
export async function listMySwapRequests({ role }: { role: "received" | "sent" }) {
  const qs = `role=${encodeURIComponent(role)}`;
  const res = await fetch(`${API_URL}/exchange-requests/mine?${qs}`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  return res.json(); // { items: [...] }
}

// Create new proposal
export async function createRequest(payload: {
  fromListingId: number;
  toListingId: number;
  cashAdjustment?: number;
  message?: string;
}) {
  const res = await fetch(`${API_URL}/exchange-requests`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  return res.json();
}

// Actions
export async function acceptRequest(id: number) {
  const res = await fetch(`${API_URL}/exchange-requests/${id}/accept`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  return res.json();
}

export async function declineRequest(id: number) {
  const res = await fetch(`${API_URL}/exchange-requests/${id}/decline`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  return res.json();
}

export async function cancelRequest(id: number) {
  const res = await fetch(`${API_URL}/exchange-requests/${id}/cancel`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  return res.json();
}

export async function counterRequest(id: number, body: { cashAdjustment?: number; message?: string }) {
  const res = await fetch(`${API_URL}/exchange-requests/${id}/counter`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  return res.json();
}
