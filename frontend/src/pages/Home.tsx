// src/pages/Home.tsx
import React from "react";
import Layout from "../components/Layout";
import ListingCard from "../components/ListingCard";
import Filters from "../components/Filters";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

type Listing = {
  id: number;
  title: string;
  description?: string;
  price: number;
  currency: string;
  location: string;
  propertyType: string;
  conditions?: string;
  ownerId?: number;
  createdAt?: string;
};

export default function Home() {
  const [filters, setFilters] = React.useState<Record<string, any>>({});
  const [items, setItems] = React.useState<Listing[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | undefined>();

  async function load() {
    setLoading(true);
    setErr(undefined);
    try {
      const q = new URLSearchParams();
      if (filters.location) q.set("location", filters.location);
      if (filters.propertyType) q.set("propertyType", filters.propertyType);
      if (filters.minPrice) q.set("minPrice", String(filters.minPrice));
      if (filters.maxPrice) q.set("maxPrice", String(filters.maxPrice));
      q.set("limit", "12");
      q.set("offset", "0");

      const res = await fetch(`${API_URL}/listings?${q.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      const mapped: Listing[] = (data.items || []).map((l: any) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        price: l.price,
        currency: l.currency,
        location: l.location,
        propertyType: l.property_type,
        conditions: l.conditions,
        ownerId: l.owner_id,
        createdAt: l.created_at,
      }));
      setItems(mapped);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  return (
    <Layout>
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-white to-blue-50">
        {/* soft blobs */}
        <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-[--color-brand-100] blur-3xl opacity-60" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-indigo-100 blur-3xl opacity-60" />
        <div className="relative mx-auto max-w-7xl px-6 sm:px-10 py-16">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Swap or sell properties with confidence
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              Discover verified homes, propose fair exchanges in a click, and complete deals
              transparently—no clutter, just a smooth experience.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/new"
                className="inline-flex items-center rounded-lg bg-[color:var(--color-brand-600,#2563eb)] px-6 py-3 text-white shadow-sm hover:bg-[color:var(--color-brand-700,#1d4ed8)]"
              >
                + Post a listing
              </a>
              <a
                href="#browse"
                className="inline-flex items-center rounded-lg border px-6 py-3 text-gray-700 hover:bg-gray-50"
              >
                Browse listings
              </a>
            </div>
          </div>

          {/* quick stats */}
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <Stat label="Active listings" value="Thousands" />
            <Stat label="Avg. response time" value="< 24 hrs" />
            <Stat label="Countries covered" value="Worldwide" />
          </div>
        </div>
      </section>

      {/* ===== Value props ===== */}
      <section className="mx-auto max-w-7xl px-6 sm:px-10 py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          <Feature
            title="Fair swaps"
            desc="Side-by-side comparisons, cash adjustments, and clear terms help both sides agree fast."
            icon="🤝"
          />
          <Feature
            title="Trust by design"
            desc="Account-level controls, visibility rules, and audit trails keep exchanges honest."
            icon="🛡️"
          />
          <Feature
            title="Simple workflow"
            desc="Filter, propose, counter, accept. Your dashboard tracks everything in one place."
            icon="⚡"
          />
        </div>
      </section>

      {/* ===== Filters & Results ===== */}
      <section id="browse" className="mx-auto max-w-7xl px-6 sm:px-10 py-6">
        <div className="mb-6">
          <Filters value={filters} onChange={setFilters} />
        </div>

        {err && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {loading ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
              {items.map((l) => (
                <ListingCard key={l.id} l={l} />
              ))}
            </div>

            {!err && items.length === 0 && (
              <div className="mt-10 rounded-xl border bg-white p-10 text-center">
                <h3 className="text-lg font-semibold text-gray-900">No results</h3>
                <p className="mt-1 text-sm text-gray-600">
                  No listings match your filters. Try broadening your search or clearing filters.
                </p>
                <button
                  onClick={() => setFilters({})}
                  className="mt-4 inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Reset filters
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ===== How it works ===== */}
      <section className="mx-auto max-w-7xl px-6 sm:px-10 py-14">
        <h2 className="text-2xl font-bold text-gray-900">How it works</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          <Step n={1} title="Create or find a listing" />
          <Step n={2} title="Propose a swap (with cash adj.)" />
          <Step n={3} title="Accept and complete the exchange" />
        </ol>
      </section>

      {/* ===== CTA ===== */}
      <section className="border-t bg-white">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 py-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Ready to list your property?</h3>
            <p className="text-gray-600">Reach serious swappers and buyers in minutes.</p>
          </div>
          <a
            href="/new"
            className="inline-flex items-center rounded-lg bg-[color:var(--color-brand-600,#2563eb)] px-5 py-2.5 text-white hover:bg-[color:var(--color-brand-700,#1d4ed8)]"
          >
            Create a listing
          </a>
        </div>
      </section>
    </Layout>
  );
}

/* ---------- small internal components ---------- */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      <div className="mt-1 text-sm text-gray-600">{label}</div>
    </div>
  );
}

function Feature({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-[--color-brand-50] text-2xl">
          <span aria-hidden>{icon}</span>
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <li className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[--color-brand-100] text-[--color-brand-700] font-semibold">
          {n}
        </span>
        <span className="font-medium text-gray-900">{title}</span>
      </div>
    </li>
  );
}

function SkeletonCard() {
  return (
    <div className="flex h-[360px] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="h-40 animate-pulse bg-gray-100" />
      <div className="p-5">
        <div className="h-5 w-44 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-4 w-56 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mt-6 h-9 w-28 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}
