-- db/messages.sql

-- 1) Messages table: one thread per exchange_request
create table if not exists app_public.messages (
  id               serial primary key,
  exchange_id      int not null references app_public.exchange_requests(id) on delete cascade,
  from_user_id     int not null references app_public.users(id) on delete cascade,
  to_user_id       int not null references app_public.users(id) on delete cascade,
  body             text not null check (length(trim(body)) > 0),
  is_read          boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists msg_exchange_created_idx on app_public.messages(exchange_id, created_at desc);
create index if not exists msg_to_user_unread_idx on app_public.messages(to_user_id, is_read) where is_read = false;

-- 2) Security: only participants of the exchange can access
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
  and is_read in (true, false)
);

-- 3) Helper view: unread counts per exchange for current user
create or replace view app_public.v_inbox_unread as
select
  m.exchange_id,
  count(*) filter (where is_read = false) as unread_count
from app_public.messages m
where m.to_user_id = current_setting('jwt.claims.user_id', true)::int
group by m.exchange_id;
