import React from 'react';
import Layout from '../components/Layout';
import { useParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function ListingDetail() {
  const { id } = useParams();
  const [listing, setListing] = React.useState<any>(null);
  const [images, setImages] = React.useState<any[]>([]);
  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | undefined>();

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(undefined);

        // 1) Listing + images
        const r1 = await fetch(`${API_URL}/listings/${id}`);
        if (!r1.ok) throw new Error(await r1.text());
        const d1 = await r1.json(); // { listing, images }
        if (!alive) return;
        setListing(d1.listing);
        setImages(d1.images || []);

        // 2) Suggestions
        const r2 = await fetch(`${API_URL}/listings/${id}/suggest?pct=15`);
        if (!r2.ok) throw new Error(await r2.text());
        const d2 = await r2.json(); // { items: [...] }
        if (!alive) return;
        setSuggestions(d2.items || []);
      } catch (e: any) {
        if (alive) setErr(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  async function proposeExchange(toId: number) {
    try {
      const token = localStorage.getItem('jwt');
      if (!token) { alert('Please login first'); return; }
      const res = await fetch(`${API_URL}/exchanges`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromListingId: Number(id),
          toListingId: toId,
          message: 'Interested in exchanging',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await res.json();
      alert('Exchange request sent!');
    } catch (e: any) {
      alert(e.message || String(e));
    }
  }

  if (loading) return <Layout><div>Loading...</div></Layout>;
  if (err) return <Layout><div style={{ color: 'crimson' }}>{err}</div></Layout>;
  if (!listing) return <Layout><div>Not found</div></Layout>;

  // Note: REST returns snake_case keys from the DB
  const priceStr = `${listing.currency || ''}${Number(listing.price).toLocaleString()}`;

  return (
    <Layout>
      <h2>{listing.title}</h2>
      <div>{listing.location} · {listing.property_type} · {priceStr}</div>
      <p>{listing.description}</p>

      {images.length > 0 && (
        <>
          <h3>Photos</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {images.map((img: any) => <img key={img.id} src={img.url} width={160} />)}
          </div>
        </>
      )}

      <h3>Suggested Matches</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {suggestions.map((m: any) => (
          <div key={m.id} style={{ border: '1px solid #ddd', padding: 8 }}>
            <div><b>{m.title}</b></div>
            <div>
              {m.location} · {m.property_type} · {m.currency}{Number(m.price).toLocaleString()}
            </div>
            <button onClick={() => proposeExchange(m.id)}>Propose Exchange</button>
          </div>
        ))}
      </div>
    </Layout>
  );
}
