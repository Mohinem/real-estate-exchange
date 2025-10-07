// frontend/src/pages/MySwaps.tsx
import * as React from "react";
import {
  listMySwapRequests,
  acceptRequest,
  declineRequest,
  cancelRequest,
  counterRequest,
  ExchangeRequest,
} from "../lib/exchanges";
import { Link } from "react-router-dom";

function StatusPill({ s }: { s: ExchangeRequest["status"] }) {
  const color =
    s === "pending" ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
    s === "accepted" ? "bg-green-100 text-green-700 border-green-200" :
    s === "rejected" ? "bg-red-100 text-red-700 border-red-200" :
    "bg-gray-100 text-gray-700 border-gray-200";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${color}`}>{s}</span>;
}

function Row({
  r,
  role,
  refresh,
}: {
  r: ExchangeRequest;
  role: "received" | "sent";
  refresh: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [counterMode, setCounterMode] = React.useState(false);
  const [counterDelta, setCounterDelta] = React.useState<number>(r.cash_adjustment || 0);
  const [counterMsg, setCounterMsg] = React.useState<string>(r.message || "");

  async function doAccept() { setBusy(true); try { await acceptRequest(r.id); refresh(); } finally { setBusy(false); } }
  async function doDecline() { setBusy(true); try { await declineRequest(r.id); refresh(); } finally { setBusy(false); } }
  async function doCancel() { setBusy(true); try { await cancelRequest(r.id); refresh(); } finally { setBusy(false); } }
  async function doCounter() {
    setBusy(true);
    try { await counterRequest(r.id, { cashAdjustment: counterDelta, message: counterMsg }); setCounterMode(false); refresh(); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-600">
            Offer: <Link className="underline" to={`/listing/${r.from_listing_id}`}>#{r.from_listing_id}</Link>
            {"  →  "}
            Target: <Link className="underline" to={`/listing/${r.to_listing_id}`}>#{r.to_listing_id}</Link>
          </div>
          <div className="mt-1 text-sm">
            Cash delta: <b>{r.currency || "INR"} {Number(r.cash_adjustment || 0).toLocaleString()}</b>
          </div>
          {r.message && <div className="mt-1 text-sm text-gray-700">“{r.message}”</div>}
        </div>
        <StatusPill s={r.status} />
      </div>

      {r.status === "pending" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {role === "received" ? (
            <>
              {!counterMode && (
                <>
                  <button disabled={busy} onClick={doAccept}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white disabled:opacity-60">Accept</button>
                  <button disabled={busy} onClick={doDecline}
                    className="rounded-md border px-3 py-1.5 text-sm">Decline</button>
                  <button disabled={busy} onClick={() => setCounterMode(true)}
                    className="rounded-md border px-3 py-1.5 text-sm">Counter</button>
                </>
              )}
              {counterMode && (
                <div className="w-full rounded-md border p-3">
                  <div className="text-sm font-medium mb-2">Counter offer</div>
                  <label className="text-xs text-gray-600">Cash adjustment</label>
                  <input type="number" step="1" value={counterDelta}
                    onChange={(e) => setCounterDelta(Number(e.target.value))}
                    className="mb-2 w-full rounded-md border px-2 py-1.5" />
                  <label className="text-xs text-gray-600">Message</label>
                  <textarea value={counterMsg} onChange={(e) => setCounterMsg(e.target.value)}
                    className="mb-2 w-full rounded-md border px-2 py-1.5" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={() => setCounterMode(false)} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
                    <button disabled={busy} onClick={doCounter}
                      className="rounded-md bg-[--color-brand-500] px-3 py-1.5 text-sm text-white disabled:opacity-60">Send Counter</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button disabled={busy} onClick={doCancel}
              className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function MySwaps() {
  const [tab, setTab] = React.useState<"received" | "sent">("received");
  const [items, setItems] = React.useState<ExchangeRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { items } = await listMySwapRequests({ role: tab });
      setItems(items);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Swaps</h1>
        <div className="inline-flex rounded-lg border p-1">
          <button
            onClick={() => setTab("received")}
            className={`px-3 py-1.5 text-sm rounded-md ${tab === "received" ? "bg-gray-100" : ""}`}
          >Received</button>
          <button
            onClick={() => setTab("sent")}
            className={`px-3 py-1.5 text-sm rounded-md ${tab === "sent" ? "bg-gray-100" : ""}`}
          >Sent</button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-600">No {tab} requests yet.</div>
      ) : (
        <div className="grid gap-4">
          {items.map((r) => (
            <Row key={r.id} r={r} role={tab} refresh={load} />
          ))}
        </div>
      )}
    </section>
  );
}
