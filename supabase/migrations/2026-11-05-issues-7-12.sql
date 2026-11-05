-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- #10: set when Google says DELT's access was removed; cleared on the next sign-in.
alter table users add column if not exists access_revoked boolean not null default false;

select column_name from information_schema.columns where table_name = 'users' and column_name = 'access_revoked';
