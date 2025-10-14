-- === Patch messages table to support inbox v1 ===

-- 1) Add columns if missing
alter table app_public.messages
  add column if not exists from_user_id int,
  add column if not exists to_user_id   int,
  add column if not exists is_read      boolean not null default false;

-- 2) Backfill from/to using existing exchange + sender mapping
-- Assumes old schema had: messages(exchange_id, sender_id, body, created_at)
update app_public.messages m
set from_user_id = m.sender_id,
    to_user_id   = case
                     when m.sender_id = er.from_user_id then er.to_user_id
                     else er.from_user_id
                   end
from app_public.exchange_requests er
where er.id = m.exchange_id
  and m.from_user_id is null;

-- 3) Set NOT NULL + FKs (after backfill)
alter table app_public.messages
  alter column from_user_id set not null,
  alter column to_user_id   set not null;

alter table app_public.messages
  add constraint messages_from_user_fk
    foreign key (from_user_id) references app_public.users(id) on delete cascade
    deferrable initially deferred,
  add constraint messages_to_user_fk
    foreign key (to_user_id)   references app_public.users(id) on delete cascade
    deferrable initially deferred;

-- Optional: drop legacy sender_id once you confirm backfill (safe to keep during transition)
-- alter table app_public.messages drop column if exists sender_id;

-- 4) Helpful indexes
create index if not exists msg_exchange_created_idx on app_public.messages(exchange_id, created_at desc);
create index if not exists msg_to_user_unread_idx   on app_public.messages(to_user_id, is_read) where is_read = false;

-- 5) RLS (idempotent)
alter table app_public.messages enable row level security;

drop policy if exists msg_select_participants_only on app_public.messages;
create policy msg_select_participants_only on app_public.messages
for select using (
  exists (
    select 1
    from app_public.exchange_requests er
    where er.id = exchange_id
      and (
        er.from_user_id = current_setting('jwt.claims.user_id', true)::int
        or er.to_user_id = current_setting('jwt.claims.user_id', true)::int
      )
  )
);

drop policy if exists msg_insert_participants_only on app_public.messages;
create policy msg_insert_participants_only on app_public.messages
for insert with check (
  exists (
    select 1
    from app_public.exchange_requests er
    where er.id = exchange_id
      and (
        (er.from_user_id = current_setting('jwt.claims.user_id', true)::int and from_user_id = er.from_user_id and to_user_id = er.to_user_id)
        or
        (er.to_user_id   = current_setting('jwt.claims.user_id', true)::int and from_user_id = er.to_user_id   and to_user_id = er.from_user_id)
      )
  )
);

drop policy if exists msg_update_read_flag_only on app_public.messages;
create policy msg_update_read_flag_only on app_public.messages
for update using (
  to_user_id = current_setting('jwt.claims.user_id', true)::int
) with check (
  to_user_id = current_setting('jwt.claims.user_id', true)::int
  and is_read in (true,false)
);
