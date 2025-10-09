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
