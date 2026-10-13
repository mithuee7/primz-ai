-- Add message history fetching tracking to conversation_settings
-- Allows tracking if we've already fetched recent messages from Instagram

alter table public.conversation_settings add column if not exists message_history_fetched boolean not null default false;
alter table public.conversation_settings add column if not exists last_message_history_fetch timestamptz;
