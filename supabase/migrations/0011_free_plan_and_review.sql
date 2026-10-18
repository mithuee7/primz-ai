-- Free plan (3 chats, platform keys) and account review state set by the abuse check.

alter table public.user_plans
  add column if not exists review_status text not null default 'ok' check (review_status in ('ok', 'review', 'blocked')),
  add column if not exists review_reason text,
  add column if not exists flagged_at timestamptz;

update public.plans
set name = 'Free', max_accounts = 1, chats_per_account = 3, byok_required = false, sort_order = 0
where code = 'free';
