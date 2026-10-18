-- Starter is removed. Anyone on it goes back to no plan (they can choose again).
update public.user_plans
set plan_code = 'free', status = 'inactive', activated_at = null, expires_at = null, updated_at = now()
where plan_code = 'starter';

delete from public.plans where code = 'starter';
