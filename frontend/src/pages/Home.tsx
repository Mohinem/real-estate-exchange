import React from 'react';
import Layout from '../components/Layout';
import ListingCard from '../components/ListingCard';
import Filters from '../components/Filters';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

type Listing = {
  id: number;
  title: string;
  description?: string;
  price: number;
  currency: string;
  location: string;
  propertyType: string; // mapped from property_type
  conditions?: string;
  ownerId?: number;     // mapped from owner_id
  createdAt?: string;   // mapped from created_at
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
      if (filters.location) q.set('location', filters.location);
      if (filters.propertyType) q.set('propertyType', filters.propertyType);
      if (filters.minPrice) q.set('minPrice', String(filters.minPrice));
      if (filters.maxPrice) q.set('maxPrice', String(filters.maxPrice));
      q.set('limit', '12');
      q.set('offset', '0');

      const res = await fetch(`${API_URL}/listings?${q.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json(); // { items: [...] }

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
      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-blue-50 border-b">
        <div className="container py-10 sm:py-14">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
            Swap or sell properties with confidence
          </h1>
          <p className="mt-3 max-w-2xl text-gray-600">
            Browse listings, propose exchanges, and chat with owners—fast, secure, and simple.
          </p>
          <div className="mt-6">
            <a
              href="/new"
              className="inline-flex items-center px-5 py-3 rounded-md bg-brand-600 text-white font-medium hover:bg-brand-700"
            >
              Post a listing
            </a>
          </div>
        </div>
      </section>

      {/* Filters + Grid */}
      <section className="container py-8">
        <div className="mb-4">
          <Filters value={filters} onChange={setFilters} />
        </div>

        {loading && <div className="text-gray-600">Loading…</div>}
        {err && <div className="text-red-600">{err}</div>}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((l) => (
            <ListingCard key={l.id} l={l} />
          ))}
        </div>

        {!loading && !err && items.length === 0 && (
          <div className="mt-6 text-gray-600">No listings match your filters.</div>
        )}
      </section>
    </Layout>
  );
}
