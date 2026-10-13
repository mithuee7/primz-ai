-- Retry queue for failed pipeline runs (e.g., Groq rate limits)
-- Stores conversations that need to be retried after a delay
create table if not exists public.retry_queue (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  reason text not null,
  scheduled_at timestamptz not null,
  attempted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists retry_queue_scheduled_idx on public.retry_queue (scheduled_at) where attempted_at is null;
create index if not exists retry_queue_owner_idx on public.retry_queue (owner_id, created_at desc);
create index if not exists retry_queue_conversation_idx on public.retry_queue (conversation_id);

alter table public.retry_queue enable row level security;
create policy "owner select" on public.retry_queue for select using (owner_id = auth.uid());
