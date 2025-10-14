import { Router } from 'express';
import type { Pool } from 'pg';
import { requireAuth } from './auth';

function getUserId(req: any): number {
  return Number(req?.jwt?.user_id ?? req?.user?.user_id);
}

export function makeMessagesRouter(pool: Pool) {
  const r = Router();

  // GET /inbox/threads
  r.get('/threads', requireAuth, async (req: any, res) => {
    const userId = getUserId(req);
    try {
      const { rows } = await pool.query(
        `
        with er as (
          select id, from_user_id, to_user_id, status, created_at
          from app_public.exchange_requests
          where from_user_id=$1 or to_user_id=$1
        ),
        last_msg as (
          select exchange_id, max(created_at) as last_at
          from app_public.messages
          group by exchange_id
        ),
        unread as (
          select exchange_id, count(*) filter (where is_read=false) as unread
          from app_public.messages where to_user_id=$1 group by exchange_id
        )
        select
          e.id as exchange_id,
          e.status,
          e.created_at,
          case when e.from_user_id=$1 then e.to_user_id else e.from_user_id end as counterparty_id,
          coalesce(u.display_name, u.email, 'User '||
              case when e.from_user_id=$1 then e.to_user_id else e.from_user_id end::text) as counterparty_name,
          lm.last_at, coalesce(un.unread,0) as unread
        from er e
        left join last_msg lm on lm.exchange_id=e.id
        left join unread un on un.exchange_id=e.id
        left join app_public.users u on u.id = case when e.from_user_id=$1 then e.to_user_id else e.from_user_id end
        order by coalesce(lm.last_at, e.created_at) desc
        `,
        [userId]
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed_to_list_threads' });
    }
  });

  // GET /inbox/thread/:exchangeId
  r.get('/thread/:exchangeId', requireAuth, async (req: any, res) => {
    const userId = getUserId(req);
    const exchangeId = Number(req.params.exchangeId);
    try {
      const ok = await pool.query(
        `select 1 from app_public.exchange_requests
         where id=$1 and (from_user_id=$2 or to_user_id=$2)`,
        [exchangeId, userId]
      );
      if (!ok.rowCount) return res.status(403).json({ error: 'forbidden' });

      const { rows } = await pool.query(
        `select id, exchange_id, from_user_id, to_user_id, body, is_read, created_at
         from app_public.messages
         where exchange_id=$1
         order by created_at asc`,
        [exchangeId]
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed_to_get_thread' });
    }
  });

  // POST /inbox/send
  r.post('/send', requireAuth, async (req: any, res) => {
    const userId = getUserId(req);
    const { exchange_id, body } = req.body || {};
    if (!exchange_id || !String(body).trim()) {
      return res.status(400).json({ error: 'invalid_payload' });
    }
    try {
      const q = await pool.query(
        `select from_user_id, to_user_id from app_public.exchange_requests where id=$1`,
        [exchange_id]
      );
      if (!q.rowCount) return res.status(404).json({ error: 'exchange_not_found' });

      const { from_user_id, to_user_id } = q.rows[0];
      if (userId !== from_user_id && userId !== to_user_id)
        return res.status(403).json({ error: 'forbidden' });

      const toUserId = userId === from_user_id ? to_user_id : from_user_id;

      const ins = await pool.query(
        `insert into app_public.messages (exchange_id, from_user_id, to_user_id, body)
         values ($1,$2,$3,$4)
         returning id, exchange_id, from_user_id, to_user_id, body, is_read, created_at`,
        [exchange_id, userId, toUserId, String(body).trim()]
      );
      res.status(201).json(ins.rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed_to_send' });
    }
  });

  // POST /inbox/mark-read
  r.post('/mark-read', requireAuth, async (req: any, res) => {
    const userId = getUserId(req);
    const { exchange_id } = req.body || {};
    if (!exchange_id) return res.status(400).json({ error: 'invalid_payload' });
    try {
      await pool.query(
        `update app_public.messages
         set is_read=true
         where exchange_id=$1 and to_user_id=$2 and is_read=false`,
        [exchange_id, userId]
      );
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed_to_mark_read' });
    }
  });

  // GET /inbox/unread-count
  r.get('/unread-count', requireAuth, async (req: any, res) => {
    const userId = getUserId(req);
    try {
      const { rows } = await pool.query(
        `select count(*)::int as count
         from app_public.messages
         where to_user_id=$1 and is_read=false`,
        [userId]
      );
      res.json({ count: rows[0]?.count ?? 0 });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed_to_get_unread' });
    }
  });

  return r;
}
