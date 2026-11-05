-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- #31: the student's answer to "Let AI check unclear mail?". null = not asked yet; AI is off until true.
alter table users add column if not exists ai_consent boolean;
-- Everyone is asked once in the app, including students who added their own key.

select column_name from information_schema.columns where table_name = 'users' and column_name = 'ai_consent';
