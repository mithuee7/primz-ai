-- Chat limits: Growth 75, Business 150.
update public.plans set chats_per_account = 75 where code = 'growth';
update public.plans set chats_per_account = 150 where code = 'business';
