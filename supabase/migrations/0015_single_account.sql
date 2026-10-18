-- Every plan covers one Instagram account. Multi-account is removed.
update public.plans set max_accounts = 1;
