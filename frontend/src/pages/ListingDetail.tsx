// frontend/src/pages/ListingDetail.tsx
import * as React from "react";
import Layout from "../components/Layout";
import { useParams } from "react-router-dom";
import SwapModal from "../components/SwapModal";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

// base64url-safe JWT payload decode -> returns object or null
function decodeJwtPayload<T = any>(token: string): T | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getUserIdFromJwt(): number | null {
  const jwt = localStorage.getItem("jwt");
  if (!jwt) return null;
  const payload = decodeJwtPayload<any>(jwt);
  return payload?.user_id != null ? Number(payload.user_id) : null;
}

export default function ListingDetail() {
  const { id } = useParams();
  const listingId = Number(id);
  const me = getUserIdFromJwt();

  const [listing, setListing] = React.useState<any | null>(null);
  const [images, setImages] = React.useState<any[]>([]);
  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | undefined>();

  // Swap modal state
  const [swapOpen, setSwapOpen] = React.useState(false);
  const [swapTargetId, setSwapTargetId] = React.useState<number | null>(null);

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

        // 2) Suggestions (best-effort)
        const r2 = await fetch(`${API_URL}/listings/${listingId}/suggest?pct=15`);
        if (alive) {
          if (r2.ok) {
            const d2 = await r2.json(); // { items: [...] }
            setSuggestions(d2.items || []);
          } else {
            setSuggestions([]);
          }
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

  function openSwapFor(targetId: number) {
    if (!localStorage.getItem("jwt")) {
      alert("Please login first to propose a swap.");
      return;
    }
    setSwapTargetId(targetId);
    setSwapOpen(true);
  }

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
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
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
  const isReserved = !!listing.reserved_exchange_id;
  const isSwapped = !listing.is_active || !!listing.exchanged_at;

  // Only allow proposing if:
  // - logged in
  // - listing is active
  // - listing is not yours
  // - listing is not reserved
  const canProposeHere =
    !!me && listing.is_active && !isReserved && Number(listing.owner_id) !== Number(me);

  return (
    <Layout>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Listing header card */}
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

            {/* Status banners */}
            {isSwapped && (
              <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                This property has been <b>swapped</b> and is no longer available.
              </div>
            )}
            {!isSwapped && isReserved && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This property is <b>reserved for an ongoing exchange</b>.
              </div>
            )}

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

                // Enable when:
                // - you're logged in,
                // - the viewed listing isn't yours,
                // - and the suggested card IS yours (so you can offer it)
                const canUseThisAsMyOffer =
                  !!me &&
                  Number(listing.owner_id) !== Number(me) &&
                  Number(m.owner_id) === Number(me);

                return (
                  <div key={m.id} className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="text-sm text-gray-500">#{m.id}</div>
                    <div className="font-medium">{m.title}</div>
                    <div className="text-sm text-gray-700">
                      {m.location} • {m.property_type} • {price}
                    </div>
                    <div className="mt-3">
                      <button
                        disabled={!canUseThisAsMyOffer}
                        onClick={() => openSwapFor(listingId)}
                        className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
                        title={
                          canUseThisAsMyOffer
                            ? "Propose a swap to this listing using your selected offer"
                            : "You can only use your own listing to propose, and only if the viewed listing isn’t yours"
                        }
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

      {/* Swap modal (targets the viewed listing; you pick your offer inside) */}
      {swapTargetId != null && (
        <SwapModal
          toListingId={swapTargetId}
          open={swapOpen}
          onClose={() => setSwapOpen(false)}
          onSuccess={() => {
            // optional: refresh, toast, etc.
          }}
        />
      )}
    </Layout>
  );
}
