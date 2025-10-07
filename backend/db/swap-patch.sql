-- ===========================================================
-- Swap Patch (idempotent)
-- Adds columns, backfills, adds exchanges table + RLS updates
-- ===========================================================

-- 1) Augment exchange_requests with participant & terms fields
alter table app_public.exchange_requests
  add column if not exists from_user_id int,
  add column if not exists to_user_id   int,
  add column if not exists currency     text not null default 'INR',
  add column if not exists cash_adjustment numeric(12,2) not null default 0,
  add column if not exists parent_request_id int references app_public.exchange_requests(id) on delete set null,
  add column if not exists expires_at   timestamptz;

-- Backfill participants from listing ownership
update app_public.exchange_requests r
set from_user_id = l1.owner_id,
    to_user_id   = l2.owner_id
from app_public.listings l1, app_public.listings l2
where r.from_listing_id = l1.id
  and r.to_listing_id   = l2.id
  and (r.from_user_id is null or r.to_user_id is null);

-- Helpful indexes
create index if not exists exreq_from_user_idx on app_public.exchange_requests(from_user_id, status);
create index if not exists exreq_to_user_idx   on app_public.exchange_requests(to_user_id, status);
create index if not exists exreq_parent_idx    on app_public.exchange_requests(parent_request_id);

-- 2) Finalized exchanges table (if not already present)
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='app_public' and t.typname='exchange_contract_status'
  ) then
    create type app_public.exchange_contract_status as enum ('active','completed','cancelled');
  end if;
end$$;

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

-- Reserve marker on listings
alter table app_public.listings
  add column if not exists reserved_exchange_id bigint references app_public.exchanges(id),
  add column if not exists exchanged_at timestamptz;

-- 3) RLS: enable and allow participants to work with exchanges
alter table app_public.exchanges enable row level security;

-- (recreate to be safe)
drop policy if exists exchanges_select_participants on app_public.exchanges;
create policy exchanges_select_participants on app_public.exchanges
  for select using (
    a_user_id = current_setting('jwt.claims.user_id', true)::int
    or b_user_id = current_setting('jwt.claims.user_id', true)::int
  );

drop policy if exists exchanges_insert_participants on app_public.exchanges;
create policy exchanges_insert_participants on app_public.exchanges
  for insert with check (
    a_user_id = current_setting('jwt.claims.user_id', true)::int
    or b_user_id = current_setting('jwt.claims.user_id', true)::int
  );

drop policy if exists exchanges_update_participants on app_public.exchanges;
create policy exchanges_update_participants on app_public.exchanges
  for update using (
    a_user_id = current_setting('jwt.claims.user_id', true)::int
    or b_user_id = current_setting('jwt.claims.user_id', true)::int
  );

-- 4) RLS: allow a participant to update a listing that is part of their exchange
--    (so Accept can reserve both, and Complete can mark both inactive)
drop policy if exists listings_update_participants on app_public.listings;
create policy listings_update_participants on app_public.listings
  for update using (
    exists (
      select 1 from app_public.exchanges e
      where (e.listing_a_id = listings.id or e.listing_b_id = listings.id)
        and (e.a_user_id = current_setting('jwt.claims.user_id', true)::int
             or e.b_user_id = current_setting('jwt.claims.user_id', true)::int)
    )
  );
