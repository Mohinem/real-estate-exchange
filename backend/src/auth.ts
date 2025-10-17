// backend/src/auth.ts
// ✅ ---------------------------------------------------------------------------
// ✅ JWT Middlewares & Route Helpers (drop-in replacement)
// ✅ ---------------------------------------------------------------------------

import jwt from "jsonwebtoken";
import express from "express";
import { pool } from "./db"; // ✅ reuse the shared pool (NO new Pool())

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
type JwtPayload = {
  user_id: number;
  email?: string;
  role?: "app_user" | "app_admin" | "admin";
  [k: string]: any;
};

// -----------------------------------------------------------------------------
// Low-level JWT helpers
// -----------------------------------------------------------------------------
export function verifyJwt<T = any>(token: string): T {
  return jwt.verify(token, JWT_SECRET) as T;
}

export function signJwt(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "14d" });
}

// -----------------------------------------------------------------------------
// Middlewares
// -----------------------------------------------------------------------------

/**
 * parseJwt
 * - Reads Authorization: Bearer <token>
 * - Attaches payload to req.jwt and req.user
 * - Silently ignores bad/missing tokens
 */
export function parseJwt(req: any, _res: any, next: any) {
  try {
    const h = String(req.headers.authorization || "");
    if (h.startsWith("Bearer ")) {
      const token = h.slice(7).trim();
      const payload = verifyJwt<JwtPayload>(token);
      req.jwt = payload;
      req.user = payload; // legacy alias
    }
  } catch {
    // ignore bad tokens
  }
  next();
}

/**
 * requireAuth
 * - Ensures we have a numeric user_id on req.jwt/req.user
 * - 401 on failure
 */
export function requireAuth(req: any, res: any, next: any) {
  const uid = Number(req?.jwt?.user_id ?? req?.user?.user_id ?? NaN);
  if (!uid || Number.isNaN(uid)) {
    return res.status(401).json({ error: "auth_required" });
  }
  next();
}

/**
 * requireAdmin (authoritative)
 * - Ensures user is authenticated
 * - Accepts JWT role if present ('app_admin' or 'admin')
 * - If role missing, queries DB to derive it from users.is_admin
 * - 403 on failure
 */
export async function requireAdmin(req: any, res: any, next: any) {
  const uid = Number(req?.jwt?.user_id ?? req?.user?.user_id ?? NaN);
  if (!uid || Number.isNaN(uid)) {
    return res.status(401).json({ error: "auth_required" });
  }

  // Fast path: trust role in JWT if present
  const role = req?.jwt?.role ?? req?.user?.role;
  if (role === "app_admin" || role === "admin") {
    return next();
  }

  try {
    const { rows } = await pool.query(
      `select is_admin from app_public.users where id = $1 limit 1`,
      [uid]
    );
    if (!rows.length) return res.status(404).json({ error: "user_not_found" });

    const isAdmin = !!rows[0]?.is_admin;
    if (!isAdmin) return res.status(403).json({ error: "forbidden" });

    // Optionally hydrate role for downstream handlers
    req.jwt = { ...(req.jwt || {}), user_id: uid, role: "app_admin" };
    req.user = req.jwt;
    return next();
  } catch (err: any) {
    console.error("requireAdmin error:", err?.message || err);
    return res.status(500).json({ error: "server_error" });
  }
}

/**
 * assertAdmin (sync helper)
 * - Use inside handlers when you already called requireAuth and want a quick gate
 * - This only checks the role on req and returns boolean. Prefer requireAdmin middleware for authority.
 */
export function assertAdmin(req: any, res: any) {
  const role = req?.jwt?.role ?? req?.user?.role;
  if (role !== "app_admin" && role !== "admin") {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

/**
 * GET /auth/me
 * - Returns user profile with derived role
 * - Role mapping: is_admin => 'app_admin', else 'app_user'
 */
router.get("/me", parseJwt, async (req, res) => {
  try {
    const payload = req.jwt as JwtPayload | undefined;
    if (!payload?.user_id) {
      return res.status(401).json({ error: "auth_required" });
    }

    const { rows } = await pool.query(
      `
      select
        id,
        email,
        display_name,
        case when is_admin then 'app_admin' else 'app_user' end as role
      from app_public.users
      where id = $1
      limit 1
      `,
      [payload.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "user_not_found" });
    }

    const u = rows[0];
    return res.status(200).json({
      id: u.id,
      email: u.email,
      display_name: u.display_name,
      role: u.role as "app_admin" | "app_user",
    });
  } catch (err: any) {
    console.error("Error in /auth/me:", err?.message || err);
    return res.status(500).json({ error: "server_error" });
  }
});

// -----------------------------------------------------------------------------
// Default export (mount under /auth in server.ts)
// -----------------------------------------------------------------------------
export default router;

/*
Usage notes (server.ts):
------------------------
import authRouter, { parseJwt, requireAuth, requireAdmin } from "./auth";

app.use(parseJwt); // before protected routes
app.use("/auth", authRouter);

// Example admin route:
app.get("/admin/users", requireAdmin, async (req, res) => {
  const { rows } = await pool.query(`
    select id, email, display_name,
           case when is_admin then 'app_admin' else 'app_user' end as role
    from app_public.users
    order by id asc
  `);
  res.json(rows);
});
*/
