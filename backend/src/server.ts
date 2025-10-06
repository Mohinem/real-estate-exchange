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

async function assertOwner(listingId: number, userId: number) {
  const r = await pool.query('select owner_id from app_public.listings where id=$1', [listingId]);
  if (!r.rowCount) throw new Error('listing not found');
  if (Number(r.rows[0].owner_id) !== Number(userId)) throw new Error('not owner');
}

async function ensureActiveUnreserved(listingId: number) {
  const r = await pool.query(
    `select is_active, reserved_exchange_id from app_public.listings where id=$1`,
    [listingId]
  );
  if (!r.rowCount) throw new Error('listing not found');
  const { is_active, reserved_exchange_id } = r.rows[0];
  if (!is_active) throw new Error('listing not active');
  if (reserved_exchange_id) throw new Error('listing reserved');
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

// PROPOSE a swap (sender = owner of fromListingId)
app.post('/exchange-requests', async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });

  try {
    const { fromListingId, toListingId, message, cashAdjustment = 0, currency = 'INR', expiresAt = null } = req.body ?? {};

    await assertOwner(Number(fromListingId), Number(auth.user_id));
    await ensureActiveUnreserved(Number(fromListingId));
    await ensureActiveUnreserved(Number(toListingId));

    const toOwner = await pool.query('select owner_id from app_public.listings where id=$1', [toListingId]);
    if (!toOwner.rowCount) return res.status(404).json({ error: 'target not found' });
    const toUserId = Number(toOwner.rows[0].owner_id);
    if (toUserId === Number(auth.user_id)) return res.status(400).json({ error: 'cannot propose to yourself' });

    const row = await withRlsClient(auth, async (c) => {
      const r = await c.query(
        `insert into app_public.exchange_requests
          (from_listing_id,to_listing_id,from_user_id,to_user_id,message,currency,cash_adjustment,expires_at,status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
         returning *`,
        [fromListingId, toListingId, auth.user_id, toUserId, message ?? null, String(currency).toUpperCase(), Number(cashAdjustment), expiresAt]
      );
      return r.rows[0];
    });

    res.json(row);
  } catch (e:any) {
    console.error(e);
    res.status(400).json({ error: e.message || String(e) });
  }
});

// ACCEPT (only recipient; row-locked; also creates an exchange contract + reserves both listings)
app.post('/exchange-requests/:id/accept', async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });

  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('begin');

    // lock the request
    const rq = await client.query('select * from app_public.exchange_requests where id=$1 for update', [id]);
    if (!rq.rowCount) throw new Error('not found');
    const r = rq.rows[0];
    if (r.status !== 'pending' && r.status !== 'accepted' /* counter safety */) throw new Error('not pending');
    if (Number(r.to_user_id) !== Number(auth.user_id)) throw new Error('not your request to accept');
    if (r.expires_at && new Date(r.expires_at) < new Date()) throw new Error('request expired');

    // lock both listings
    const A = await client.query('select * from app_public.listings where id=$1 for update', [r.from_listing_id]);
    const B = await client.query('select * from app_public.listings where id=$1 for update', [r.to_listing_id]);
    const a = A.rows[0], b = B.rows[0];
    if (!a?.is_active || a.reserved_exchange_id) throw new Error('counterparty listing unavailable');
    if (!b?.is_active || b.reserved_exchange_id) throw new Error('your listing unavailable');

    // create exchange
    const exch = await client.query(
      `insert into app_public.exchanges
        (listing_a_id, listing_b_id, a_user_id, b_user_id, currency, cash_adjustment_a_to_b, status)
       values ($1,$2,$3,$4,$5,$6,'active') returning *`,
      [a.id, b.id, a.owner_id, b.owner_id, r.currency, r.cash_adjustment]
    );

    // reserve both
    await client.query(
      `update app_public.listings set reserved_exchange_id=$1 where id in ($2,$3)`,
      [exch.rows[0].id, a.id, b.id]
    );

    // mark request accepted
    await client.query(
      `update app_public.exchange_requests set status='accepted', updated_at=now() where id=$1`,
      [id]
    );

    await client.query('commit');
    res.json(exch.rows[0]);
  } catch (e:any) {
    await client.query('rollback');
    console.error(e);
    res.status(400).json({ error: e.message || String(e) });
  } finally {
    client.release();
  }
});

// DECLINE (only recipient, while pending)
app.post('/exchange-requests/:id/decline', async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });

  const { rowCount } = await pool.query(
    `update app_public.exchange_requests
     set status='rejected', updated_at=now()
     where id=$1 and to_user_id=$2 and status='pending'`,
    [Number(req.params.id), Number(auth.user_id)]
  );
  if (!rowCount) return res.status(400).json({ error: 'cannot decline' });
  res.json({ ok: true });
});

// CANCEL (only sender, while pending)
app.post('/exchange-requests/:id/cancel', async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });

  const { rowCount } = await pool.query(
    `update app_public.exchange_requests
     set status='cancelled', updated_at=now()
     where id=$1 and from_user_id=$2 and status='pending'`,
    [Number(req.params.id), Number(auth.user_id)]
  );
  if (!rowCount) return res.status(400).json({ error: 'cannot cancel' });
  res.json({ ok: true });
});

// COUNTER (recipient proposes new cashAdjustment/message -> creates a new pending child request)
app.post('/exchange-requests/:id/counter', async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });
  const id = Number(req.params.id);
  const { cashAdjustment = 0, message } = req.body ?? {};

  const client = await pool.connect();
  try {
    await client.query('begin');
    const base = await client.query('select * from app_public.exchange_requests where id=$1 for update', [id]);
    if (!base.rowCount) throw new Error('not found');
    const r = base.rows[0];
    if (r.status !== 'pending') throw new Error('cannot counter now');
    if (Number(r.to_user_id) !== Number(auth.user_id)) throw new Error('only recipient can counter');

    // mark current as accepted->countered-like (reuse 'accepted' is wrong; use 'pending'->'rejected' or leave pending)
    await client.query(`update app_public.exchange_requests set status='rejected', updated_at=now() where id=$1`, [id]);

    const ins = await client.query(
      `insert into app_public.exchange_requests
        (from_listing_id,to_listing_id,from_user_id,to_user_id,message,currency,cash_adjustment,expires_at,parent_request_id,status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') returning *`,
      [r.to_listing_id, r.from_listing_id, r.to_user_id, r.from_user_id, message ?? null, r.currency, Number(cashAdjustment), r.expires_at, id]
    );
    await client.query('commit');
    res.json(ins.rows[0]);
  } catch (e:any) {
    await client.query('rollback');
    res.status(400).json({ error: e.message || String(e) });
  } finally {
    client.release();
  }
});

// List my requests
app.get('/exchange-requests/mine', async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });

  const role = String(req.query.role || 'received'); // 'sent' | 'received'
  const status = req.query.status ? String(req.query.status) : null;
  const col = role === 'sent' ? 'from_user_id' : 'to_user_id';

  const vals:any[] = [auth.user_id];
  let sql = `select * from app_public.exchange_requests where ${col}=$1`;
  if (status) { vals.push(status); sql += ` and status=$2`; }
  sql += ` order by created_at desc limit 100`;

  const { rows } = await pool.query(sql, vals);
  res.json({ items: rows });
});

// COMPLETE (either participant; closes both listings)
app.post('/exchanges/:id/complete', async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });
  const id = Number(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('begin');
    const e = await client.query('select * from app_public.exchanges where id=$1 for update', [id]);
    if (!e.rowCount) throw new Error('not found');
    const ex = e.rows[0];
    if (ex.status !== 'active') throw new Error('already finished');
    if (Number(ex.a_user_id) !== Number(auth.user_id) && Number(ex.b_user_id) !== Number(auth.user_id))
      throw new Error('not a participant');

    await client.query(
      `update app_public.exchanges set status='completed', completed_at=now() where id=$1`, [id]
    );
    await client.query(
      `update app_public.listings
         set is_active=false, exchanged_at=now(), reserved_exchange_id=null
       where id in ($1,$2)`,
      [ex.listing_a_id, ex.listing_b_id]
    );
    await client.query('commit');
    res.json({ ok: true });
  } catch (e:any) {
    await client.query('rollback');
    res.status(400).json({ error: e.message || String(e) });
  } finally {
    client.release();
  }
});

// (Optional) CANCEL active exchange (mutual or admin flow) — mark active->cancelled and unreserve listings.



// ------------ START -------------
const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`API ready on :${port}`));
