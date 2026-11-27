-- The server's own copy of each character's history log.
--
-- A character document carries its history log, but the document is plain JSON that the
-- player can edit. So that a Dungeon Master can trust a history, the app also sends each
-- log entry here, where it is only ever added to. A row holds the entry exactly as the
-- device sent it, plus "recorded_at", the time the server received it. An entry from an
-- imported file keeps its own "at" inside "entry", while "recorded_at" shows when the
-- server first learned of it, which is how the two can be told apart.
--
-- Append-only: the owner can read and add rows and nothing else. There is no update or
-- delete policy and no update or delete privilege, so a player cannot change or remove an
-- entry. The ledger goes only when its character is deleted or the account is deleted.
--
-- "recorded_at" cannot be forged: the insert privilege is granted on three columns only
-- (character_id, event_id, entry), so a request that names "recorded_at" or "user_id" is
-- refused, and both fall back to their defaults (now() and the signed-in user).
-- Sending an entry twice does nothing (the app uses "on conflict do nothing").

create table public.character_events (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  character_id text not null,
  event_id text not null,
  entry jsonb not null,
  recorded_at timestamptz not null default now(),
  primary key (user_id, character_id, event_id),
  -- An event cannot outlive its character row, and cannot name another user's character.
  foreign key (user_id, character_id)
    references public.characters (user_id, id) on delete cascade
);

comment on table public.character_events is
  'Append-only server record of character history entries. Owner can read and add only.';

alter table public.character_events enable row level security;

create policy "character_events_select_own" on public.character_events
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "character_events_insert_own" on public.character_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on table public.character_events from anon;
revoke all on table public.character_events from public;
-- Supabase grants new tables to its roles by default: take every privilege back, then give
-- only reading and the three-column insert.
revoke all on table public.character_events from authenticated;
grant select on table public.character_events to authenticated;
grant insert (character_id, event_id, entry) on table public.character_events
  to authenticated;

-- Deleting a character ends its ledger for good: when a row gets "deleted_at" set, its
-- events are deleted, as its shares are (see character_shares). It runs as the table
-- owner because the user has no delete privilege, by design.

create function public.end_events_of_deleted_character()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.character_events
  where user_id = new.user_id and character_id = new.id;
  return new;
end;
$$;

revoke all on function public.end_events_of_deleted_character() from public;
revoke all on function public.end_events_of_deleted_character() from anon;
revoke all on function public.end_events_of_deleted_character() from authenticated;

create trigger characters_end_events_on_delete
  after insert or update of deleted_at on public.characters
  for each row
  when (new.deleted_at is not null)
  execute function public.end_events_of_deleted_character();
