-- backend/db/conversations.sql
-- Conversations aggregate all offers/counters between the same two users
-- about the same two listings. Order-agnostic via LEAST/GREATEST.

create table if not exists app_public.conversations (
  id                serial primary key,
  a_user_id         int not null references app_public.users(id) on delete cascade,
  b_user_id         int not null references app_public.users(id) on delete cascade,
  a_listing_id      int not null references app_public.listings(id) on delete cascade,
  b_listing_id      int not null references app_public.listings(id) on delete cascade,
  created_at        timestamptz not null default now(),
  last_message_at   timestamptz
);

-- Unique, order-agnostic constraint (users + listings as sets)
create unique index if not exists conv_unique_pair_idx on app_public.conversations
(
  least(a_user_id, b_user_id),
  greatest(a_user_id, b_user_id),
  least(a_listing_id, b_listing_id),
  greatest(a_listing_id, b_listing_id)
);

alter table app_public.conversations enable row level security;

drop policy if exists conv_participants_only on app_public.conversations;
create policy conv_participants_only on app_public.conversations
for all using (
  current_setting('jwt.claims.user_id', true)::int in (a_user_id, b_user_id)
) with check (
  current_setting('jwt.claims.user_id', true)::int in (a_user_id, b_user_id)
);

-- Messages: add conversation_id and make exchange_id optional (for linking)
alter table app_public.messages
  add column if not exists conversation_id int;

-- Backfill conversation_id for existing messages by joining ER rows.
with pairs as (
  select
    er.id as exchange_id,
    least(er.from_user_id, er.to_user_id) as au,
    greatest(er.from_user_id, er.to_user_id) as bu,
    least(er.from_listing_id, er.to_listing_id) as al,
    greatest(er.from_listing_id, er.to_listing_id) as bl
  from app_public.exchange_requests er
),
upsert_convs as (
  insert into app_public.conversations (a_user_id, b_user_id, a_listing_id, b_listing_id)
  select distinct au, bu, al, bl from pairs
  on conflict ( (least(a_user_id,b_user_id)), (greatest(a_user_id,b_user_id)),
                (least(a_listing_id,b_listing_id)), (greatest(a_listing_id,b_listing_id)) )
  do nothing
  returning id, a_user_id, b_user_id, a_listing_id, b_listing_id
),
conv_map as (
  -- Map every ER to its conversation id
  select
    p.exchange_id,
    c.id as conversation_id
  from pairs p
  join app_public.conversations c
    on least(c.a_user_id, c.b_user_id) = p.au
   and greatest(c.a_user_id, c.b_user_id) = p.bu
   and least(c.a_listing_id, c.b_listing_id) = p.al
   and greatest(c.a_listing_id, c.b_listing_id) = p.bl
)
update app_public.messages m
set conversation_id = cm.conversation_id
from conv_map cm
where m.exchange_id = cm.exchange_id
  and m.conversation_id is null;

-- Now enforce NOT NULL conversation_id for all messages
alter table app_public.messages
  alter column conversation_id set not null;

alter table app_public.messages
  add constraint messages_conversation_fk
  foreign key (conversation_id) references app_public.conversations(id) on delete cascade;

-- Helpful indexes
create index if not exists conv_last_message_idx on app_public.conversations(last_message_at desc);
create index if not exists msg_conversation_created_idx on app_public.messages(conversation_id, created_at);

-- Keep unread optimization
create index if not exists msg_to_user_unread_idx on app_public.messages(to_user_id, is_read) where is_read=false;

-- Keep messages RLS consistent: participants of the conversation only
drop policy if exists msg_select_participants_only on app_public.messages;
create policy msg_select_participants_only on app_public.messages
for select using (
  exists (
    select 1
    from app_public.conversations c
    where c.id = conversation_id
      and current_setting('jwt.claims.user_id', true)::int in (c.a_user_id, c.b_user_id)
  )
);

drop policy if exists msg_insert_participants_only on app_public.messages;
create policy msg_insert_participants_only on app_public.messages
for insert with check (
  exists (
    select 1
    from app_public.conversations c
    where c.id = conversation_id
      and current_setting('jwt.claims.user_id', true)::int in (c.a_user_id, c.b_user_id)
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
