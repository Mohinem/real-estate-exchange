import { Link, useLocation } from 'react-router-dom';
import React from 'react';

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium ${
        active ? 'bg-brand-100 text-brand-800' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </Link>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b bg-white">
        <div className="container flex items-center gap-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">R</span>
            <span className="text-lg font-semibold tracking-tight">RealEstate Exchange</span>
          </Link>

          <nav className="ml-4 hidden sm:flex gap-1">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/browse">Browse</NavLink>
            {token && <NavLink to="/new">New Listing</NavLink>}
            {token && <NavLink to="/dashboard">Dashboard</NavLink>}
            {token && <NavLink to="/inbox">Inbox</NavLink>}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {!token ? (
              <>
                <Link to="/login" className="px-4 py-2 text-sm rounded-md border hover:bg-gray-50">Login</Link>
                <Link to="/register" className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">
                  Create account
                </Link>
              </>
            ) : (
              <button
                className="px-4 py-2 text-sm rounded-md border hover:bg-gray-50"
                onClick={() => { localStorage.removeItem('jwt'); location.href = '/'; }}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="container py-6 text-sm text-gray-600 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} RealEstate Exchange.</p>
          <div className="flex gap-4">
            <a className="hover:text-gray-900" href="#">Terms</a>
            <a className="hover:text-gray-900" href="#">Privacy</a>
            <a className="hover:text-gray-900" href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
