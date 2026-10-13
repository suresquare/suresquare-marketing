-- Waitlist / early-access sign-ups from suresquare.bid.
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  full_name   text not null check (char_length(full_name) between 1 and 120),
  email       text not null unique check (char_length(email) <= 200),
  company     text check (char_length(company) <= 160),
  interests   text[] not null default '{}',   -- 'takeoffs', 'crm'
  source      text,                            -- DuroLast, Elevate, Facebook, Google, Other
  user_agent  text,
  status      text not null default 'new'      -- for sales follow-up: new, contacted, converted, …
);

-- Added 2026-10: which site offer a sign-up claimed, and the popup's "3 or more users" answer.
-- Safe to re-run; the API saves leads without these columns until they exist.
alter table public.leads add column if not exists offer text;              -- e.g. 'crm-50-for-life'
alter table public.leads add column if not exists three_plus_users boolean;

create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- Lock the table down. The website writes with the service role key (server-side only),
-- which bypasses RLS, so no public policies are needed. Add policies later if the CRM
-- should read these rows as a logged-in user.
alter table public.leads enable row level security;
