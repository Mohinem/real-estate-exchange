import { Link } from 'react-router-dom';
import React from 'react';


export default function Layout({ children }: { children: React.ReactNode }) {
const token = localStorage.getItem('jwt');
return (
<div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
<header style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
<Link to="/">Home</Link>
<Link to="/browse">Browse</Link>
{token && <Link to="/new">New Listing</Link>}
{token && <Link to="/dashboard">Dashboard</Link>}
{token && <Link to="/inbox">Inbox</Link>}
<div style={{ marginLeft: 'auto' }}>
{!token ? (
<>
<Link to="/login">Login</Link>
<span> · </span>
<Link to="/register">Register</Link>
</>
) : (
<button onClick={() => { localStorage.removeItem('jwt'); location.href='/'; }}>Logout</button>
)}
</div>
</header>
{children}
</div>
);
}