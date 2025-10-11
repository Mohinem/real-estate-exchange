-- ====================================================================
-- Real Estate Exchange — schema.sql (idempotent)
-- For Express /auth/login + PostGraphile + RLS + FK indexes
-- ====================================================================

-- ---------- Extensions ----------
create extension if not exists pgcrypto;  -- gen_random_uuid, crypt()
create extension if not exists citext;    -- case-insensitive email

-- ---------- Schemas ----------
create schema if not exists app_public;
create schema if not exists app_private;

-- ---------- Roles (optional; helps if you later map DB roles) ----------
do $$ begin create role anonymous noinherit;  exception when duplicate_object then null; end $$;
do $$ begin create role app_user  noinherit;  exception when duplicate_object then null; end $$;
do $$ begin create role app_admin noinherit;  exception when duplicate_object then null; end $$;

grant usage on schema app_public  to anonymous, app_user, app_admin;
grant usage on schema app_private to app_admin;

-- ====================================================================
-- Types
-- ====================================================================
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='app_public' and t.typname='property_type'
  )
  then
    create type app_public.property_type as enum ('apartment','house','villa','land','other');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='app_public' and t.typname='exchange_status'
  )
  then
    create type app_public.exchange_status as enum ('pending','accepted','rejected','cancelled');
  end if;
end$$;

-- ====================================================================
-- Tables (create in dependency-safe order)
-- ====================================================================

-- Users
create table if not exists app_public.users (
  id             serial primary key,
  email          citext unique not null,
  password_hash  text not null,
  display_name   text not null,
  is_verified    boolean not null default false,
  is_admin       boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Email verification tokens (optional)
create table if not exists app_private.email_verification_tokens (
  user_id    int primary key references app_public.users(id) on delete cascade,
  token      uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Listings
create table if not exists app_public.listings (
  id             serial primary key,
  owner_id       int references app_public.users(id) on delete cascade, -- may be null for trigger to fill
  title          text not null,
  description    text,
  price          numeric(14,2) not null check (price >= 0),
  currency       text not null default 'INR',
  location       text not null,
  property_type  app_public.property_type not null,
  conditions     text,
  contact_info   text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Images (per listing)
create table if not exists app_public.images (
  id          serial primary key,
  listing_id  int not null references app_public.listings(id) on delete cascade,
  url         text not null,
  created_at  timestamptz not null default now()
);

-- Exchange requests
create table if not exists app_public.exchange_requests (
  id               serial primary key,
  from_listing_id  int not null references app_public.listings(id) on delete cascade,
  to_listing_id    int not null references app_public.listings(id) on delete cascade,
  message          text,
  status           app_public.exchange_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint no_self_exchange check (from_listing_id <> to_listing_id)
);

-- Messages within an exchange
create table if not exists app_public.messages (
  id           serial primary key,
  exchange_id  int not null references app_public.exchange_requests(id) on delete cascade,
  sender_id    int not null references app_public.users(id) on delete cascade,
  body         text not null,
  created_at   timestamptz not null default now()
);

-- Notifications
create table if not exists app_public.notifications (
  id         serial primary key,
  user_id    int not null references app_public.users(id) on delete cascade,
  kind       text not null,
  payload    jsonb not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- Completed exchanges history
create table if not exists app_public.completed_exchanges (
  id          serial primary key,
  exchange_id int not null references app_public.exchange_requests(id) on delete cascade,
  closed_at   timestamptz not null default now()
);

-- ====================================================================
-- Indexes (including FK indexes PostGraphile expects)
-- ====================================================================
create index if not exists listings_owner_idx    on app_public.listings(owner_id);
create index if not exists listings_price_idx    on app_public.listings(price);
create index if not exists listings_location_idx on app_public.listings(location);
create index if not exists listings_type_idx     on app_public.listings(property_type);

create index if not exists images_listing_id_idx                 on app_public.images(listing_id);
create index if not exists exreq_from_listing_id_idx            on app_public.exchange_requests(from_listing_id);
create index if not exists exreq_to_listing_id_idx              on app_public.exchange_requests(to_listing_id);
create index if not exists messages_exchange_id_idx             on app_public.messages(exchange_id);
create index if not exists messages_sender_id_idx               on app_public.messages(sender_id);
create index if not exists notifications_user_id_idx            on app_public.notifications(user_id);
create index if not exists completed_exchanges_exchange_id_idx  on app_public.completed_exchanges(exchange_id);

-- ====================================================================
-- RLS (enable after tables created)
-- ====================================================================
alter table app_public.users               enable row level security;
alter table app_public.listings            enable row level security;
alter table app_public.images              enable row level security;
alter table app_public.exchange_requests   enable row level security;
alter table app_public.messages            enable row level security;
alter table app_public.notifications       enable row level security;
alter table app_public.completed_exchanges enable row level security;

-- ====================================================================
-- RLS Policies (idempotent: drop/create after enabling RLS)
-- ====================================================================

-- USERS: self-view, self-update; admins can read all
drop policy if exists users_select_self on app_public.users;
create policy users_select_self on app_public.users
  for select using (
    id = current_setting('jwt.claims.user_id', true)::int
    or coalesce(current_setting('jwt.claims.role', true),'anonymous') = 'admin'
  );

drop policy if exists users_update_self on app_public.users;
create policy users_update_self on app_public.users
  for update using (
    id = current_setting('jwt.claims.user_id', true)::int
  );

-- LISTINGS
drop policy if exists listings_select_all on app_public.listings;
create policy listings_select_all on app_public.listings
  for select using (is_active);

-- Insert: allow when owner_id is NULL or equals JWT; trigger fills NULL
drop policy if exists listings_insert_owner on app_public.listings;
create policy listings_insert_owner on app_public.listings
  for insert with check (
    coalesce(owner_id, current_setting('jwt.claims.user_id', true)::int)
    = current_setting('jwt.claims.user_id', true)::int
  );

drop policy if exists listings_update_owner on app_public.listings;
create policy listings_update_owner on app_public.listings
  for update using (
    owner_id = current_setting('jwt.claims.user_id', true)::int
  );

drop policy if exists listings_delete_owner on app_public.listings;
create policy listings_delete_owner on app_public.listings
  for delete using (
    owner_id = current_setting('jwt.claims.user_id', true)::int
  );

-- IMAGES (owner via listing)
drop policy if exists images_select_all on app_public.images;
create policy images_select_all on app_public.images
  for select using (true);

drop policy if exists images_cud_owner on app_public.images;
create policy images_cud_owner on app_public.images
  for all using (
    exists (
      select 1 from app_public.listings l
      where l.id = images.listing_id
        and l.owner_id = current_setting('jwt.claims.user_id', true)::int
    )
  );

-- EXCHANGE REQUESTS: participants only
drop policy if exists exreq_select_participants on app_public.exchange_requests;
create policy exreq_select_participants on app_public.exchange_requests
  for select using (
    exists (
      select 1 from app_public.listings l
      where (l.id = from_listing_id or l.id = to_listing_id)
        and l.owner_id = current_setting('jwt.claims.user_id', true)::int
    )
  );

drop policy if exists exreq_insert_owner on app_public.exchange_requests;
create policy exreq_insert_owner on app_public.exchange_requests
  for insert with check (
    exists (
      select 1 from app_public.listings l
      where l.id = from_listing_id
        and l.owner_id = current_setting('jwt.claims.user_id', true)::int
    )
  );

drop policy if exists exreq_update_participants on app_public.exchange_requests;
create policy exreq_update_participants on app_public.exchange_requests
  for update using (
    exists (
      select 1 from app_public.listings l
      where (l.id = from_listing_id or l.id = to_listing_id)
        and l.owner_id = current_setting('jwt.claims.user_id', true)::int
    )
  );

-- MESSAGES: participants only
drop policy if exists messages_select_participants on app_public.messages;
create policy messages_select_participants on app_public.messages
  for select using (
    exists (
      select 1
      from app_public.exchange_requests e
      join app_public.listings l1 on l1.id = e.from_listing_id
      join app_public.listings l2 on l2.id = e.to_listing_id
      where e.id = messages.exchange_id
        and (
          l1.owner_id = current_setting('jwt.claims.user_id', true)::int
          or l2.owner_id = current_setting('jwt.claims.user_id', true)::int
        )
    )
  );

drop policy if exists messages_insert_participants on app_public.messages;
create policy messages_insert_participants on app_public.messages
  for insert with check (
    exists (
      select 1
      from app_public.exchange_requests e
      join app_public.listings l1 on l1.id = e.from_listing_id
      join app_public.listings l2 on l2.id = e.to_listing_id
      where e.id = messages.exchange_id
        and (
          l1.owner_id = current_setting('jwt.claims.user_id', true)::int
          or l2.owner_id = current_setting('jwt.claims.user_id', true)::int
        )
    )
  );

-- NOTIFICATIONS: owner only
drop policy if exists notifications_select_owner on app_public.notifications;
create policy notifications_select_owner on app_public.notifications
  for select using (
    user_id = current_setting('jwt.claims.user_id', true)::int
  );

-- COMPLETED EXCHANGES: read-only to participants
drop policy if exists completed_select_participants on app_public.completed_exchanges;
create policy completed_select_participants on app_public.completed_exchanges
  for select using (
    exists (
      select 1
      from app_public.exchange_requests e
      join app_public.listings l1 on l1.id = e.from_listing_id
      join app_public.listings l2 on l2.id = e.to_listing_id
      where completed_exchanges.exchange_id = e.id
        and (
          l1.owner_id = current_setting('jwt.claims.user_id', true)::int
          or l2.owner_id = current_setting('jwt.claims.user_id', true)::int
        )
    )
  );

-- ====================================================================
-- Helpers, auth, and business logic
-- ====================================================================

-- Password helpers (used by /auth/login)
create or replace function app_private.hash_password(p_password text)
returns text
language plpgsql
as $$
begin
  return crypt(p_password, gen_salt('bf'));
end;
$$;

create or replace function app_private.check_password(p_hash text, p_password text)
returns boolean
language plpgsql
as $$
begin
  return p_hash = crypt(p_password, p_hash);
end;
$$;

-- Registration (exposed as mutation by PostGraphile)
create or replace function app_public.register(email text, password text, display_name text)
returns app_public.users
language sql
volatile
security definer
as $$
  insert into app_public.users(email, password_hash, display_name)
  values (email, app_private.hash_password(password), display_name)
  returning *;
$$;

-- Set owner_id from JWT on insert if not supplied (so frontend needn't send ownerId)
create or replace function app_private.set_owner_from_jwt()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is null then
    new.owner_id := current_setting('jwt.claims.user_id', true)::int;
  end if;
  return new;
end;
$$;

drop trigger if exists set_owner_from_jwt on app_public.listings;
create trigger set_owner_from_jwt
before insert on app_public.listings
for each row execute procedure app_private.set_owner_from_jwt();

-- Matching: suggest listings within ±X% price
create or replace function app_public.suggest_matches(listing_id int, price_percent int default 15)
returns setof app_public.listings
language plpgsql
stable
as $$
declare
  base_price numeric(14,2);
begin
  select price into base_price from app_public.listings where id = listing_id;
  if base_price is null then return; end if;

  return query
  select *
  from app_public.listings l
  where l.is_active = true
    and l.id <> listing_id
    and l.price between base_price * (1 - price_percent/100.0)
                    and base_price * (1 + price_percent/100.0)
  order by abs(l.price - base_price), l.created_at desc
  limit 50;
end;
$$;

-- ====================================================================
-- Grants (optional convenience)
-- ====================================================================
grant select on app_public.users to anonymous, app_user, app_admin;
grant usage, select on all sequences in schema app_public to app_user, app_admin;


-- ---------- Extra enum for finalized exchanges ----------
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='app_public' and t.typname='exchange_contract_status'
  ) then
    create type app_public.exchange_contract_status as enum ('active','completed','cancelled');
  end if;
end$$;

-- ---------- Augment exchange_requests ----------
alter table app_public.exchange_requests
  add column if not exists from_user_id int,
  add column if not exists to_user_id   int,
  add column if not exists currency     text not null default 'INR',
  add column if not exists cash_adjustment numeric(12,2) not null default 0,  -- + means payer = from_user -> to_user
  add column if not exists parent_request_id int references app_public.exchange_requests(id) on delete set null,
  add column if not exists expires_at   timestamptz;

-- backfill participants (safe, idempotent)
update app_public.exchange_requests r
set from_user_id = l1.owner_id,
    to_user_id   = l2.owner_id
from app_public.listings l1, app_public.listings l2
where r.from_listing_id = l1.id
  and r.to_listing_id   = l2.id
  and (r.from_user_id is null or r.to_user_id is null);

-- useful indexes
create index if not exists exreq_from_user_idx on app_public.exchange_requests(from_user_id, status);
create index if not exists exreq_to_user_idx   on app_public.exchange_requests(to_user_id, status);
create index if not exists exreq_parent_idx    on app_public.exchange_requests(parent_request_id);

-- ---------- Finalized exchanges (the contract) ----------
create table if not exists app_public.exchanges (
  id bigserial primary key,
  listing_a_id int not null references app_public.listings(id) on delete restrict,
  listing_b_id int not null references app_public.listings(id) on delete restrict,
  a_user_id    int not null,
  b_user_id    int not null,
  currency     text not null default 'INR',
  cash_adjustment_a_to_b numeric(12,2) not null default 0,
  status       app_public.exchange_contract_status not null default 'active',
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists exchanges_users_idx on app_public.exchanges(a_user_id,b_user_id,status);

-- Reserve listings when an exchange is agreed
alter table app_public.listings
  add column if not exists reserved_exchange_id bigint references app_public.exchanges(id),
  add column if not exists exchanged_at timestamptz;

-- ---------- RLS: keep your existing model; add read for exchanges ----------
alter table app_public.exchanges enable row level security;

drop policy if exists exchanges_select_participants on app_public.exchanges;
create policy exchanges_select_participants on app_public.exchanges
  for select using (
    a_user_id = current_setting('jwt.claims.user_id', true)::int
    or
    b_user_id = current_setting('jwt.claims.user_id', true)::int
  );

-- ===========================================================
-- ✅ EXCHANGES TABLE PERMISSIONS AND RLS POLICIES
-- ===========================================================

-- Ensure schema access
GRANT USAGE ON SCHEMA app_public TO app_user;

-- Base privileges on the table
GRANT SELECT, INSERT, UPDATE ON TABLE app_public.exchanges TO app_user;

-- Sequence permissions (needed for serial/identity columns)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'exchanges_id_seq') THEN
    GRANT USAGE, SELECT ON SEQUENCE app_public.exchanges_id_seq TO app_user;
  END IF;
END$$;

-- Enable RLS (Row Level Security)
ALTER TABLE app_public.exchanges ENABLE ROW LEVEL SECURITY;

-- Allow participants to SELECT their own exchanges
DROP POLICY IF EXISTS exchanges_participant_select ON app_public.exchanges;
CREATE POLICY exchanges_participant_select
  ON app_public.exchanges
  FOR SELECT
  USING (current_setting('jwt.claims.user_id', true)::int IN (a_user_id, b_user_id));

-- Allow participants to INSERT their own exchanges
DROP POLICY IF EXISTS exchanges_participant_insert ON app_public.exchanges;
CREATE POLICY exchanges_participant_insert
  ON app_public.exchanges
  FOR INSERT
  WITH CHECK (current_setting('jwt.claims.user_id', true)::int IN (a_user_id, b_user_id));

-- Allow participants to UPDATE their own exchanges
DROP POLICY IF EXISTS exchanges_participant_update ON app_public.exchanges;
CREATE POLICY exchanges_participant_update
  ON app_public.exchanges
  FOR UPDATE
  USING (current_setting('jwt.claims.user_id', true)::int IN (a_user_id, b_user_id))
  WITH CHECK (current_setting('jwt.claims.user_id', true)::int IN (a_user_id, b_user_id));

-- ===========================================================
-- ✅ END EXCHANGES RLS CONFIGURATION
-- ===========================================================

-- 20251010_hard_delete_listings.sql

-- 1) Exchanges must disappear when a referenced listing is deleted
alter table app_public.exchanges
  drop constraint if exists exchanges_listing_a_id_fkey,
  add  constraint exchanges_listing_a_id_fkey
    foreign key (listing_a_id) references app_public.listings(id) on delete cascade;

alter table app_public.exchanges
  drop constraint if exists exchanges_listing_b_id_fkey,
  add  constraint exchanges_listing_b_id_fkey
    foreign key (listing_b_id) references app_public.listings(id) on delete cascade;

-- 2) Any listing pointing to an exchange via reserved_exchange_id should not block
--    when that exchange is deleted as a side effect; null it out automatically.
alter table app_public.listings
  drop constraint if exists listings_reserved_exchange_id_fkey,
  add  constraint listings_reserved_exchange_id_fkey
    foreign key (reserved_exchange_id) references app_public.exchanges(id) on delete set null;

-- Notes:
-- - images(listing_id) already has ON DELETE CASCADE (good).
-- - exchange_requests(from_listing_id / to_listing_id) already have ON DELETE CASCADE (good).
-- - messages(exchange_id) → exchange_requests(id) is ON DELETE CASCADE via the ER chain (good).
-- - completed_exchanges(exchange_id) → exchange_requests(id) is ON DELETE CASCADE (good).
