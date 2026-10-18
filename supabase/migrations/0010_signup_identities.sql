-- One account per real mailbox. Aliases (Gmail dots, +tags, Yahoo -tags) map to the same
-- canonical identity, so a second account can't be made from an alias of an existing one.
-- Keep canonical_email in sync with src/lib/email-policy.ts.

create or replace function public.canonical_email(raw text)
returns text
language plpgsql
immutable
as $$
declare
  e text := lower(trim(raw));
  local_part text := split_part(e, '@', 1);
  dom text := split_part(e, '@', 2);
begin
  if dom in ('gmail.com', 'googlemail.com') then
    return replace(split_part(local_part, '+', 1), '.', '') || '@gmail.com';
  elsif dom in ('outlook.com', 'hotmail.com', 'live.com', 'msn.com') then
    return split_part(local_part, '+', 1) || '@' || dom;
  elsif dom in ('yahoo.com', 'yahoo.co.in') then
    return split_part(local_part, '-', 1) || '@' || dom;
  elsif dom in ('protonmail.com', 'proton.me', 'pm.me') then
    return split_part(local_part, '+', 1) || '@protonmail.com';
  end if;
  return e;
end;
$$;

create table if not exists public.signup_identities (
  canonical text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.signup_identities enable row level security;

-- Only the server (service role) reads or writes this table. No policies for users.
insert into public.signup_identities (canonical, owner_id)
select public.canonical_email(email), id
from auth.users
where email is not null
on conflict (canonical) do nothing;
