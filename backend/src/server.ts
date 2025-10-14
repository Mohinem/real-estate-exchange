import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { parseJwt, signJwt } from './auth';
import { pool, withRlsClient } from './db';
import { makeMessagesRouter } from './messages';

const app = express();

// CORS
const allowed = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: allowed.length ? allowed : true, credentials: true }));

app.use(express.json({ limit: '10mb' }));
app.use(parseJwt);

app.use('/inbox', makeMessagesRouter(pool));

app.get('/health', (_req, res) => res.json({ ok: true }));

// ------------ AUTH -------------
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    // include display_name (and email) in the select + types
    const userRes = await pool.query<{
      id: number;
      password_hash: string;
      is_admin: boolean;
      display_name: string;
      email: string;
    }>(
      'select id, password_hash, is_admin, display_name, email from app_public.users where email = $1',
      [email]
    );
    if (userRes.rowCount === 0) return res.status(401).json({ error: 'invalid credentials' });

    const u = userRes.rows[0];
    const okRes = await pool.query<{ ok: boolean }>(
      'select app_private.check_password($1,$2) as ok',
      [u.password_hash, password]
    );
    if (!okRes.rows[0]?.ok) return res.status(401).json({ error: 'invalid credentials' });

    const role = u.is_admin ? 'app_admin' : ('app_user' as const);

    // include display_name + email in JWT so frontend can show name
    const token = signJwt({
      user_id: u.id,
      role,
      display_name: u.display_name,
      email: u.email,
    });

    // also include it in the response body for immediate use if you want
    return res.json({
      token,
      user: { id: u.id, email: u.email, display_name: u.display_name, role },
    });
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
      const parts: string[] = ['is_active = true', 'reserved_exchange_id is null'];
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
  const auth = (req as any).jwt || { role: 'anonymous' };
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });

  const { exchangeId, body } = req.body ?? {};
  if (!exchangeId || !String(body).trim()) return res.status(400).json({ error: 'invalid payload' });

  const q = await pool.query(
    `select from_user_id, to_user_id from app_public.exchange_requests where id=$1`,
    [exchangeId]
  );
  if (!q.rowCount) return res.status(404).json({ error: 'exchange_not_found' });

  const { from_user_id, to_user_id } = q.rows[0];
  const me = Number((req as any).jwt?.user_id);
  if (me !== from_user_id && me !== to_user_id) return res.status(403).json({ error: 'forbidden' });
  const recipient = me === from_user_id ? to_user_id : from_user_id;

  const row = await withRlsClient((req as any).jwt, async (c) => {
    const r = await c.query(
      `insert into app_public.messages (exchange_id, from_user_id, to_user_id, body)
       values ($1,$2,$3,$4)
       returning id, exchange_id, from_user_id, to_user_id, body, is_read, created_at`,
      [exchangeId, me, recipient, String(body).trim()]
    );
    return r.rows[0];
  });

  res.json(row);
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
    const { fromListingId, toListingId, cashAdjustment = 0, currency = 'INR', message } = req.body ?? {};
    if (!fromListingId || !toListingId) return res.status(400).json({ error: 'fromListingId and toListingId required' });

    // the current user must own the fromListingId
    await assertOwner(Number(fromListingId), Number(auth.user_id));

    const row = await withRlsClient(auth, async c => {
      const r = await c.query(
        `
        insert into app_public.exchange_requests
          (from_listing_id, to_listing_id, message, cash_adjustment, currency, from_user_id, to_user_id)
        values (
          $1, $2, $3, $4, $5,
          (select owner_id from app_public.listings where id = $1),
          (select owner_id from app_public.listings where id = $2)
        )
        returning *
        `,
        [
          Number(fromListingId),
          Number(toListingId),
          message ?? null,
          Number(cashAdjustment) || 0,
          String(currency || 'INR'),
        ]
      );
      return r.rows[0];
    });

    res.json(row);
  } catch (e:any) {
    console.error(e);
    res.status(400).json({ error: e.message || String(e) });
  }
});

// ACCEPT (only recipient; creates an exchanges row and reserves listings) — robust + diagnostics + rollback
app.post("/exchange-requests/:id/accept", async (req, res) => {
  const auth = authFromReq(req);
  console.log("🔹 [ACCEPT] start", { user: auth, params: req.params });

  if (auth.role === "anonymous") {
    console.log("⛔ [ACCEPT] anonymous");
    return res.status(401).json({ error: "auth required" });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

  try {
    const result = await withRlsClient(auth, async (c) => {
      await c.query("begin");
      console.log("🔸 [ACCEPT] tx begun for id", id);

      try {
        // 1) Fetch ER visible to this user; compute owners via scalar subqueries
        const erQ = await c.query(
          `
          select
            er.id,
            er.status,
            er.from_listing_id,
            er.to_listing_id,
            coalesce(er.currency, 'INR')    as currency,
            coalesce(er.cash_adjustment, 0) as cash_adjustment,
            (select owner_id from app_public.listings where id = er.from_listing_id) as from_owner_id,
            (select owner_id from app_public.listings where id = er.to_listing_id)   as to_owner_id
          from app_public.exchange_requests er
          where er.id = $1
          for update
          `,
          [id]
        );

        console.log("🔸 [ACCEPT] fetched", {
          rowCount: erQ.rowCount,
          row: erQ.rows[0],
        });

        if (!erQ.rowCount) {
          console.log("⚠️  [ACCEPT] no row visible to user (RLS) or wrong id");
          await c.query("rollback");
          return { ok: false, code: 404, reason: "not visible / not found" };
        }

        const er = erQ.rows[0];
        const me = Number(auth.user_id);
        const toOwner = Number(er.to_owner_id);
        console.log("🔸 [ACCEPT] ownership check", { me, toOwner });

        if (me !== toOwner) {
          console.log("⛔ [ACCEPT] user is not the recipient owner");
          await c.query("rollback");
          return { ok: false, code: 403, reason: "not recipient owner" };
        }

        if (er.status !== "pending") {
          console.log("⛔ [ACCEPT] status not pending", { status: er.status });
          await c.query("rollback");
          return { ok: false, code: 409, reason: "not pending" };
        }

        // 2) Mark ER accepted
        await c.query(
          `update app_public.exchange_requests
             set status='accepted', updated_at=now()
           where id=$1`,
          [id]
        );
        console.log("✅ [ACCEPT] ER marked accepted");

        // 3) Create exchange row
        const exIns = await c.query(
          `
          insert into app_public.exchanges
            (listing_a_id, listing_b_id,
             a_user_id,    b_user_id,
             currency, cash_adjustment_a_to_b,
             status,  created_at)
          values ($1,$2,$3,$4,$5,$6,'active', now())
          returning id
          `,
          [
            Number(er.from_listing_id),
            Number(er.to_listing_id),
            Number(er.from_owner_id),
            Number(er.to_owner_id),
            er.currency,
            Number(er.cash_adjustment) || 0,
          ]
        );
        const exchangeId = exIns.rows[0].id;
        console.log("✅ [ACCEPT] exchange created", { exchangeId });

        // 4) Reserve both listings with exchangeId FK
        console.log("🔸 [ACCEPT] reserving listings", {
          exchangeId,
          from: er.from_listing_id,
          to: er.to_listing_id,
        });

        await c.query(
          `
          update app_public.listings
             set reserved_exchange_id = $1
           where id in ($2,$3)
          `,
          [exchangeId, Number(er.from_listing_id), Number(er.to_listing_id)]
        );

        console.log("✅ [ACCEPT] listings reserved");
        await c.query("commit");
        console.log("✅ [ACCEPT] commit");
        return { ok: true, exchangeId };
      } catch (inner) {
        console.error("🔥 [ACCEPT] inner error — rolling back:", (inner as any)?.message);
        await c.query("rollback");
        throw inner; // let outer catch map it to HTTP
      }
    });

    if (!result.ok) {
      console.warn("⚠️  [ACCEPT] failure", result);
      const code = result.code === 403 ? 403 : result.code === 409 ? 409 : 404;
      return res.status(code).json({ error: result.reason || "not found or not allowed" });
    }

    res.json({ ok: true, exchangeId: result.exchangeId });
  } catch (e: any) {
    console.error("🔥 [ACCEPT] exception:", e.message, e.stack);
    return res.status(400).json({ error: e.message || String(e) });
  }
});


app.post('/exchanges/:id/complete', async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });
  const id = Number(req.params.id);

  try {
    await withRlsClient(auth, async (client) => {
      await client.query('begin');

      const e = await client.query('select * from app_public.exchanges where id=$1 for update', [id]);
      if (!e.rowCount) throw new Error('not found');
      const ex = e.rows[0];
      if (ex.status !== 'active') throw new Error('already finished');
      if (Number(ex.a_user_id) !== Number(auth.user_id) && Number(ex.b_user_id) !== Number(auth.user_id))
        throw new Error('not a participant');

      // First update listings (policy allows participants)
      await client.query(
        `update app_public.listings
           set is_active=false, exchanged_at=now(), reserved_exchange_id=null
         where id in ($1,$2)`,
        [ex.listing_a_id, ex.listing_b_id]
      );

      // Then close the exchange
      await client.query(
        `update app_public.exchanges set status='completed', completed_at=now() where id=$1`, [id]
      );

      await client.query('commit');
    });

    res.json({ ok: true });
  } catch (e:any) {
    console.error(e);
    res.status(400).json({ error: e.message || String(e) });
  }
});

// DECLINE (only recipient, while pending)
app.post("/exchange-requests/:id/decline", async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === "anonymous") return res.status(401).json({ error: "auth required" });
  const id = Number(req.params.id);

  try {
    const ok = await withRlsClient(auth, async (c) => {
      const r = await c.query(
        `
        select er.id
        from app_public.exchange_requests er
        join app_public.listings l_to on l_to.id = er.to_listing_id
        where er.id = $1
          and l_to.owner_id = current_setting('jwt.claims.user_id')::int
        `,
        [id]
      );
      if (!r.rowCount) return false;

      await c.query(
        `update app_public.exchange_requests set status='rejected', updated_at=now() where id=$1`,
        [id]
      );
      return true;
    });

    if (!ok) return res.status(404).json({ error: "listing not found or not allowed" });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message || String(e) });
  }
});

// CANCEL (only sender, while pending)
app.post("/exchange-requests/:id/cancel", async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === "anonymous") return res.status(401).json({ error: "auth required" });

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid id" });

  try {
    const ok = await withRlsClient(auth, async (c) => {
      // Only the SENDER (owner of from_listing_id) can cancel, and only while 'pending'
      const r = await c.query(
        `
        update app_public.exchange_requests er
        set status = 'cancelled', updated_at = now()
        where er.id = $1
          and er.status = 'pending'
          and exists (
            select 1
            from app_public.listings l
            where l.id = er.from_listing_id
              and l.owner_id = current_setting('jwt.claims.user_id', true)::int
          )
        `,
        [id]
      );

      // rowCount is number | null — coalesce to 0
      const affected = Number(r?.rowCount ?? 0);
      return affected > 0;
    });

    if (!ok) return res.status(404).json({ error: "not found or not allowed" });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message || String(e) });
  }
});

// COUNTER (recipient proposes new cashAdjustment/message)
app.post("/exchange-requests/:id/counter", async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === "anonymous") return res.status(401).json({ error: "auth required" });

  const id = Number(req.params.id);
  const { cashAdjustment, message } = req.body || {};

  try {
    const result = await withRlsClient(auth, async (c) => {
      // Get original + make sure current user owns the 'to' listing (recipient)
      const r = await c.query(
        `
        select er.*
        from app_public.exchange_requests er
        join app_public.listings l_to on l_to.id = er.to_listing_id
        where er.id = $1
          and l_to.owner_id = current_setting('jwt.claims.user_id')::int
        `,
        [id]
      );
      if (!r.rowCount) return null;
      const orig = r.rows[0];

      // Mark original as rejected (history)
      await c.query(`update app_public.exchange_requests set status='rejected', updated_at=now() where id=$1`, [id]);

      // Create the counter: swap from/to + set user columns
      const ins = await c.query(
        `
        insert into app_public.exchange_requests
          (from_listing_id, to_listing_id, from_user_id, to_user_id,
           cash_adjustment, currency, message, status, created_at, updated_at)
        values (
          $1, $2,
          (select owner_id from app_public.listings where id = $1),
          (select owner_id from app_public.listings where id = $2),
          $3, coalesce($4,'INR'), $5, 'pending', now(), now()
        )
        returning *
        `,
        [
          orig.to_listing_id,          // now proposing from the recipient's listing
          orig.from_listing_id,        // targeting the original sender's listing
          Number(cashAdjustment) || 0,
          orig.currency || 'INR',
          message || null,
        ]
      );

      return ins.rows[0];
    });

    if (!result) return res.status(404).json({ error: "not allowed or not found" });
    res.json({ ok: true, counter: result });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message || String(e) });
  }
});


// List my requests (no-cache; marks received as seen)
app.get('/exchange-requests/mine', async (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
    'Vary': 'Authorization',
  });

  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });

  const roleRaw = String(req.query.role ?? 'received').toLowerCase();
  const role = roleRaw === 'sent' ? 'sent' : roleRaw === 'received' ? 'received' : null;
  if (!role) return res.status(400).json({ error: 'role must be received|sent' });

  try {
    const rows = await withRlsClient(auth, async (c) => {
      if (role === 'received') {
        // Mark all my pending received requests as seen
        await c.query(
          `update app_public.exchange_requests
             set is_seen = true, updated_at = now()
           where to_user_id = current_setting('jwt.claims.user_id',true)::int
             and status = 'pending'
             and is_seen = false`
        );
      }

      const sql =
        role === 'received'
          ? `select * from app_public.exchange_requests
               where to_user_id = current_setting('jwt.claims.user_id',true)::int
               order by created_at desc
               limit 100`
          : `select * from app_public.exchange_requests
               where from_user_id = current_setting('jwt.claims.user_id',true)::int
               order by created_at desc
               limit 100`;
      const r = await c.query(sql);
      return r.rows;
    });

    return res.json({ items: rows });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
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

// Unseen count for received swaps (pending only)
app.get('/exchange-requests/unseen-count', async (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
    'Vary': 'Authorization',
  });

  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.json({ count: 0 });

  try {
    const { rows } = await withRlsClient(auth, (c) =>
      c.query(
        `select count(*)::int as count
           from app_public.exchange_requests
          where to_user_id = current_setting('jwt.claims.user_id',true)::int
            and status = 'pending'
            and is_seen = false`
      )
    );
    return res.json({ count: rows[0]?.count ?? 0 });
  } catch (e) {
    console.error(e);
    return res.json({ count: 0 });
  }
});

// --- Unseen received swaps: count ---
app.get('/exchange-requests/unseen-count', async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });

  try {
    const row = await withRlsClient(auth, async c => {
      const r = await c.query(
        `
        select count(*)::int as count
        from app_public.exchange_requests er
        where er.to_user_id = current_setting('jwt.claims.user_id', true)::int
          and coalesce(er.is_seen, false) = false
          and er.status = 'pending'
        `
      );
      return r.rows[0] || { count: 0 };
    });
    res.json(row);
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

// --- Mark all currently unseen received swaps as seen ---
app.post('/exchange-requests/mark-seen', async (req, res) => {
  const auth = authFromReq(req);
  if (auth.role === 'anonymous') return res.status(401).json({ error: 'auth required' });

  try {
    const info = await withRlsClient(auth, async c => {
      const r = await c.query(
        `
        update app_public.exchange_requests er
           set is_seen = true,
               updated_at = now()
         where er.to_user_id = current_setting('jwt.claims.user_id', true)::int
           and coalesce(er.is_seen, false) = false
           and er.status = 'pending'
        `
      );
      return { updated: Number(r.rowCount || 0) };
    });
    res.json(info);
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});



// (Optional) CANCEL active exchange (mutual or admin flow) — mark active->cancelled and unreserve listings.



// ------------ START -------------
const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`API ready on :${port}`));
