import Layout from '../components/Layout';
import React, { useEffect, useState } from 'react';

type Listing = {
  id: number;
  title: string;
  description: string;
  price: number;
  currency: string;
  location: string;
  property_type: 'apartment'|'house'|'villa'|'land'|'other';
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function Dashboard() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<Listing>>({});

  async function fetchListings() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/api/listings/mine`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('jwt') || ''}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json(); // array of rows with snake_case
      setListings(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchListings();
  }, []);

  function startEdit(l: Listing) {
    setEditingId(l.id);
    setDraft({
      id: l.id,
      title: l.title,
      description: l.description,
      price: l.price,
      currency: l.currency,
      location: l.location,
      property_type: l.property_type,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({});
  }

  async function saveEdit() {
    if (editingId == null) return;
    try {
      const res = await fetch(`${API_URL}/api/listings/${editingId}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('jwt') || ''}`,
        },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          price: draft.price,
          currency: draft.currency,
          location: draft.location,
          propertyType: draft.property_type, // server expects enum type
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setListings(ls => ls.map(l => (l.id === updated.id ? updated : l)));
      cancelEdit();
    } catch (e:any) {
      alert(e.message || 'Save failed');
    }
  }

  async function deleteListing(id: number) {
    if (!confirm('Delete this listing?')) return;
    try {
      const res = await fetch(`${API_URL}/api/listings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('jwt') || ''}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setListings(ls => ls.filter(l => l.id !== id));
    } catch (err:any) {
      alert(err.message || 'Delete failed');
    }
  }

  return (
    <Layout>
      <h2>My Listings</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
        {listings.map(l => {
          const isEditing = editingId === l.id;
          return (
            <div key={l.id} style={{ border:'1px solid #ddd', padding:12, borderRadius:8 }}>
              {!isEditing ? (
                <>
                  <h3>{l.title}</h3>
                  <p>{l.location} · {l.property_type} · {l.currency}{Number(l.price).toLocaleString()}</p>
                  <p>{l.description}</p>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => deleteListing(l.id)}>Delete</button>
                    <button onClick={() => startEdit(l)}>Edit</button>
                  </div>
                </>
              ) : (
                <>
                  <h3>Edit Listing</h3>
                  <div style={{ display:'grid', gap:8 }}>
                    <input
                      placeholder="Title"
                      value={draft.title ?? ''}
                      onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                    />
                    <textarea
                      placeholder="Description"
                      value={draft.description ?? ''}
                      onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      value={draft.price ?? ''}
                      onChange={e => setDraft(d => ({ ...d, price: Number(e.target.value) }))}
                    />
                    <input
                      placeholder="Currency"
                      value={draft.currency ?? 'INR'}
                      onChange={e => setDraft(d => ({ ...d, currency: e.target.value }))}
                    />
                    <input
                      placeholder="Location"
                      value={draft.location ?? ''}
                      onChange={e => setDraft(d => ({ ...d, location: e.target.value }))}
                    />
                    <select
                      value={draft.property_type ?? 'apartment'}
                      onChange={e => setDraft(d => ({ ...d, property_type: e.target.value as Listing['property_type'] }))}
                    >
                      <option>apartment</option>
                      <option>house</option>
                      <option>villa</option>
                      <option>land</option>
                      <option>other</option>
                    </select>
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                    <button onClick={saveEdit}>Save</button>
                    <button onClick={cancelEdit}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
