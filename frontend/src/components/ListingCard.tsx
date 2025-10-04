import { Link } from 'react-router-dom';


export default function ListingCard({ l }: { l: any }) {
return (
<div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
<h3 style={{ margin: '4px 0' }}>{l.title}</h3>
<div>{l.location} · {l.propertyType} · {l.currency}{Number(l.price).toLocaleString()}</div>
<p style={{ color: '#555' }}>{l.description?.slice(0, 120)}...</p>
<Link to={`/listing/${l.id}`}>View</Link>
</div>
)
}