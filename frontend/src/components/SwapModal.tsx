// frontend/src/components/SwapModal.tsx
import * as React from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

type Props = {
  toListingId: number;         // the listing user is viewing (target)
  open: boolean;
  onClose: () => void;
  onSuccess?: (payload: any) => void;
};

type MyListing = {
  id: number;
  title: string;
  price: number;
  currency: string;
  is_active: boolean;
  reserved_exchange_id?: number | null;
};

async function fetchMyListings(): Promise<MyListing[]> {
  const jwt = localStorage.getItem("jwt");
  const res = await fetch(`${API_URL}/api/listings/mine`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function postProposeSwap(payload: {
  fromListingId: number;
  toListingId: number;
  cashAdjustment?: number;
  currency?: string;
  message?: string;
  expiresAt?: string | null;
}) {
  const jwt = localStorage.getItem("jwt");
  const res = await fetch(`${API_URL}/exchange-requests`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function SwapModal({ toListingId, open, onClose, onSuccess }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [myListings, setMyListings] = React.useState<MyListing[]>([]);
  const [fromListingId, setFromListingId] = React.useState<number | "">("");
  const [cashAdjustment, setCashAdjustment] = React.useState<number>(0);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Load listings when modal opens
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        setError(null);
        const mine = await fetchMyListings();
        const active = (mine || []).filter((l) => l.is_active && !l.reserved_exchange_id);
        if (!alive) return;
        setMyListings(active);
        setFromListingId(active.length ? active[0].id : "");
      } catch (e: any) {
        if (!alive) return;
        setError(e.message || "Failed to load your listings");
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromListingId) return setError("Pick one of your listings to offer.");
    setLoading(true);
    setError(null);
    try {
      const res = await postProposeSwap({
        fromListingId: Number(fromListingId),
        toListingId,
        cashAdjustment: Number(cashAdjustment) || 0,
        message: message?.trim() || undefined,
      });
      onSuccess?.(res);
      onClose();
      alert("Swap proposal sent ✅");
    } catch (e: any) {
      setError(e.message || "Failed to propose swap");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl">
        <form onSubmit={submit} className="p-6">
          <h2 className="text-xl font-semibold mb-4">Propose a Swap</h2>

          {error && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <label className="block text-sm font-medium mb-1">Offer one of your listings</label>
          <select
            className="mb-3 w-full rounded-md border px-3 py-2"
            value={fromListingId}
            onChange={(e) => setFromListingId((e.target.value as any) || "")}
          >
            {myListings.length === 0 && <option value="">No active, unreserved listings</option>}
            {myListings.map((l) => (
              <option key={l.id} value={l.id}>
                #{l.id} — {l.title} ({l.currency}{Number(l.price).toLocaleString()})
              </option>
            ))}
          </select>

          <label className="block text-sm font-medium mb-1">Cash adjustment (optional)</label>
          <input
            type="number"
            step="1"
            className="mb-3 w-full rounded-md border px-3 py-2"
            value={cashAdjustment}
            onChange={(e) => setCashAdjustment(Number(e.target.value))}
            placeholder="0"
          />
          <p className="mb-3 text-xs text-gray-500">
            Positive = you pay them; negative = they pay you.
          </p>

          <label className="block text-sm font-medium mb-1">Message (optional)</label>
          <textarea
            className="mb-4 w-full rounded-md border px-3 py-2"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share any terms, constraints, timelines..."
          />

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !fromListingId}
              // Use a safe fallback so the button is visible even if the CSS variable isn't applied.
              className="rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60 border
                         bg-[color:var(--color-brand-500,#2563eb)]"
            >
              {loading ? "Sending…" : "Send Proposal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
