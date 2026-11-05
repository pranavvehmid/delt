-- Run once in Supabase: SQL Editor -> New query -> paste all of this -> Run.
-- Safe to run more than once.
-- ---------- Nov 2026: issues #3, #4, #5, #6 ----------
-- #3: a student's own Gemini key (encrypted by the app) and their daily use of the shared key.
alter table users add column if not exists gemini_key_enc text;
alter table users add column if not exists ai_day text;
alter table users add column if not exists ai_calls int not null default 0;
-- #4/#5: when the student last opened the app; active students are synced more often.
alter table users add column if not exists last_seen_at timestamptz;

-- Small shared settings, e.g. when the shared Gemini key may be used again.
create table if not exists app_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- #6: phone notifications. One row per device that turned them on.
create table if not exists push_subscriptions (
  endpoint   text primary key,
  user_email text not null references users(email) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_email);
-- Sent once: an alert for new urgent mail, and a reminder for a deadline due within a day.
alter table emails add column if not exists notified boolean not null default false;
alter table emails add column if not exists reminded boolean not null default false;

alter table app_state enable row level security;
alter table push_subscriptions enable row level security;
grant select, insert, update, delete on app_state, push_subscriptions to service_role;
