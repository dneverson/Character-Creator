-- Sharing a character by link, read-only.
--
-- A share is a row that names one of the signed-in user's characters and holds a random token.
-- Anyone who knows the token can read that one character through get_shared_character(), with
-- no account. Nothing else is open to the public: the table itself is private to its owner, and
-- the function hands out only the character, never its history log, and never a deleted one.
-- Turning sharing off deletes the row, so the old link stops working at once; turning it on
-- again makes a new token. A user has at most one share per character. Deleting a character
-- (its row gets "deleted_at") deletes its shares, so a character that is brought back later
-- never re-opens an old link.

create table public.character_shares (
  -- 128 random bits as 32 hex characters, made by the database (pgcrypto lives in the
  -- "extensions" schema on Supabase).
  token text primary key default encode(extensions.gen_random_bytes(16), 'hex'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  character_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, character_id),
  -- A share cannot outlive the character row, and cannot name another user's character.
  foreign key (user_id, character_id)
    references public.characters (user_id, id) on delete cascade
);

comment on table public.character_shares is
  'Read-only share links. A row exists only while its owner keeps the character shared.';

alter table public.character_shares enable row level security;

create policy "character_shares_select_own" on public.character_shares
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "character_shares_insert_own" on public.character_shares
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "character_shares_delete_own" on public.character_shares
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.character_shares from anon;
revoke all on table public.character_shares from public;
grant select, insert, delete on table public.character_shares to authenticated;

-- The one thing the public can do: read a shared character by its token. It returns the
-- character document without its history log ("history", and "rollHistory" in documents from
-- before the history existed), or null when the token is unknown, was stopped, or the
-- character was deleted (a deleted character keeps its row with "deleted_at" set).

create function public.get_shared_character(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select c.data - 'history' - 'rollHistory'
  from public.character_shares s
  join public.characters c
    on c.user_id = s.user_id and c.id = s.character_id
  where s.token = p_token and c.deleted_at is null
  limit 1;
$$;

comment on function public.get_shared_character(text) is
  'The shared character for a token, without its history log; null when none is shared.';

revoke all on function public.get_shared_character(text) from public;
grant execute on function public.get_shared_character(text) to anon, authenticated;

-- Deleting a character ends its sharing for good: when a row gets "deleted_at" set, its share
-- rows are deleted. It runs as the table owner because the user's own policies do not reach
-- the trigger's work.

create function public.end_shares_of_deleted_character()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.character_shares
  where user_id = new.user_id and character_id = new.id;
  return new;
end;
$$;

revoke all on function public.end_shares_of_deleted_character() from public;
revoke all on function public.end_shares_of_deleted_character() from anon;
revoke all on function public.end_shares_of_deleted_character() from authenticated;

create trigger characters_end_shares_on_delete
  after insert or update of deleted_at on public.characters
  for each row
  when (new.deleted_at is not null)
  execute function public.end_shares_of_deleted_character();
