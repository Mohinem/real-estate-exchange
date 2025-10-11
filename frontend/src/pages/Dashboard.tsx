// src/pages/Dashboard.tsx
import React from "react";
import Layout from "../components/Layout";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

type Listing = {
  id: number;
  title: string;
  description?: string;
  price: number;
  currency: string;
  location: string;
  property_type: "apartment" | "house" | "villa" | "land" | "other";
  conditions?: string;
  // optional flags if present in your API
  is_active?: boolean;
  exchanged_at?: string | null;
  reserved_exchange_id?: number | null;
};

function formatMoney(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(n));
  } catch {
    return `${currency}${Number(n).toLocaleString()}`;
  }
}

export default function Dashboard() {
  const [items, setItems] = React.useState<Listing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | undefined>();
  const [editing, setEditing] = React.useState<Listing | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
  const authHeader = token ? ({ Authorization: `Bearer ${token}` } as Record<string, string>) : {};

  async function fetchMine() {
    setLoading(true);
    setErr(undefined);
    try {
      const res = await fetch(`${API_URL}/api/listings/mine`, { headers: authHeader });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(Array.isArray(data) ? data : data?.rows ?? []);
    } catch (e: any) {
      setErr(e.message || "Failed to load listings.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(id: number) {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_URL}/api/listings/${id}`, { method: "DELETE", headers: authHeader });
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => prev.filter((l) => l.id !== id));
    } catch (e: any) {
      alert(e.message || "Delete failed");
    }
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;

    setSubmitting(true);
    const form = new FormData(e.currentTarget);

    const payload = {
      title: String(form.get("title") || "").trim(),
      description: String(form.get("description") || "") || null,
      price: form.get("price") !== null && form.get("price") !== "" ? Number(form.get("price")) : null,
      currency: String(form.get("currency") || "") || null,
      location: String(form.get("location") || "") || null,
      propertyType: (String(form.get("propertyType") || "") as Listing["property_type"]) || null,
      conditions: String(form.get("conditions") || "") || null,
    };

    try {
      const res = await fetch(`${API_URL}/api/listings/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditing(null);
      await fetchMine();
    } catch (e: any) {
      alert(e.message || "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  // small badge (same palette as ListingCard.tsx)
  function StatusPill({ l }: { l: Listing }) {
    const reserved = !!l.reserved_exchange_id;
    const swapped = l.is_active === false || !!l.exchanged_at;
    const status: "available" | "reserved" | "swapped" = swapped ? "swapped" : reserved ? "reserved" : "available";
    const cls =
      status === "available"
        ? "bg-green-50 text-green-700 ring-green-200"
        : status === "reserved"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-gray-100 text-gray-700 ring-gray-200";
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 shadow-[0_1px_0_rgba(0,0,0,0.03)] ${cls}`}
        title={
          status === "reserved"
            ? "Accepted elsewhere; pending completion"
            : status === "swapped"
            ? "Exchange completed"
            : "Available"
        }
      >
        {status === "available" ? "Available" : status === "reserved" ? "Reserved" : "Swapped"}
      </span>
    );
  }

  return (
    <Layout>
      <section className="mx-auto max-w-7xl px-6 sm:px-10 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Listings</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage your properties. Edit details or remove listings you no longer want visible.
            </p>
          </div>
          <a
            href="/new"
            className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-white text-sm font-medium shadow-sm hover:bg-brand-700"
          >
            + New Listing
          </a>
        </div>

        {err && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm"
              >
                <div className="h-40 animate-pulse bg-gray-100" />
                <div className="p-5">
                  <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
                  <div className="mt-3 h-4 w-56 rounded bg-gray-200 animate-pulse" />
                  <div className="mt-2 h-4 w-44 rounded bg-gray-200 animate-pulse" />
                  <div className="mt-6 h-8 w-24 rounded bg-gray-200 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
            <h3 className="text-lg font-semibold text-gray-900">No listings yet</h3>
            <p className="mt-1 text-sm text-gray-600">Create your first property listing to get started.</p>
            <a
              href="/new"
              className="mt-4 inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-white text-sm font-medium hover:bg-brand-700"
            >
              Create Listing
            </a>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            {items.map((l) => (
              <article
                key={l.id}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm transition-all duration-150 hover:shadow-md hover:ring-gray-200 focus-within:ring-[--color-brand-200]"
              >
                {/* Media header (gradient placeholder to match ListingCard) */}
                <div className="relative h-40 w-full overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-b from-brand-100 to-white" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent" />

                  {/* Price chip */}
                  <span className="absolute right-3 top-3 rounded-md bg-white/95 px-2 py-0.5 text-sm font-semibold text-[--color-brand-700] shadow-sm ring-1 ring-gray-200">
                    {formatMoney(l.price, l.currency)}
                  </span>

                  {/* Status pill */}
                  <div className="absolute left-3 top-3">
                    <StatusPill l={l} />
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">{l.title}</h3>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-gray-600">
                    {l.location && <span>{l.location}</span>}
                    {l.location && l.property_type && <span>•</span>}
                    <span className="capitalize">{l.property_type}</span>
                  </div>

                  {l.description && (
                    <p className="mt-2 text-sm text-gray-700 line-clamp-2">{l.description}</p>
                  )}

                  {l.conditions && (
                    <p className="mt-1 text-sm text-gray-500">Conditions: {l.conditions}</p>
                  )}

                  <div className="mt-auto pt-4 flex gap-2">
                    <button
                      onClick={() => setEditing(l)}
                      className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-[--color-brand-700] hover:bg-brand-50/40 focus-visible:ring-2 focus-visible:ring-[--color-brand-400] outline-none"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(l.id)}
                      className="inline-flex items-center rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Swapped overlay, if applicable */}
                {(l.is_active === false || !!l.exchanged_at) && (
                  <div className="pointer-events-none absolute inset-0 bg-white/45 backdrop-blur-[1px]" />
                )}
              </article>
            ))}
          </div>
        )}

        {/* Edit dialog */}
        {editing && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => (submitting ? null : setEditing(null))} />
            <div className="absolute inset-0 grid place-items-center p-4">
              <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <h3 className="text-lg font-semibold text-gray-900">Edit Listing</h3>
                  <button
                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                    onClick={() => setEditing(null)}
                    disabled={submitting}
                    title="Close"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={onSave} className="px-5 pb-5 pt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Title</label>
                      <input
                        name="title"
                        defaultValue={editing.title}
                        required
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        name="description"
                        defaultValue={editing.description || ""}
                        rows={4}
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Price</label>
                      <input
                        name="price"
                        type="number"
                        min={0}
                        step="1"
                        defaultValue={editing.price}
                        required
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Currency</label>
                      <input
                        name="currency"
                        defaultValue={editing.currency || "INR"}
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Location</label>
                      <input
                        name="location"
                        defaultValue={editing.location}
                        required
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Property Type</label>
                      <select
                        name="propertyType"
                        defaultValue={editing.property_type}
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                      >
                        <option>apartment</option>
                        <option>house</option>
                        <option>villa</option>
                        <option>land</option>
                        <option>other</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Conditions (optional)</label>
                      <input
                        name="conditions"
                        defaultValue={editing.conditions || ""}
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      onClick={() => setEditing(null)}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
                    >
                      {submitting ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </section>
    </Layout>
  );
}
