// frontend/src/pages/MySwaps.tsx
import * as React from "react";
import Layout from "../components/Layout";
import {
  listMySwapRequests,
  acceptRequest,
  declineRequest,
  cancelRequest,
  counterRequest,
  markReceivedSwapsSeen, // <- mark unseen received swaps as seen
} from "../lib/exchanges";

type Tab = "received" | "sent";

export default function MySwaps() {
  const [tab, setTab] = React.useState<Tab>("received");
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // --- Broadcast to other tabs to invalidate their cached counters/lists
  function broadcastInvalidate() {
    try {
      localStorage.setItem("swaps:invalidate", String(Date.now()));
    } catch {}
  }

  // --- Load swaps for given role ---
  async function load(role: Tab) {
    setLoading(true);
    setErr(null);
    try {
      const { items } = await listMySwapRequests({ role, _bust: Date.now() } as any);
      setItems(items || []);

      // If viewing the Received tab, mark unseen items as seen on the server
      if (role === "received") {
        await markReceivedSwapsSeen();
        // Let header badge (and other tabs) drop immediately
        broadcastInvalidate();
      }
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // initial + tab change
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

  // Cross-tab invalidations (e.g., another tab accepted/declined)
  React.useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "swaps:invalidate") load(tab);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [tab]);

  // Optimistic helpers
  function removeItemOptimistically(id: number) {
    setItems((prev) => prev.filter((r) => Number(r.id) !== Number(id)));
  }

  // --- Actions ---
  async function onAccept(id: number) {
    if (!confirm("Accept this swap proposal?")) return;
    try {
      removeItemOptimistically(id); // optimistic
      await acceptRequest(id);
      broadcastInvalidate();
      load(tab);
    } catch (e: any) {
      alert(e.message || "Failed to accept");
      load(tab);
    }
  }

  async function onDecline(id: number) {
    if (!confirm("Decline this swap proposal?")) return;
    try {
      removeItemOptimistically(id);
      await declineRequest(id);
      broadcastInvalidate();
      load(tab);
    } catch (e: any) {
      alert(e.message || "Failed to decline");
      load(tab);
    }
  }

  async function onCancel(id: number) {
    if (!confirm("Cancel this swap request?")) return;
    try {
      removeItemOptimistically(id);
      await cancelRequest(id);
      broadcastInvalidate();
      load(tab);
    } catch (e: any) {
      alert(e.message || "Failed to cancel");
      load(tab);
    }
  }

  async function onCounter(id: number) {
    const cash = prompt("Cash adjustment (positive means you pay):", "0");
    if (cash == null) return;
    const msg = prompt("Message (optional):", "");
    try {
      removeItemOptimistically(id); // old incoming request disappears immediately
      await counterRequest(id, {
        cashAdjustment: Number(cash) || 0,
        message: msg?.trim() || undefined,
      });
      broadcastInvalidate();
      setTab("sent"); // useEffect will reload automatically
    } catch (e: any) {
      alert(e.message || "Failed to counter");
      load(tab);
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
              const statusLabel =
                r.status === "rejected"
                  ? "rejected"
                  : r.status === "accepted"
                  ? "accepted"
                  : r.status;

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
                            statusLabel === "accepted"
                              ? "text-green-600"
                              : statusLabel === "rejected"
                              ? "text-red-600"
                              : "text-gray-800"
                          }`}
                        >
                          {statusLabel}
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
