// frontend/src/lib/exchanges.ts
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

function authHeaders() {
  const jwt = localStorage.getItem("jwt");
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    // try to surface server error message
    const body = await res.json().catch(async () => ({ error: await res.text().catch(() => "") }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** -------- Listings (mine) -------- */
export async function getMyListings() {
  const res = await fetch(`${API_URL}/api/listings/mine`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  return asJson<any[]>(res);
}

/** -------- Exchange Requests types & helpers -------- */
export type ExchangeRequest = {
  id: number;
  from_listing_id: number;
  to_listing_id: number;
  from_user_id?: number;
  to_user_id?: number;
  message?: string | null;
  currency?: string;
  cash_adjustment?: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  updated_at: string;
  parent_request_id?: number | null;
  expires_at?: string | null;
};

/** Create a new swap proposal */
export async function proposeSwap(body: {
  fromListingId: number;
  toListingId: number;
  cashAdjustment?: number;
  currency?: string;
  message?: string;
  expiresAt?: string | null;
}) {
  const res = await fetch(`${API_URL}/exchange-requests`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return asJson<ExchangeRequest>(res);
}

/** List my swap requests by role (received|sent) and optional status */
export async function listMySwapRequests(options: {
  role?: "sent" | "received";
  status?: "pending" | "accepted" | "rejected" | "cancelled";
} = {}) {
  const params = new URLSearchParams();
  if (options.role) params.set("role", options.role);
  if (options.status) params.set("status", options.status);
  const res = await fetch(`${API_URL}/exchange-requests/mine?${params.toString()}`, {
    credentials: "include",
    headers: { ...authHeaders() },
  });
  return asJson<{ items: ExchangeRequest[] }>(res);
}

/** Accept a received request (creates an exchange & reserves both listings) */
export async function acceptRequest(id: number) {
  const res = await fetch(`${API_URL}/exchange-requests/${id}/accept`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  // server returns the created exchange; we don't type it strictly here
  return asJson<any>(res);
}

/** Decline a received request */
export async function declineRequest(id: number) {
  const res = await fetch(`${API_URL}/exchange-requests/${id}/decline`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  return asJson<{ ok: true }>(res);
}

/** Cancel a sent request */
export async function cancelRequest(id: number) {
  const res = await fetch(`${API_URL}/exchange-requests/${id}/cancel`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  return asJson<{ ok: true }>(res);
}

/** Counter a received request (creates a new pending request reversing roles) */
export async function counterRequest(id: number, body: { cashAdjustment?: number; message?: string }) {
  const res = await fetch(`${API_URL}/exchange-requests/${id}/counter`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return asJson<ExchangeRequest>(res);
}

/** Mark an active exchange as completed */
export async function completeExchange(exchangeId: number) {
  const res = await fetch(`${API_URL}/exchanges/${exchangeId}/complete`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  return asJson<{ ok: true }>(res);
}
