-- Plans: a catalogue of plans, and one plan row per user (default: no plan yet).
create table if not exists public.plans (
  code text primary key,
  name text not null,
  max_accounts int not null,
  chats_per_account int not null,
  byok_required boolean not null default true,
  sort_order int not null default 0
);

insert into public.plans (code, name, max_accounts, chats_per_account, byok_required, sort_order) values
  ('free', 'No plan', 0, 0, true, 0),
  ('basic', 'Basic', 1, 25, false, 1),
  ('starter', 'Starter', 1, 50, true, 2),
  ('growth', 'Growth', 3, 100, true, 3),
  ('business', 'Business', 10, 100, true, 4)
on conflict (code) do update set
  name = excluded.name,
  max_accounts = excluded.max_accounts,
  chats_per_account = excluded.chats_per_account,
  byok_required = excluded.byok_required,
  sort_order = excluded.sort_order;

create table if not exists public.user_plans (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  plan_code text not null default 'free' references public.plans (code),
  status text not null default 'inactive' check (status in ('inactive', 'pending', 'active', 'expired')),
  requested_at timestamptz,
  activated_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;
alter table public.user_plans enable row level security;
drop policy if exists "plans readable" on public.plans;
create policy "plans readable" on public.plans for select using (true);
drop policy if exists "own plan select" on public.user_plans;
create policy "own plan select" on public.user_plans for select using (owner_id = auth.uid());

-- Every profile gets a plan row automatically, starting on 'free' (inactive).
create or replace function public.create_user_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_plans (owner_id, plan_code, status)
  values (new.id, 'free', 'inactive')
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_plan on public.profiles;
create trigger on_profile_created_plan
  after insert on public.profiles
  for each row execute function public.create_user_plan();

-- Backfill everyone who already has a profile.
insert into public.user_plans (owner_id, plan_code, status)
select id, 'free', 'inactive' from public.profiles
on conflict (owner_id) do nothing;
