-- Accounts and cloud copies of characters.
--
-- A signed-in user's characters are mirrored here so they follow the user between devices. The
-- app keeps its own copy on the device and works without this table; the table only ever holds
-- what its owner put there. `data` is the character document as the app stores it, history
-- included. A deleted character stays as a row with `deleted_at` set (and an empty `data`), so
-- another device learns of the deletion the next time it syncs.

create table public.characters (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, id)
);

comment on table public.characters is
  'Cloud copies of a signed-in user''s characters. Rows are private to their owner.';

alter table public.characters enable row level security;

create policy "characters_select_own" on public.characters
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "characters_insert_own" on public.characters
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "characters_update_own" on public.characters
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "characters_delete_own" on public.characters
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.characters from anon;
revoke all on table public.characters from public;
grant select, insert, update, delete on table public.characters to authenticated;

-- Deletes the signed-in user's account at once. The characters go with it, because their rows
-- reference the user with "on delete cascade". Only a signed-in user can run it, and only on
-- themselves: it takes no argument and reads the caller from the sign-in token.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

comment on function public.delete_my_account() is
  'Deletes the calling user''s account and, by cascade, all of their characters.';

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
