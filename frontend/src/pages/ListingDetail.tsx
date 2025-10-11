// frontend/src/pages/ListingDetail.tsx
import * as React from "react";
import Layout from "../components/Layout";
import { useParams } from "react-router-dom";
import SwapModal from "../components/SwapModal";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

/** Decode base64url JWT payload safely */
function decodeJwtPayload<T = any>(token: string): T | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function getUserIdFromJwt(): number | null {
  try {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) return null;
    const payload = decodeJwtPayload<any>(jwt);
    return payload?.user_id != null ? Number(payload.user_id) : null;
  } catch {
    return null;
  }
}

type Listing = {
  id: number;
  title: string;
  description?: string | null;
  price: number;
  currency: string;
  location: string;
  property_type: string;
  conditions?: string | null;
  contact_info?: string | null;
  owner_id: number;
  is_active: boolean;
  reserved_exchange_id?: number | null;
  exchanged_at?: string | null;
  created_at: string;
};

type ImageRow = { id: number; url: string };

export default function ListingDetail() {
  const { id } = useParams();
  const listingId = Number(id);

  const [me, setMe] = React.useState<number | null>(getUserIdFromJwt());
  const [listing, setListing] = React.useState<Listing | null>(null);
  const [images, setImages] = React.useState<ImageRow[]>([]);
  const [suggestions, setSuggestions] = React.useState<Listing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | undefined>();

  // Swap modal
  const [swapOpen, setSwapOpen] = React.useState(false);

  // Re-read JWT if it changes (e.g., after login in another tab)
  React.useEffect(() => {
    const onFocus = () => setMe(getUserIdFromJwt());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  React.useEffect(() => {
    if (!Number.isFinite(listingId)) return;

    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(undefined);

        // Fetch listing + images
        const r1 = await fetch(`${API_URL}/listings/${listingId}`);
        if (!r1.ok) throw new Error(await r1.text());
        const d1 = await r1.json(); // { listing, images }
        if (!alive) return;
        setListing(d1.listing as Listing);
        setImages((d1.images || []) as ImageRow[]);

        // Suggestions (best-effort)
        const r2 = await fetch(`${API_URL}/listings/${listingId}/suggest?pct=15`);
        if (alive) {
          if (r2.ok) {
            const d2 = await r2.json();
            setSuggestions((d2.items || []) as Listing[]);
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

  function openSwap() {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      alert("Please login first to propose a swap.");
      return;
    }
    setSwapOpen(true);
  }

  if (loading) {
    return (
      <Layout>
        <section className="mx-auto max-w-7xl px-6 sm:px-10 py-8">Loading…</section>
      </Layout>
    );
  }
  if (err) {
    return (
      <Layout>
        <section className="mx-auto max-w-7xl px-6 sm:px-10 py-8">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        </section>
      </Layout>
    );
  }
  if (!listing) {
    return (
      <Layout>
        <section className="mx-auto max-w-7xl px-6 sm:px-10 py-8">Not found.</section>
      </Layout>
    );
  }

  const priceStr =
    listing.currency
      ? new Intl.NumberFormat(undefined, { style: "currency", currency: listing.currency }).format(Number(listing.price || 0))
      : `${Number(listing.price || 0).toLocaleString()}`;

  const isReserved = !!listing.reserved_exchange_id;
  const isSwapped = !listing.is_active || !!listing.exchanged_at;
  const isOwner = me != null && Number(listing.owner_id) === Number(me);
  const loggedIn = me != null;

  // Button enablement + reason
  let proposeDisabled = false;
  let proposeReason = "";
  if (!loggedIn) {
    proposeDisabled = true;
    proposeReason = "Sign in to propose a swap.";
  } else if (isOwner) {
    proposeDisabled = true;
    proposeReason = "You cannot swap with your own listing.";
  } else if (isSwapped) {
    proposeDisabled = true;
    proposeReason = "This property is already completed/inactive.";
  } else if (isReserved) {
    proposeDisabled = true;
    proposeReason = "This property is currently reserved in an active exchange.";
  }

  return (
    <Layout>
      {/* Header band to match the rest of the app */}
      <section className="bg-gradient-to-b from-white to-blue-50 border-b">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
            {listing.title}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {listing.location} • {listing.property_type}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 sm:px-10 py-8">
        {/* Listing card */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
          <div className="h-36 bg-gradient-to-br from-brand-100 to-white" />
          <div className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-lg font-semibold text-gray-900">{listing.title}</div>
                <div className="mt-1 text-gray-600">
                  {listing.location} • {listing.property_type}
                </div>
                <div className="mt-2 text-2xl font-bold">{priceStr}</div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={openSwap}
                  disabled={proposeDisabled}
                  className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white transition
                    ${proposeDisabled ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                  title={proposeReason || "Propose a property swap"}
                >
                  Propose Swap
                </button>

                {isOwner && (
                  <a
                    href={`/listing/${listing.id}/edit`}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Update
                  </a>
                )}
              </div>
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

            {listing.description && (
              <p className="mt-5 text-gray-700 leading-relaxed">{listing.description}</p>
            )}

            {images.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((im) => (
                  <img
                    key={im.id}
                    src={im.url}
                    className="h-32 w-full rounded-lg border object-cover"
                    alt=""
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Suggested Matches */}
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Suggested Matches</h2>
          {suggestions.length === 0 ? (
            <div className="text-sm text-gray-600">No suggestions right now.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((m) => {
                const price =
                  m.currency
                    ? new Intl.NumberFormat(undefined, { style: "currency", currency: m.currency }).format(Number(m.price || 0))
                    : `${Number(m.price || 0).toLocaleString()}`;

                // We’ll still show the CTA here, but it will open the same modal targeting the current listing.
                const cardDisabled = !(loggedIn && !isOwner && Number(m.owner_id) === Number(me));

                return (
                  <div key={m.id} className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="text-sm text-gray-500">#{m.id}</div>
                    <div className="font-medium">{m.title}</div>
                    <div className="text-sm text-gray-700">
                      {m.location} • {m.property_type} • {price}
                    </div>
                    <div className="mt-3">
                      <button
                        disabled={cardDisabled}
                        onClick={openSwap}
                        className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
                        title={
                          cardDisabled
                            ? "Log in, view someone else’s listing, and use one of your own listings to propose."
                            : "Propose a swap using one of your listings"
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

      {/* Swap modal (target = viewed listing) */}
      {listing && (
        <SwapModal
          toListingId={listing.id}
          open={swapOpen}
          onClose={() => setSwapOpen(false)}
          onSuccess={() => {
            // (optional) refresh or toast; keep it simple for drop-in
          }}
        />
      )}
    </Layout>
  );
}
