import * as React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

function decodeJwtPayload<T = any>(token: string): T | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

type Props = { children: React.ReactNode };

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-md px-3 py-2 text-sm font-medium",
    isActive ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50",
  ].join(" ");
}

export default function Layout({ children }: Props) {
  const [authed, setAuthed] = React.useState<boolean>(!!localStorage.getItem("jwt"));
  const [userName, setUserName] = React.useState<string | null>(null);
  const [unseen, setUnseen] = React.useState<number>(0);
  const navigate = useNavigate();

  // Watch login/logout across tabs
  React.useEffect(() => {
    const onStorage = () => setAuthed(!!localStorage.getItem("jwt"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Derive display name from JWT
  React.useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (!token) {
      setUserName(null);
      return;
    }
    const payload = decodeJwtPayload<any>(token);
    const name =
      payload?.display_name ||
      payload?.displayName ||
      payload?.name ||
      (payload?.email ? payload.email.split("@")[0] : null) ||
      (payload?.user_id ? `User #${payload.user_id}` : null);
    setUserName(name);
  }, [authed]);

  // Poll unseen count for received swaps
  React.useEffect(() => {
    let timer: number | undefined;

    async function refresh() {
      if (!localStorage.getItem("jwt")) {
        setUnseen(0);
        return;
      }
      try {
        const { getUnseenReceivedCount } = await import("../lib/exchanges");
        const n = await getUnseenReceivedCount();
        setUnseen(Number.isFinite(n) ? n : 0);
      } catch {
        setUnseen(0);
      }
    }

    function onFocus() {
      refresh();
    }
    function onStorage(e: StorageEvent) {
      if (e.key === "swaps:invalidate") refresh();
    }

    refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    timer = window.setInterval(refresh, 15000);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      if (timer) clearInterval(timer);
    };
  }, [authed]);

  // ✅ Fixed logout (client-side navigation, no reload)
  function logout(e?: React.MouseEvent) {
    e?.preventDefault?.();
    localStorage.removeItem("jwt");
    try {
      localStorage.setItem("swaps:invalidate", String(Date.now()));
    } catch {}
    setAuthed(false);
    setUserName(null);
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[--color-brand-500] text-white flex items-center justify-center font-bold">
                R
              </div>
              <span className="hidden sm:block text-sm font-semibold">
                Real Estate Exchange
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/browse" className={navClass}>
                Home
              </NavLink>
              <NavLink to="/new" className={navClass}>
                New Listing
              </NavLink>
              {authed && (
                <>
                  <NavLink to="/dashboard" className={navClass}>
                    Dashboard
                  </NavLink>
                  <NavLink to="/swaps" className={navClass}>
                    <span className="relative inline-flex items-center">
                      My Swaps
                      {unseen > 0 && (
                        <span
                          className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white"
                          aria-label={`${unseen} unseen swaps`}
                          title={`${unseen} unseen swaps`}
                        >
                          {unseen > 99 ? "99+" : unseen}
                        </span>
                      )}
                    </span>
                  </NavLink>
                  <NavLink to="/inbox" className={navClass}>
                    Inbox
                  </NavLink>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {authed && userName && (
              <div className="text-sm text-gray-600">
                Welcome, <span className="font-medium text-gray-900">{userName}</span>
              </div>
            )}
            {authed ? (
              <button
                onClick={logout}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 transition"
              >
                Logout
              </button>
            ) : (
              <>
                <Link to="/login" className="rounded-md border px-3 py-1.5 text-sm">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-md bg-[--color-brand-500] px-3 py-1.5 text-sm text-white hover:bg-[--color-brand-600]"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 text-sm text-gray-600 flex items-center justify-between">
          <div>© {new Date().getFullYear()} Real Estate Exchange.</div>
          <div className="flex gap-4">
            <a className="hover:underline" href="#">
              Terms
            </a>
            <a className="hover:underline" href="#">
              Privacy
            </a>
            <a className="hover:underline" href="#">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
