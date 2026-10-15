-- Activity log: a plain-language trail of what the AI did for each lead and why it failed.
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  level text not null check (level in ('info', 'success', 'warn', 'error')),
  step text not null,
  message text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_owner_idx on public.activity_logs (owner_id, created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs_owner" on public.activity_logs;
create policy "activity_logs_owner" on public.activity_logs
  for select using (owner_id = auth.uid());
