import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { parseJwt, signJwt } from './auth';
import { pool, withRlsClient } from './db';

const app = express();

// CORS
const allowed = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: allowed.length ? allowed : true, credentials: true }));

app.use(express.json({ limit: '10mb' }));
app.use(parseJwt);

app.get('/health', (_req, res) => res.json({ ok: true }));

// ------------ AUTH -------------
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const userRes = await pool.query<{id:number; password_hash:string; is_admin:boolean}>(
      'select id, password_hash, is_admin from app_public.users where email = $1',
      [email]
    );
    if (userRes.rowCount === 0) return res.status(401).json({ error: 'invalid credentials' });

    const u = userRes.rows[0];
    const okRes = await pool.query<{ok:boolean}>('select app_private.check_password($1,$2) as ok',[u.password_hash,password]);
    if (!okRes.rows[0]?.ok) return res.status(401).json({ error: 'invalid credentials' });

    const role = u.is_admin ? 'app_admin' : 'app_user' as const;
    const token = signJwt({ user_id: u.id, role });
    return res.json({ token, user: { id: u.id, email, role } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
});

// small helper to read auth from parsed JWT
function authFromReq(req: any) {
  const jwt = (req?.jwt ?? {}) as { user_id?: number; role?: 'app_user'|'app_admin' };
  return { role: (jwt.role ?? 'anonymous') as 'anonymous'|'app_user'|'app_admin', user_id: jwt.user_id };
}

// ------------ REGISTER -------------
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body ?? {};
    if (!email || !password || !displayName) return res.status(400).json({ error: 'email, password, displayName required' });

    const row = await withRlsClient({ role: 'anonymous' }, async (c) => {
      const r = await c.query(
        'select * from app_public.register($1,$2,$3)',
        [email, password, displayName]
      );
      return r.rows[0];
    });
    res.json({ user: row });
  } catch (e:any) {
    console.error(e);
    res.status(400).json({ error: String(e.message || e) });
  }
});

// ------------ LISTINGS -------------
app.get('/listings', async (req, res) => {
  const { location, propertyType, minPrice, maxPrice, limit = 12, offset = 0 } = req.query as any;
  const auth = authFromReq(req);
  try {
    const rows = await withRlsClient(auth, async (c) => {
      const parts: string[] = ['is_active = true'];
      const vals: any[] = [];
      if (location) { vals.push(`%${location}%`); parts.push(`location ilike $${vals.length}`); }
      if (propertyType) { vals.push(propertyType); parts.push(`property_type = $${vals.length}::app_public.property_type`); }
      if (minPrice) { vals.push(Number(minPrice)); parts.push(`price >= $${vals.length}`); }
      if (maxPrice) { vals.push(Number(maxPrice)); parts.push(`price <= $${vals.length}`); }
      vals.push(Number(limit)); vals.push(Number(offset));
      const sql = `
        select id, title, description, price, currency, location, property_type, conditions, owner_id, created_at
        from app_public.listings
        where ${parts.join(' and ')}
        order by created_at desc
        limit $${vals.length-1} offset $${vals.length}
      `;
      const r = await c.query(sql, vals);
      return r.rows;
    });
    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/listings/:id', async (req, res) => {
  const auth = authFromReq(req);
  try {
    const data = await withRlsClient(auth, async (c) => {
      const l = await c.query('select * from app_public.listings where id=$1', [Number(req.params.id)]);
      if (l.rowCount === 0) return null;
      const imgs = await c.query('select id, url from app_public.images where listing_id=$1 order by id asc', [Number(req.params.id)]);
      return { listing: l.rows[0], images: imgs.rows };
    });
    if (!data) return res.status(404).json({ error: 'not found' });
    res.json(data);
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); }
});

app.post('/listings', async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });

  try {
    const b = req.body ?? {};

    // Normalize + validate input (accept both camelCase and snake_case)
    const payload = {
      title: String(b.title ?? '').trim(),
      description: b.description ?? null,
      price: Number(b.price),
      currency: String(b.currency ?? 'INR').toUpperCase(),
      location: String(b.location ?? '').trim(),
      property_type: String(b.propertyType ?? b.property_type ?? '').toLowerCase(),
      conditions: b.conditions ?? null,
      contact_info: b.contactInfo ?? b.contact_info ?? null,
    };

    // Required fields
    if (!payload.title || !payload.location || !isFinite(payload.price)) {
      return res.status(400).json({ error: 'title, location and price are required' });
    }

    // property_type must be a valid enum value
    const allowed = new Set(['apartment', 'house', 'villa', 'land', 'other']);
    if (!allowed.has(payload.property_type)) {
      return res.status(400).json({ error: 'invalid propertyType (use apartment|house|villa|land|other)' });
    }

    const row = await withRlsClient(auth, async (c) => {
      const r = await c.query(
        `insert into app_public.listings
           (title, description, price, currency, location, property_type, conditions, contact_info)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning id, title`,
        [
          payload.title,
          payload.description,
          payload.price,
          payload.currency,
          payload.location,
          payload.property_type,
          payload.conditions,
          payload.contact_info,
        ],
      );
      return r.rows[0];
    });

    res.json(row);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message || String(e) });
  }
});

app.get('/listings/:id/suggest', async (req, res) => {
  const auth = authFromReq(req);
  try {
    const pct = Number(req.query.pct ?? 15);
    const rows = await withRlsClient(auth, async (c) => {
      const r = await c.query('select * from app_public.suggest_matches($1,$2)', [Number(req.params.id), pct]);
      return r.rows;
    });
    res.json({ items: rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); }
});

// ------------ EXCHANGES -------------
app.post('/exchanges', async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });
  try {
    const { fromListingId, toListingId, message } = req.body ?? {};
    const row = await withRlsClient(auth, async (c) => {
      const r = await c.query(
        `insert into app_public.exchange_requests(from_listing_id,to_listing_id,message)
         values ($1,$2,$3) returning id, status`,
        [fromListingId, toListingId, message ?? null]
      );
      return r.rows[0];
    });
    res.json(row);
  } catch (e:any) { console.error(e); res.status(400).json({ error: String(e.message || e) }); }
});

// ------------ MESSAGES -------------
app.post('/messages', async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });
  try {
    const { exchangeId, body } = req.body ?? {};
    const row = await withRlsClient(auth, async (c) => {
      const r = await c.query(
        `insert into app_public.messages(exchange_id, sender_id, body)
         values ($1, (current_setting('jwt.claims.user_id',true))::int, $2)
         returning id, body, created_at`,
        [exchangeId, body]
      );
      return r.rows[0];
    });
    res.json(row);
  } catch (e:any) { console.error(e); res.status(400).json({ error: String(e.message || e) }); }
});

// Get current user listings
app.get('/api/listings/mine', async (req, res) => {
    const auth = (req as any).jwt || { role: 'anonymous' };
    try {
      const rows = await withRlsClient(auth, client =>
        client.query('select * from app_public.listings where owner_id = current_setting(\'jwt.claims.user_id\', true)::int')
      );
      res.json(rows.rows);
    } catch (e) {
      console.error(e);
      res.status(500).send('Error fetching listings');
    }
  });
  
  // Delete a listing
  app.delete('/api/listings/:id', async (req, res) => {
    const auth = (req as any).jwt || { role: 'anonymous' };
    const { id } = req.params;
    try {
      await withRlsClient(auth, client =>
        client.query('delete from app_public.listings where id = $1', [id])
      );
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).send('Error deleting listing');
    }
  });  

// Update a listing (owner only via RLS)
app.put('/api/listings/:id', async (req, res) => {
    const auth = (req as any).jwt || { role: 'anonymous' };
    if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });
  
    const { id } = req.params;
    const {
      title, description, price, currency, location,
      propertyType, conditions, contactInfo,
    } = req.body ?? {};
  
    try {
      const row = await withRlsClient(auth, async client => {
        const r = await client.query(
          `
          update app_public.listings set
            title         = coalesce($2, title),
            description   = coalesce($3, description),
            price         = coalesce($4, price),
            currency      = coalesce($5, currency),
            location      = coalesce($6, location),
            property_type = coalesce($7::app_public.property_type, property_type),
            conditions    = coalesce($8, conditions),
            contact_info  = coalesce($9, contact_info),
            updated_at    = now()
          where id = $1
          returning id, title, description, price, currency, location, property_type, conditions, contact_info
          `,
          [
            Number(id),
            title ?? null,
            description ?? null,
            price != null ? Number(price) : null,
            currency ?? null,
            location ?? null,
            propertyType ?? null,
            conditions ?? null,
            contactInfo ?? null,
          ]
        );
        return r.rows[0];
      });
  
      if (!row) return res.status(404).json({ error: 'not found' });
      res.json(row);
    } catch (e:any) {
      console.error(e);
      res.status(400).json({ error: e.message || String(e) });
    }
  });  

// Update a listing
app.put('/api/listings/:id', async (req, res) => {
    const auth = (req as any).jwt || { role: 'anonymous' };
    if (auth.role === 'anonymous') {
      return res.status(401).json({ error: 'Login required' });
    }
  
    const { id } = req.params;
    const {
      title, description, price, currency, location,
      propertyType, conditions, contactInfo
    } = req.body || {};
  
    try {
      const row = await withRlsClient(auth, async client => {
        const r = await client.query(
          `
          update app_public.listings set
            title = coalesce($2, title),
            description = coalesce($3, description),
            price = coalesce($4, price),
            currency = coalesce($5, currency),
            location = coalesce($6, location),
            property_type = coalesce($7::app_public.property_type, property_type),
            conditions = coalesce($8, conditions),
            contact_info = coalesce($9, contact_info),
            updated_at = now()
          where id = $1
          returning id, title, description, price, currency, location, property_type, conditions, contact_info
          `,
          [
            Number(id),
            title ?? null,
            description ?? null,
            price != null ? Number(price) : null,
            currency ?? null,
            location ?? null,
            propertyType ?? null,
            conditions ?? null,
            contactInfo ?? null,
          ]
        );
        return r.rows[0];
      });
  
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Update failed' });
    }
  });

// ------------ START -------------
const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`API ready on :${port}`));
