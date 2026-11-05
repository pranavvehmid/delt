-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- #30 / #35: one sync per student at a time, and at most one start every few seconds.
alter table users add column if not exists sync_started_at timestamptz;
alter table users add column if not exists sync_finished_at timestamptz;

-- Claims the right to sync this student now. Returns true if claimed, null if:
--  - a sync started less than p_gap_seconds ago (rate limit), or
--  - a sync is still running (started, not finished, and less than p_lock_seconds old).
create or replace function claim_sync(p_email text, p_gap_seconds int default 10, p_lock_seconds int default 180)
returns boolean
language sql
as $$
  update users set sync_started_at = now()
  where email = p_email
    and (sync_started_at is null or sync_started_at < now() - make_interval(secs => p_gap_seconds))
    and (sync_started_at is null
         or (sync_finished_at is not null and sync_finished_at >= sync_started_at)
         or sync_started_at < now() - make_interval(secs => p_lock_seconds))
  returning true;
$$;
revoke all on function claim_sync(text, int, int) from public, anon, authenticated;
grant execute on function claim_sync(text, int, int) to service_role;

select proname from pg_proc where proname = 'claim_sync'
union all select column_name from information_schema.columns where table_name = 'users' and column_name in ('sync_started_at', 'sync_finished_at');
