-- Make exchange_id optional for conversation-based messaging

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='app_public'
      and table_name='messages'
      and column_name='exchange_id'
  ) then
    -- drop NOT NULL if present
    begin
      alter table app_public.messages
        alter column exchange_id drop not null;
    exception when others then
      -- ignore if already nullable
      null;
    end if;
  end if;
end$$;

-- Keep FK if you have one; it's OK with NULLs.
-- If you don't have it yet, you can (optionally) add it like this:
-- alter table app_public.messages
--   add constraint messages_exchange_fk
--   foreign key (exchange_id) references app_public.exchange_requests(id)
--   on delete set null;
