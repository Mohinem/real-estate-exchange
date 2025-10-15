// backend/src/conversations.ts
import { Router } from 'express';
import type { Pool } from 'pg';
import { requireAuth } from './auth';

function uid(req:any){ return Number(req?.jwt?.user_id ?? req?.user?.user_id); }
function normPair(a: number, b: number){ return a <= b ? [a,b] : [b,a]; }

export function makeConversationsRouter(pool: Pool) {
  const r = Router();

  // List my conversations with last message + unread
  r.get('/', requireAuth, async (req:any, res) => {
    const userId = uid(req);
    try {
      const { rows } = await pool.query(
        `
        with my_convs as (
          select *
          from app_public.conversations c
          where $1 in (c.a_user_id, c.b_user_id)
        ),
        last_msg as (
          select conversation_id, max(created_at) as last_at
          from app_public.messages
          group by conversation_id
        ),
        preview as (
          select distinct on (m.conversation_id)
            m.conversation_id, m.body, m.created_at
          from app_public.messages m
          order by m.conversation_id, m.created_at desc
        ),
        unread as (
          select conversation_id, count(*) filter (where is_read=false) as unread
          from app_public.messages
          where to_user_id=$1
          group by conversation_id
        )
        select
          c.id as conversation_id,
          c.a_user_id, c.b_user_id, c.a_listing_id, c.b_listing_id,
          case when $1 = c.a_user_id then c.b_user_id else c.a_user_id end as counterparty_id,
          u.display_name as counterparty_name,
          lm.last_at as last_at,
          pr.body as last_body,
          coalesce(un.unread,0) as unread
        from my_convs c
        left join last_msg lm on lm.conversation_id=c.id
        left join preview pr on pr.conversation_id=c.id
        left join unread un on un.conversation_id=c.id
        left join app_public.users u
          on u.id = case when $1=c.a_user_id then c.b_user_id else c.a_user_id end
        order by coalesce(lm.last_at, c.created_at) desc, c.id desc
        `,
        [userId]
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed_to_list_conversations' });
    }
  });

  // Ensure conversation exists from an exchange_request id (returns id)
  r.post('/ensure', requireAuth, async (req:any, res) => {
    const userId = uid(req);
    const { exchange_id } = req.body || {};
    if (!exchange_id) return res.status(400).json({ error: 'exchange_id required' });

    try {
      const q = await pool.query(
        `select from_user_id, to_user_id, from_listing_id, to_listing_id
           from app_public.exchange_requests
          where id=$1`,
        [exchange_id]
      );
      if (!q.rowCount) return res.status(404).json({ error: 'exchange_not_found' });
      const er = q.rows[0];
      if (![er.from_user_id, er.to_user_id].includes(userId)) {
        return res.status(403).json({ error: 'forbidden' });
      }

      const [au, bu] = normPair(er.from_user_id, er.to_user_id);
      const [al, bl] = normPair(er.from_listing_id, er.to_listing_id);

      const ins = await pool.query(
        `insert into app_public.conversations (a_user_id,b_user_id,a_listing_id,b_listing_id)
         values ($1,$2,$3,$4)
         on conflict ( (least(a_user_id,b_user_id)), (greatest(a_user_id,b_user_id)),
                       (least(a_listing_id,b_listing_id)), (greatest(a_listing_id,b_listing_id)) )
         do update set last_message_at = app_public.conversations.last_message_at
         returning id`,
        [au, bu, al, bl]
      );
      res.json({ id: ins.rows[0].id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed_to_ensure_conversation' });
    }
  });

  // Get messages for a conversation
  r.get('/:id/messages', requireAuth, async (req:any, res) => {
    const userId = uid(req);
    const id = Number(req.params.id);
    try {
      const ok = await pool.query(
        `select 1 from app_public.conversations
          where id=$1 and $2 in (a_user_id,b_user_id)`,
        [id, userId]
      );
      if (!ok.rowCount) return res.status(403).json({ error: 'forbidden' });

      const { rows } = await pool.query(
        `select id, conversation_id, exchange_id, from_user_id, to_user_id, body, is_read, created_at
           from app_public.messages
          where conversation_id=$1
          order by created_at asc`,
        [id]
      );

      // mark read
      await pool.query(
        `update app_public.messages set is_read=true
          where conversation_id=$1 and to_user_id=$2 and is_read=false`,
        [id, userId]
      );

      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed_to_get_messages' });
    }
  });

  // Send a message (always allowed while participants remain the same)
  r.post('/:id/messages', requireAuth, async (req:any, res) => {
    const userId = uid(req);
    const id = Number(req.params.id);
    const { body, exchange_id } = req.body || {};
    if (!String(body || '').trim()) return res.status(400).json({ error: 'empty_body' });

    try {
      const c = await pool.query(
        `select a_user_id, b_user_id from app_public.conversations where id=$1`,
        [id]
      );
      if (!c.rowCount) return res.status(404).json({ error: 'conversation_not_found' });
      const { a_user_id, b_user_id } = c.rows[0];
      if (![a_user_id, b_user_id].includes(userId)) return res.status(403).json({ error: 'forbidden' });

      const toUserId = (userId === a_user_id) ? b_user_id : a_user_id;

      const ins = await pool.query(
        `insert into app_public.messages (conversation_id, exchange_id, from_user_id, to_user_id, body)
         values ($1,$2,$3,$4,$5)
         returning id, conversation_id, exchange_id, from_user_id, to_user_id, body, is_read, created_at`,
        [id, exchange_id ?? null, userId, toUserId, String(body).trim()]
      );

      await pool.query(
        `update app_public.conversations set last_message_at = now() where id=$1`,
        [id]
      );

      res.status(201).json(ins.rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed_to_send' });
    }
  });

  // Global unread count for navbar
  r.get('/unread/count', requireAuth, async (req:any, res) => {
    const userId = uid(req);
    try {
      const { rows } = await pool.query(
        `select count(*)::int as count from app_public.messages where to_user_id=$1 and is_read=false`,
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
