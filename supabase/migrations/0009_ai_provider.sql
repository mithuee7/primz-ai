-- Let each owner pick an AI provider. Groq stays the default and keeps its multi-key setup.
alter table public.app_settings add column if not exists ai_provider text not null default 'groq';
alter table public.app_settings add column if not exists ai_key_encrypted text;
alter table public.app_settings add column if not exists ai_key_last4 text;
alter table public.app_settings add column if not exists ai_model text;
