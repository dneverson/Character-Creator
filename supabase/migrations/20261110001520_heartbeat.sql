-- Keep-alive probe for the Supabase Free plan.
--
-- Supabase pauses a Free plan project after about a week of low database activity, and a paused
-- project stays down until someone clicks Resume in the dashboard. The scheduled workflow
-- .github/workflows/supabase-heartbeat.yml calls this function through the Data API several times
-- a day, so the project always has real database requests.
--
-- It is read-only and returns nothing but the database clock on purpose: the publishable key that
-- calls it ships in the browser, so anyone can run it and it must give them nothing.

create function public.heartbeat()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

comment on function public.heartbeat() is
  'Keep-alive probe called by the scheduled GitHub workflow. Returns the database clock.';

revoke all on function public.heartbeat() from public;
grant execute on function public.heartbeat() to anon;
