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
};

const Ctx = createContext<AuthCtx>({} as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

  async function fetchMe() {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setStatus("guest");
      return;
    }
    try {
      const r = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        mode: "cors",
        credentials: "include",
      });
      if (!r.ok) throw new Error("not authed");
      const u: User = await r.json();
      setUser(u);
      setStatus("authed");
    } catch {
      setUser(null);
      setStatus("guest");
    }
  }

  useEffect(() => {
    void fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const r = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      mode: "cors",            // <-- important for CORS
      credentials: "include",  // <-- important for CORS
    });

    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();

    if (!data?.token) throw new Error("Login OK but no token returned");
    localStorage.setItem("token", data.token);

    await fetchMe(); // hydrate context immediately
  }

  async function logout() {
    localStorage.removeItem("token");
    setUser(null);
    setStatus("guest");
  }

  return (
    <Ctx.Provider value={{ status, user, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}
