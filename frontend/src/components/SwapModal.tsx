// frontend/src/components/SwapModal.tsx
import * as React from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

type Props = {
  toListingId: number; // the listing user is viewing (target)
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
  const firstFieldRef = React.useRef<HTMLSelectElement | null>(null);

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
        // focus after paint
        setTimeout(() => firstFieldRef.current?.focus(), 0);
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
    <div className="fixed inset-0 z-50">
      {/* Dimmer */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      {/* Panel */}
      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="swap-title"
          className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          {/* Brand header */}
          <div className="relative h-20 w-full bg-gradient-to-br from-brand-100 to-white">
            <span className="absolute left-5 top-4 text-xs font-medium text-gray-600">
              Propose to listing <span className="font-semibold text-gray-800">#{toListingId}</span>
            </span>
          </div>

          <form onSubmit={submit} className="px-5 pb-5 pt-4">
            <div className="mb-4 flex items-start justify-between">
              <h2 id="swap-title" className="text-xl font-semibold text-gray-900">
                Propose a Swap
              </h2>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Offer select */}
            <label className="block text-sm font-medium text-gray-700">Offer one of your listings</label>
            <select
              ref={firstFieldRef}
              className="mt-1 mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              value={fromListingId}
              onChange={(e) => setFromListingId((e.target.value as any) || "")}
            >
              {myListings.length === 0 && <option value="">No active, unreserved listings</option>}
              {myListings.map((l) => (
                <option key={l.id} value={l.id}>
                  #{l.id} — {l.title} ({l.currency}
                  {Number(l.price).toLocaleString()})
                </option>
              ))}
            </select>

            {/* Cash adjustment */}
            <div className="grid gap-3 sm:grid-cols-[1fr]">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Cash adjustment <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                  value={cashAdjustment}
                  onChange={(e) => setCashAdjustment(Number(e.target.value))}
                  placeholder="0"
                  inputMode="numeric"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Positive = <span className="font-medium">you pay</span> them; negative ={" "}
                  <span className="font-medium">they pay</span> you.
                </p>
              </div>
            </div>

            {/* Message */}
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700">
                Message <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share any terms, constraints, timelines…"
              />
            </div>

            {/* Actions */}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !fromListingId}
                className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60
                           border shadow-sm transition
                           bg-[color:var(--color-brand-600,#2563eb)]
                           hover:bg-[color:var(--color-brand-700,#1d4ed8)]"
              >
                {loading ? "Sending…" : "Send Proposal"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
