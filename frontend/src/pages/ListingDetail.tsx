import * as React from "react";
import Layout from "../components/Layout";
import { useParams } from "react-router-dom";
import SwapModal from "../components/SwapModal";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

function getUserIdFromJwt(): number | null {
  const jwt = localStorage.getItem("jwt");
  if (!jwt) return null;
  try {
    const [, payload] = jwt.split(".");
    const json = JSON.parse(atob(payload));
    return Number(json.user_id) || null;
  } catch {
    return null;
  }
}

export default function ListingDetail() {
  const { id } = useParams();
  const listingId = Number(id);
  const [listing, setListing] = React.useState<any | null>(null);
  const [images, setImages] = React.useState<any[]>([]);
  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | undefined>();

  // Swap modal state
  const [swapOpen, setSwapOpen] = React.useState(false);
  const [swapTargetId, setSwapTargetId] = React.useState<number | null>(null);

  const me = getUserIdFromJwt();

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(undefined);

        // 1) Listing + images
        const r1 = await fetch(`${API_URL}/listings/${listingId}`);
        if (!r1.ok) throw new Error(await r1.text());
        const d1 = await r1.json(); // { listing, images }
        if (!alive) return;
        setListing(d1.listing);
        setImages(d1.images || []);

        // 2) Suggestions
        const r2 = await fetch(`${API_URL}/listings/${listingId}/suggest?pct=15`);
        if (!r2.ok) {
          // suggestions are best-effort; don't fail the page
          setSuggestions([]);
        } else {
          const d2 = await r2.json(); // { items: [...] }
          if (!alive) return;
          setSuggestions(d2.items || []);
        }
      } catch (e: any) {
        if (alive) setErr(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [listingId]);

  if (loading) {
    return (
      <Layout>
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">Loading…</section>
      </Layout>
    );
  }
  if (err) {
    return (
      <Layout>
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
        </section>
      </Layout>
    );
  }
  if (!listing) {
    return (
      <Layout>
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">Not found.</section>
      </Layout>
    );
  }

  const priceStr = `${listing.currency || ""}${Number(listing.price).toLocaleString()}`;
  const canProposeHere =
    !!me && listing.is_active && Number(listing.owner_id) !== Number(me) && !listing.reserved_exchange_id;

  function openSwapFor(targetId: number) {
    setSwapTargetId(targetId);
    setSwapOpen(true);
  }

  return (
    <Layout>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="h-40 bg-gradient-to-br from-brand-100 to-white" />
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">{listing.title}</h1>
                <div className="mt-1 text-gray-600">
                  {listing.location} • {listing.property_type}
                </div>
                <div className="mt-2 text-lg font-medium">{priceStr}</div>
              </div>
              {canProposeHere && (
                <button
                  onClick={() => openSwapFor(listingId)}
                  className="rounded-md bg-[--color-brand-500] px-3 py-2 text-sm font-medium text-white"
                >
                  Propose Swap
                </button>
              )}
            </div>

            {listing.description && <p className="mt-4 text-gray-800">{listing.description}</p>}

            {images?.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {images.map((img: any) => (
                  <img
                    key={img.id}
                    src={img.url}
                    className="h-28 w-full rounded-md object-cover"
                    alt="Listing"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Suggested matches */}
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Suggested Matches</h2>
          {suggestions.length === 0 ? (
            <div className="text-sm text-gray-600">No suggestions right now.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((m: any) => {
                const price = `${m.currency || ""}${Number(m.price).toLocaleString()}`;
                const canProposeToSuggestion =
                  !!me && m.is_active && Number(m.owner_id) !== Number(me) && !m.reserved_exchange_id;
                return (
                  <div key={m.id} className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="text-sm text-gray-500">#{m.id}</div>
                    <div className="font-medium">{m.title}</div>
                    <div className="text-sm text-gray-700">
                      {m.location} • {m.property_type} • {price}
                    </div>
                    <div className="mt-3">
                      <button
                        disabled={!canProposeToSuggestion}
                        onClick={() => openSwapFor(m.id)}
                        className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
                      >
                        Propose Swap
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Swap modal (targets either the viewed listing or a suggestion) */}
      {swapTargetId != null && (
        <SwapModal
          toListingId={swapTargetId}
          open={swapOpen}
          onClose={() => setSwapOpen(false)}
          onSuccess={() => {
            // optional: toast or refresh suggestions/listing
          }}
        />
      )}
    </Layout>
  );
}
