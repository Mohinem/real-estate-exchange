// ✅ ---------------------------------------------------------------------------
// ✅ JWT Middlewares & Route Helpers
// ✅ ---------------------------------------------------------------------------

import jwt from "jsonwebtoken";
import express from "express";
import { pool } from "./db";              // ✅ reuse the shared pool (NO new Pool())

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// 🔹 Verify JWT token
export function verifyJwt<T = any>(token: string): T {
  return jwt.verify(token, JWT_SECRET) as T;
}

// 🔹 Sign a JWT
export function signJwt(payload: any) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "14d" });
}

// 🔹 Parse Authorization header and attach payload
export function parseJwt(req: any, _res: any, next: any) {
  try {
    const h = String(req.headers.authorization || "");
    if (h.startsWith("Bearer ")) {
      const token = h.slice(7).trim();
      const payload = verifyJwt(token);
      req.jwt = payload;
      req.user = payload;
    }
  } catch {
    // ignore bad tokens
  }
  next();
}

// 🔹 Require authenticated user
export function requireAuth(req: any, res: any, next: any) {
  const uid = Number(req?.jwt?.user_id ?? req?.user?.user_id ?? NaN);
  if (!uid || Number.isNaN(uid)) {
    return res.status(401).json({ error: "auth_required" });
  }
  next();
}

// /auth/me — returns the logged-in user's profile (derive role from is_admin)
router.get("/me", parseJwt, async (req, res) => {
  try {
    const payload = req.jwt;
    if (!payload?.user_id) {
      return res.status(401).json({ error: "auth_required" });
    }

    // Derive role from is_admin (since users table has no "role" column)
    const { rows } = await pool.query(
      `
      SELECT
        id,
        email,
        display_name,
        CASE WHEN is_admin THEN 'app_admin' ELSE 'app_user' END AS role
      FROM app_public.users
      WHERE id = $1
      LIMIT 1
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
      role: u.role, // 'app_admin' | 'app_user'
    });
  } catch (err: any) {
    console.error("Error in /auth/me:", err?.message || err);
    return res.status(500).json({ error: "server_error" });
  }
});


// ✅ Default export (for use in server.ts)
export default router;
