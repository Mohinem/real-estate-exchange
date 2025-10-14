-- backend/db/messages-drop-sender.sql
-- Idempotent: run safely multiple times

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='app_public'
      and table_name='messages'
      and column_name='sender_id'
  ) then
    -- make nullable (in case it's NOT NULL) so we can backfill/drop safely
    begin
      alter table app_public.messages
        alter column sender_id drop not null;
    exception when undefined_column then
      -- ignore if it was already gone
    end;

    -- best-effort backfill: if any legacy rows have sender_id null, copy from from_user_id
    update app_public.messages
       set sender_id = from_user_id
     where sender_id is null;

    -- finally drop the legacy column
    alter table app_public.messages
      drop column sender_id;
  end if;
end$$;

-- helpful indexes (no-op if they exist)
create index if not exists msg_exchange_created_idx
  on app_public.messages(exchange_id, created_at desc);
create index if not exists msg_to_user_unread_idx
  on app_public.messages(to_user_id, is_read) where is_read=false;
