import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Verify a token into a payload (throws on invalid)
export function verifyJwt<T = any>(token: string): T {
  return jwt.verify(token, JWT_SECRET) as T;
}

// Create a signed token from a payload
export function signJwt(payload: any) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '14d' });
}

/**
 * Express middleware: parse Authorization: Bearer <token>
 * and attach payload to BOTH req.jwt and req.user for compatibility.
 */
export function parseJwt(req: any, _res: any, next: any) {
  try {
    const h = String(req.headers.authorization || '');
    if (h.startsWith('Bearer ')) {
      const token = h.slice(7).trim();
      const payload = verifyJwt(token);
      req.jwt = payload;
      req.user = payload; // <-- make messages router happy
    }
  } catch {
    // ignore bad/expired tokens; request stays anonymous
  }
  next();
}

/** Guard middleware: require a logged-in user */
export function requireAuth(req: any, res: any, next: any) {
  const uid =
    Number(req?.jwt?.user_id ?? req?.user?.user_id ?? NaN); // accept either
  if (!uid || Number.isNaN(uid)) return res.status(401).json({ error: 'auth_required' });
  next();
}
