-- 1. A paid request made during a free trial is kept separately, so the trial keeps running until approval.
alter table public.user_plans add column if not exists requested_plan_code text;

-- 2. Apify usage counter used by apify-integration.ts (atomic, instead of read-then-write).
create or replace function public.increment_apify_usage(key_id uuid)
returns void
language sql
as $$
  update public.apify_api_keys set usage_count = coalesce(usage_count, 0) + 1 where id = key_id;
$$;
