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
  propertyType: string;
  conditions?: string;
  ownerId?: number;
  createdAt?: string;
};

export default function Browse() {
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
      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-blue-50 border-b">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-14">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
            Swap or sell properties with confidence
          </h1>
          <p className="mt-4 max-w-2xl text-gray-600 text-lg leading-relaxed">
            Browse listings, propose exchanges, and chat with owners — fast, secure, and simple.
          </p>
          <div className="mt-8">
            <a
              href="/new"
              className="inline-flex items-center px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
            >
              Post a listing
            </a>
          </div>
        </div>
      </section>

      {/* Filters + Grid */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <div className="mb-8">
          <Filters value={filters} onChange={setFilters} />
        </div>

        {loading && <div className="text-gray-600">Loading…</div>}
        {err && <div className="text-red-600">{err}</div>}

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {items.map((l) => (
            <ListingCard key={l.id} l={l} />
          ))}
        </div>

        {!loading && !err && items.length === 0 && (
          <div className="mt-8 text-gray-600 text-center text-lg">
            No listings match your filters.
          </div>
        )}
      </section>
    </Layout>
  );
}
