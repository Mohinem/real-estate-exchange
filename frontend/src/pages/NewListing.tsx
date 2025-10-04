import React, { useState } from 'react';
import Layout from '../components/Layout';
import ImageUpload from '../components/ImageUpload';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function NewListing() {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [ptype, setPtype] = useState<'apartment'|'house'|'villa'|'land'|'other'>('apartment');
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | undefined>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(undefined);
    try {
      const token = localStorage.getItem('jwt');
      if (!token) throw new Error('Please login first');

      const res = await fetch(`${API_URL}/listings`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: desc,
          price: Number(price),
          currency: 'INR',
          location,
          propertyType: ptype,     // server inserts into property_type
          conditions: '',
          contactInfo: '',
          // NOTE: image URLs are not persisted in demo backend;
          // you can add a /images route to store `urls` after creation.
        }),
      });

      if (!res.ok) throw new Error((await res.text()) || 'Create failed');
      const data = await res.json(); // { id, title }
      location && (window.location.href = `/listing/${data.id}`);
      if (!location) window.location.href = `/listing/${data.id}`;
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <h2>New Listing</h2>
      <form onSubmit={onSubmit}>
        <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
        <textarea placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
        <input type="number" placeholder="Price" value={price} onChange={e => setPrice(e.target.value)} />
        <input placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} />
        <select value={ptype} onChange={e => setPtype(e.target.value as any)}>
          <option>apartment</option>
          <option>house</option>
          <option>villa</option>
          <option>land</option>
          <option>other</option>
        </select>

        <ImageUpload onUrls={setUrls} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
          {urls.map(u => (
            <img key={u} src={u} width={120} />
          ))}
        </div>

        <button disabled={loading}>Create</button>
        {err && <div style={{ color: 'crimson' }}>{err}</div>}
      </form>
    </Layout>
  );
}
