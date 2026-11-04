-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

-- One row per signed-in Google account. Stores the refresh token so the
-- server can fetch mail in the background (cron) without you being online.
create table if not exists users (
  email           text primary key,
  refresh_token   text not null,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now()
);

-- One row per sorted email. Only a short preview is stored, never the full body.
create table if not exists emails (
  id            text primary key,          -- Gmail message id
  user_email    text not null references users(email) on delete cascade,
  thread_id     text,
  from_name     text,
  from_address  text,
  subject       text,
  snippet       text,
  received_at   timestamptz not null,
  priority      text not null check (priority in ('very_important','priority','later','noise')),
  category      text not null,
  summary       text not null,
  deadline      timestamptz,
  reason        text,
  -- true when you moved the mail yourself; the sorter learns from these
  user_corrected boolean not null default false,
  is_done       boolean not null default false,
  gmail_labeled boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists emails_user_received_idx on emails (user_email, received_at desc);
create index if not exists emails_user_deadline_idx on emails (user_email, deadline) where deadline is not null;

-- 'rules' or 'ai'. Rules-sorted mails get re-checked by the free AI when quota allows.
alter table emails add column if not exists sorted_by text not null default 'rules';

-- Mirrors Gmail's UNREAD label; refreshed on every sync. Drives the NEW deck.
alter table emails add column if not exists unread boolean not null default false;

-- One row per student per mail. Gmail message ids are per mailbox, so two
-- students can receive mail with the same id; the key must include the owner.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'emails'::regclass and contype = 'p' and array_length(conkey, 1) = 1
  ) then
    alter table emails drop constraint emails_pkey;
    alter table emails add constraint emails_pkey primary key (user_email, id);
  end if;
end $$;

-- Lock both tables. The app only talks to them from the server with the
-- service-role key, so the public (anon) key can read nothing.
alter table users  enable row level security;
alter table emails enable row level security;

-- New Supabase projects don't expose new tables automatically, so grant the
-- server key access explicitly.
grant select, insert, update, delete on users, emails to service_role;

-- Unused since v2 (deadlines now come only from mail). Kept so old installs stay valid.
create table if not exists deadlines (
  id          uuid primary key default gen_random_uuid(),
  user_email  text not null references users(email) on delete cascade,
  title       text not null,
  due_at      timestamptz not null,
  email_id    text,
  note        text,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists deadlines_user_due_idx on deadlines (user_email, due_at);
alter table deadlines enable row level security;
grant select, insert, update, delete on deadlines to service_role;

-- Your answer to "track this deadline?": 'tracked' or 'skipped'.
alter table emails add column if not exists deadline_choice text;
