// frontend/src/lib/api.ts
// Lightweight fetch helper that adds JWT (if present) and parses JSON safely

export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080";

/** Build Headers safely — never includes undefined values */
function buildHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers();

  // Merge any caller-supplied headers first
  if (extra) {
    new Headers(extra).forEach((value, key) => headers.set(key, value));
  }

  // Always include JSON content type unless overridden
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Add Authorization only if a JWT exists
  const jwt = localStorage.getItem("jwt");
  if (jwt) headers.set("Authorization", `Bearer ${jwt}`);

  return headers;
}

/** Generic API helper that throws on error and returns parsed JSON */
export async function api<T = unknown>(
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
      const data = await res.json();
      if ((data as any)?.error) msg = (data as any).error;
    } catch {
      /* ignore JSON parse errors */
    }
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}
