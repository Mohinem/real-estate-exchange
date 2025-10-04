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
  const [filters, setFilters] = React.useState<any>({});
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

      // Map DB snake_case -> camelCase expected by ListingCard
      const mapped: Listing[] = (data.items || []).map((l: any) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        price: l.price,
        currency: l.currency,
        location: l.location,
        propertyType: l.property_type,     // <—
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
      <h2>Browse Properties</h2>
      <Filters value={filters} onChange={setFilters} />
      {loading && <div>Loading...</div>}
      {err && <div style={{ color: 'crimson' }}>{err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {items.map((l) => (
          <ListingCard key={l.id} l={l} />
        ))}
      </div>
    </Layout>
  );
}
