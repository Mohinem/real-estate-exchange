-- ====================================================================
-- Admin deletes (users: soft delete; listings: hard delete)
-- Tailored for your existing schema
-- ====================================================================

-- ---------- Users: soft delete ----------
alter table app_public.users
  add column if not exists deleted_at timestamptz,
  add column if not exists is_active boolean default true not null;

-- Replace global UNIQUE(email) with a partial unique for active users only
do $$
begin
  -- drop the default unique index/constraint name if it exists
  perform 1
    from pg_indexes
    where schemaname = 'app_public' and indexname = 'users_email_key';
  if found then
    execute 'drop index if exists app_public.users_email_key';
  end if;
exception when undefined_table then
  null;
end$$;

-- (In case the UNIQUE was created as a constraint, defensively drop that too)
do $$
begin
  alter table app_public.users drop constraint if exists users_email_key;
exception when undefined_object then
  null;
end$$;

create unique index if not exists users_email_active_unq
  on app_public.users (lower(email))
  where deleted_at is null;

-- Soft-delete helper: anonymize PII, deactivate
create schema if not exists app_private;

create table if not exists app_private.admin_audit (
  id bigserial primary key,
  admin_id int not null,
  action text not null,           -- 'soft_delete' | 'hard_delete' | ...
  target_type text not null,      -- 'user' | 'listing' | ...
  target_id int not null,
  reason text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function app_private_soft_delete_user(p_user_id int, p_admin_id int, p_reason text default null)
returns void
language plpgsql
as $$
begin
  update app_public.users u
     set deleted_at = now(),
         is_active = false,
         -- keep uniqueness but remove PII
         email = ('deleted+'||u.id||'@example.invalid'),
         display_name = 'Deleted User'
   where u.id = p_user_id
     and u.deleted_at is null;

  -- Kill per-user state if you add such tables later (e.g., refresh_tokens)
  -- delete from app_private.refresh_tokens where user_id = p_user_id;

  insert into app_private.admin_audit(admin_id, action, target_type, target_id, reason, details)
  values (p_admin_id, 'soft_delete', 'user', p_user_id, p_reason, jsonb_build_object('table','users'));
end$$;

-- ---------- Listings: hard delete via helper ----------
-- Your schema already ensures safe cascades:
--  - images(listing_id) ON DELETE CASCADE
--  - exchange_requests(from_listing_id/to_listing_id) ON DELETE CASCADE
--  - messages(exchange_id) cascades via exchange_requests
--  - completed_exchanges(exchange_id) cascades via exchange_requests
--  - exchanges(listing_a_id/listing_b_id) switched to ON DELETE CASCADE
--  - listings.reserved_exchange_id → exchanges(id) ON DELETE SET NULL
create or replace function app_private_hard_delete_listing(p_listing_id int, p_admin_id int, p_reason text default null)
returns void
language plpgsql
as $$
begin
  delete from app_public.listings where id = p_listing_id;

  insert into app_private.admin_audit(admin_id, action, target_type, target_id, reason, details)
  values (p_admin_id, 'hard_delete', 'listing', p_listing_id, p_reason, jsonb_build_object('table','listings'));
end$$;

-- ---------- RLS: allow delete to admins only ----------
-- Helper to read JWT role
create or replace function app_private.is_admin()
returns boolean language sql stable as $$
  select coalesce(current_setting('jwt.claims.role', true) in ('admin','app_admin'), false)
$$;

alter table app_public.users               enable row level security;
alter table app_public.listings            enable row level security;

drop policy if exists users_delete_admin on app_public.users;
create policy users_delete_admin on app_public.users
  for delete
  using (app_private.is_admin());

drop policy if exists listings_delete_admin on app_public.listings;
create policy listings_delete_admin on app_public.listings
  for delete
  using (app_private.is_admin());
