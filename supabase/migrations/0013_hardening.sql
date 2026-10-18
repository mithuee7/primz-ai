-- 1. Free trial is used once per account, even if a paid plan is deactivated later.
alter table public.user_plans add column if not exists free_trial_used boolean not null default false;
update public.user_plans set free_trial_used = true where plan_code = 'free' and activated_at is not null;

-- 2. Owners can read their own rows, but can't write them directly through the public API.
--    The app writes through the service-role client, which bypasses RLS.
do $$
declare t text;
begin
  foreach t in array array['services', 'conversations', 'conversation_settings', 'conversation_state',
                           'conversation_services', 'messages', 'ai_generations', 'ai_reviews']
  loop
    execute format('drop policy if exists "owner insert" on public.%I', t);
    execute format('drop policy if exists "owner update" on public.%I', t);
    execute format('drop policy if exists "owner delete" on public.%I', t);
  end loop;
end $$;
