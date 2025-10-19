// src/lib/http.ts
export function authHeaders(opts?: { json?: boolean }): Headers {
    const h = new Headers();
    if (opts?.json) h.set("Content-Type", "application/json");
    const token = localStorage.getItem("token");
    if (token) h.set("Authorization", `Bearer ${token}`);
    return h;
  }
  
  // (optional) small wrapper
  export function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
    const h = new Headers(init?.headers as HeadersInit);
    const token = localStorage.getItem("token");
    if (token && !h.has("Authorization")) h.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers: h });
  }
  