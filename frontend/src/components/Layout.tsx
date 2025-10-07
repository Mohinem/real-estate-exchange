// frontend/src/components/Layout.tsx
import * as React from "react";
import { Link, NavLink } from "react-router-dom";

type Props = { children: React.ReactNode };

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-md px-3 py-2 text-sm font-medium",
    isActive ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50",
  ].join(" ");
}

export default function Layout({ children }: Props) {
  const [authed, setAuthed] = React.useState<boolean>(!!localStorage.getItem("jwt"));

  React.useEffect(() => {
    const onStorage = () => setAuthed(!!localStorage.getItem("jwt"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function logout() {
    localStorage.removeItem("jwt");
    setAuthed(false);
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[--color-brand-500] text-white flex items-center justify-center font-bold">R</div>
              <span className="hidden sm:block text-sm font-semibold">Real Estate Exchange</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/browse" className={navClass}>Home</NavLink>
              <NavLink to="/new" className={navClass}>New Listing</NavLink>
              {authed && <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>}
              {/* 👇 new link */}
              {authed && <NavLink to="/swaps" className={navClass}>My Swaps</NavLink>}
              {authed && <NavLink to="/inbox" className={navClass}>Inbox</NavLink>}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {authed ? (
              <button onClick={logout} className="rounded-md border px-3 py-1.5 text-sm">Logout</button>
            ) : (
              <>
                <Link to="/login" className="rounded-md border px-3 py-1.5 text-sm">Login</Link>
                <Link to="/register" className="rounded-md bg-[--color-brand-500] px-3 py-1.5 text-sm text-white">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="mt-12 border-t bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 text-sm text-gray-600 flex items-center justify-between">
          <div>© {new Date().getFullYear()} Real Estate Exchange.</div>
          <div className="flex gap-4">
            <a className="hover:underline" href="#">Terms</a>
            <a className="hover:underline" href="#">Privacy</a>
            <a className="hover:underline" href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
