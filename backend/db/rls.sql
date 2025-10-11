grant select on app_public.users to anonymous, app_user, app_admin;
grant usage, select on all sequences in schema app_public to app_user, app_admin;

-- Keep from_user_id/to_user_id in sync with listing owners
create or replace function app_private.set_exreq_participants()
returns trigger
language plpgsql
as $$
begin
  new.from_user_id := (select owner_id from app_public.listings where id = new.from_listing_id);
  new.to_user_id   := (select owner_id from app_public.listings where id = new.to_listing_id);
  if new.currency is null then new.currency := 'INR'; end if;
  if new.cash_adjustment is null then new.cash_adjustment := 0; end if;
  return new;
end;
$$;

drop trigger if exists trg_set_exreq_participants on app_public.exchange_requests;
create trigger trg_set_exreq_participants
before insert or update of from_listing_id, to_listing_id
on app_public.exchange_requests
for each row execute procedure app_private.set_exreq_participants();

-- =============== Exchange Participant Reservation Policies ===============

drop policy if exists listings_participant_reserve on app_public.listings;
create policy listings_participant_reserve on app_public.listings
for update
using (
  exists (
    select 1
    from app_public.exchanges e
    where e.status = 'active'
      and (e.listing_a_id = listings.id or e.listing_b_id = listings.id)
      and (
        e.a_user_id = current_setting('jwt.claims.user_id', true)::int
        or e.b_user_id = current_setting('jwt.claims.user_id', true)::int
      )
  )
)
with check (
  reserved_exchange_id is not null
  and exists (
    select 1
    from app_public.exchanges e
    where e.id = reserved_exchange_id
      and e.status = 'active'
      and (e.listing_a_id = listings.id or e.listing_b_id = listings.id)
      and (
        e.a_user_id = current_setting('jwt.claims.user_id', true)::int
        or e.b_user_id = current_setting('jwt.claims.user_id', true)::int
      )
  )
);

drop policy if exists listings_participant_unreserve on app_public.listings;
create policy listings_participant_unreserve on app_public.listings
for update
using (
  exists (
    select 1
    from app_public.exchanges e
    where e.id = listings.reserved_exchange_id
      and (
        e.a_user_id = current_setting('jwt.claims.user_id', true)::int
        or e.b_user_id = current_setting('jwt.claims.user_id', true)::int
      )
  )
)
with check (
  reserved_exchange_id is null
);

