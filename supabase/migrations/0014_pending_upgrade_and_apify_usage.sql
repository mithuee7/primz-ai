-- Paid request made during a free trial is kept separately, so the trial keeps running until approval.
alter table public.user_plans add column if not exists requested_plan_code text;
