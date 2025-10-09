// frontend/src/pages/MySwaps.tsx
import * as React from "react";
import Layout from "../components/Layout";
import {
  listMySwapRequests,
  acceptRequest,
  declineRequest,
  cancelRequest,
  counterRequest,
} from "../lib/exchanges";

type Tab = "received" | "sent";

export default function MySwaps() {
  const [tab, setTab] = React.useState<Tab>("received");
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // --- Helper: Load swaps for given role ---
  async function load(role: Tab) {
    setLoading(true);
    setErr(null);
    try {
      const { items } = await listMySwapRequests({ role });
      setItems(items || []);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      setErr("Please login to view your swaps.");
      setLoading(false);
      return;
    }
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // --- Actions ---
  async function onAccept(id: number) {
    if (!confirm("Accept this swap proposal?")) return;
    try {
      await acceptRequest(id);
      alert("✅ Swap accepted!");
      await load(tab);
    } catch (e: any) {
      alert(e.message || "Failed to accept");
    }
  }

  async function onDecline(id: number) {
    if (!confirm("Decline this swap proposal?")) return;
    try {
      await declineRequest(id);
      alert("❌ Swap declined.");
      await load(tab);
    } catch (e: any) {
      alert(e.message || "Failed to decline");
    }
  }

  async function onCancel(id: number) {
    if (!confirm("Cancel this swap request?")) return;
    try {
      await cancelRequest(id);
      alert("🚫 Swap request canceled.");
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
        message: msg?.trim() || undefined,
      });
      alert("🔁 Counter-offer sent!");
      setTab("sent"); // switch to sent after countering
    } catch (e: any) {
      alert(e.message || "Failed to counter");
    }
  }

  // --- Render ---
  return (
    <Layout>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">My Swaps</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("received")}
              className={`px-3 py-1.5 rounded-md border text-sm ${
                tab === "received"
                  ? "bg-blue-50 border-blue-400 text-blue-700"
                  : "hover:bg-gray-50"
              }`}
            >
              Received
            </button>
            <button
              onClick={() => setTab("sent")}
              className={`px-3 py-1.5 rounded-md border text-sm ${
                tab === "sent"
                  ? "bg-blue-50 border-blue-400 text-blue-700"
                  : "hover:bg-gray-50"
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
            {items.map((r: any) => {
              const isPending = r.status === "pending";
              return (
                <div
                  key={r.id}
                  className="rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        From listing #{r.from_listing_id} → To listing #{r.to_listing_id}
                      </div>
                      <div className="text-sm text-gray-600">
                        Status:{" "}
                        <span
                          className={`font-medium ${
                            r.status === "accepted"
                              ? "text-green-600"
                              : r.status === "declined"
                              ? "text-red-600"
                              : "text-gray-800"
                          }`}
                        >
                          {r.status}
                        </span>
                        {r.cash_adjustment ? (
                          <span className="ml-2">
                            • Cash: {r.currency || "INR"}
                            {Number(r.cash_adjustment).toLocaleString()}
                          </span>
                        ) : null}
                        {r.message ? (
                          <span className="ml-2 text-gray-500">“{r.message}”</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap justify-end">
                      {tab === "received" ? (
                        <>
                          <button
                            onClick={() => onAccept(r.id)}
                            disabled={!isPending}
                            className={`rounded-md px-3 py-1.5 text-sm text-white ${
                              isPending
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-gray-300 cursor-not-allowed"
                            }`}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => onCounter(r.id)}
                            disabled={!isPending}
                            className={`rounded-md border px-3 py-1.5 text-sm ${
                              isPending ? "hover:bg-gray-50" : "opacity-60"
                            }`}
                          >
                            Counter
                          </button>
                          <button
                            onClick={() => onDecline(r.id)}
                            disabled={!isPending}
                            className={`rounded-md border px-3 py-1.5 text-sm ${
                              isPending ? "hover:bg-gray-50" : "opacity-60"
                            }`}
                          >
                            Decline
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => onCancel(r.id)}
                            disabled={!isPending}
                            className={`rounded-md border px-3 py-1.5 text-sm ${
                              isPending ? "hover:bg-gray-50" : "opacity-60"
                            }`}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </Layout>
  );
}
