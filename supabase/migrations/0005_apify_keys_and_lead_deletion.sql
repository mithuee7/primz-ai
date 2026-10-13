-- Add Apify key management to app_settings
-- Apify keys are used for lead type detection (fetching bio, username, post captions)

alter table public.app_settings add column if not exists apify_key_encrypted text;
alter table public.app_settings add column if not exists apify_key_last4 text;

-- Add deleted_at to conversations to support soft deletes / complete removal
alter table public.conversations add column if not exists deleted_at timestamptz;

-- Index for filtering out deleted conversations in queries
create index if not exists conversations_owner_not_deleted_idx
  on public.conversations (owner_id) where deleted_at is null;

-- Add rate limit retry tracking to ReplyClaim
alter table public.reply_claims add column if not exists retry_at timestamptz;
alter table public.reply_claims add column if not exists retry_count int not null default 0;
alter table public.reply_claims add column if not exists rate_limit_error text;

-- Index for finding rate-limited messages ready for retry
create index if not exists reply_claims_retry_idx
  on public.reply_claims (owner_id, status, retry_at)
  where status = 'RATE_LIMITED' and retry_at is not null;
