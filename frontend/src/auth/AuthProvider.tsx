// frontend/src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from "react";

type User = {
  id: number;
  email: string;
  display_name: string;
  role: "app_user" | "app_admin" | "admin";
};

type Status = "loading" | "authed" | "guest";

type AuthCtx = {
  status: Status;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

  // ---------------------------------------------------------------------------
  // fetchMe → authoritative hydration from backend
  // ---------------------------------------------------------------------------
  async function fetchMe() {
    const token = localStorage.getItem("token");
    console.groupCollapsed("%c[AuthProvider.fetchMe]", "color:#09f;font-weight:bold;");
    console.log("🔑 token:", token ? token.slice(0, 30) + "…" : "none");

    if (!token) {
      console.log("🟠 no token → guest");
      setUser(null);
      setStatus("guest");
      console.groupEnd();
      return;
    }

    try {
      console.log("📡 GET", `${API_URL}/auth/me`);
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        mode: "cors",
        credentials: "include",
      });

      if (!res.ok) throw new Error(`fetchMe failed: ${res.status}`);
      const u: User = await res.json();
      console.log("✅ /auth/me →", u);
      setUser(u);
      setStatus("authed");
    } catch (err) {
      console.warn("❌ invalid or expired token, clearing session:", err);
      localStorage.removeItem("token");
      setUser(null);
      setStatus("guest");
    } finally {
      console.groupEnd();
    }
  }

  // run once on mount to hydrate from stored token
  useEffect(() => {
    console.log("[AuthProvider] mount → starting hydration");
    void fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // login → replace old token, then hydrate
  // ---------------------------------------------------------------------------
  async function login(email: string, password: string) {
    console.groupCollapsed("%c[AuthProvider.login]", "color:#0bf;font-weight:bold;");
    console.log("👤 email:", email);

    localStorage.removeItem("token"); // prevent stale admin sessions

    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      mode: "cors",
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ login failed:", res.status, text);
      console.groupEnd();
      throw new Error(text || "login_failed");
    }

    const data = await res.json();
    if (!data?.token) throw new Error("login ok but no token returned");

    localStorage.setItem("token", data.token);
    console.log("✅ token stored; refreshing /auth/me");
    console.groupEnd();

    await fetchMe(); // authoritative re-hydration
  }

  // ---------------------------------------------------------------------------
  // logout → full reset
  // ---------------------------------------------------------------------------
  async function logout() {
    console.groupCollapsed("%c[AuthProvider.logout]", "color:#f66;font-weight:bold;");
    console.log("🧹 clearing token and resetting user");
    localStorage.removeItem("token");
    setUser(null);
    setStatus("guest");
    console.groupEnd();
  }

  // ---------------------------------------------------------------------------
  // manual refresh (for token rotation etc.)
  // ---------------------------------------------------------------------------
  async function refresh() {
    console.debug("[AuthProvider.refresh] → fetching current session");
    await fetchMe();
  }

  // ---------------------------------------------------------------------------
  // context value
  // ---------------------------------------------------------------------------
  const ctx: AuthCtx = { status, user, login, logout, refresh };
  console.log("[AuthProvider render] status:", status, "user:", user);
  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}
