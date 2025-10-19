// frontend/src/lib/api.ts
// Lightweight fetch helper that adds JWT and parses JSON safely
export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080";

/** Build headers without including undefined values. */
function buildHeaders(extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  h.set("Content-Type", "application/json");
  const jwt = localStorage.getItem("jwt");
  if (jwt) h.set("Authorization", `Bearer ${jwt}`);
  return h;
}

/** Generic API helper returning parsed JSON or throwing a descriptive error. */
export async function api<T = any>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: buildHeaders(opts.headers),
  });

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore JSON parse failure */
    }
    throw new Error(msg);
  }

  return res.json();
}
