// frontend/src/pages/MySwaps.tsx
import * as React from "react";
import Layout from "../components/Layout";
import { listMySwapRequests, acceptRequest, declineRequest, cancelRequest, counterRequest } from "../lib/exchanges";

type Tab = "received" | "sent";

export default function MySwaps() {
  const [tab, setTab] = React.useState<Tab>("received");
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  async function load(role: Tab) {
    setLoading(true);
    setErr(null);
    try {
      const { items } = await listMySwapRequests({ role }); // ✅ correct signature
      setItems(items || []);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    // must be logged in to see swaps
    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      setErr("Please login to view your swaps.");
      setLoading(false);
      return;
    }
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function onAccept(id: number) {
    try {
      await acceptRequest(id);
      await load(tab);
    } catch (e: any) {
      alert(e.message || "Failed to accept");
    }
  }

  async function onDecline(id: number) {
    try {
      await declineRequest(id);
      await load(tab);
    } catch (e: any) {
      alert(e.message || "Failed to decline");
    }
  }

  async function onCancel(id: number) {
    try {
      await cancelRequest(id);
      await load(tab);
    } catch (e: any) {
      alert(e.message || "Failed to cancel");
    }
  }

  async function onCounter(id: number) {
    const cash = prompt("Cash adjustment (positive means you pay):", "0");
    if (cash == null) return;
    const msg = prompt("Message (optional):", "");
    try {
      await counterRequest(id, {
        cashAdjustment: Number(cash) || 0,
        message: msg || undefined,
      });
      // After a counter, switch to "Sent" (your counter is now your outgoing request)
      setTab("sent");
    } catch (e: any) {
      alert(e.message || "Failed to counter");
    }
  }

  return (
    <Layout>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">My Swaps</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("received")}
              className={`px-3 py-1.5 rounded-md border text-sm ${
                tab === "received" ? "bg-blue-50 border-blue-400 text-blue-700" : "hover:bg-gray-50"
              }`}
            >
              Received
            </button>
            <button
              onClick={() => setTab("sent")}
              className={`px-3 py-1.5 rounded-md border text-sm ${
                tab === "sent" ? "bg-blue-50 border-blue-400 text-blue-700" : "hover:bg-gray-50"
              }`}
            >
              Sent
            </button>
          </div>
        </div>

        <div className="mt-6">
          {loading && <div>Loading…</div>}
          {err && !loading && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}
          {!loading && !err && items.length === 0 && (
            <div className="text-gray-500">No {tab} requests yet.</div>
          )}

          <div className="mt-4 grid gap-4">
            {items.map((r: any) => (
              <div key={r.id} className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      From listing #{r.from_listing_id} → To listing #{r.to_listing_id}
                    </div>
                    <div className="text-sm text-gray-600">
                      Status: <span className="font-medium">{r.status}</span>
                      {r.cash_adjustment ? (
                        <span className="ml-2">
                          • Cash: {r.currency || "INR"}
                          {Number(r.cash_adjustment).toLocaleString()}
                        </span>
                      ) : null}
                      {r.message ? <span className="ml-2 text-gray-500">“{r.message}”</span> : null}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {tab === "received" ? (
                      <>
                        <button
                          onClick={() => onAccept(r.id)}
                          className="rounded-md bg-[--color-brand-500] px-3 py-1.5 text-sm text-white"
                          disabled={r.status !== "pending"}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => onCounter(r.id)}
                          className="rounded-md border px-3 py-1.5 text-sm"
                          disabled={r.status !== "pending"}
                        >
                          Counter
                        </button>
                        <button
                          onClick={() => onDecline(r.id)}
                          className="rounded-md border px-3 py-1.5 text-sm"
                          disabled={r.status !== "pending"}
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onCancel(r.id)}
                          className="rounded-md border px-3 py-1.5 text-sm"
                          disabled={r.status !== "pending"}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
