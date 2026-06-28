create table if not exists public.pilot_settings (
  pilot_id text primary key,
  telex_logon_cipher text,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.pilot_settings enable row level security;

-- Browser clients receive no table policy. Access is restricted to the
-- authenticated Vercel API route using the Supabase service role key.
revoke all on public.pilot_settings from anon, authenticated;
