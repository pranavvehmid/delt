-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- #40: the last sync problem per student (null when the last sync was clean).
alter table users add column if not exists last_sync_error text;
select column_name from information_schema.columns where table_name = 'users' and column_name = 'last_sync_error';
