-- 1. A paid request made during a free trial is kept separately, so the trial keeps running until approval.
alter table public.user_plans add column if not exists requested_plan_code text;

-- 2. Apify usage counter (atomic). Written as plpgsql so it can be created before the
--    apify_api_keys table exists; the app falls back to a plain update if it's missing.
create or replace function public.increment_apify_usage(key_id uuid)
returns void
language plpgsql
as $$
begin
  update public.apify_api_keys set usage_count = coalesce(usage_count, 0) + 1 where id = key_id;
end;
$$;
