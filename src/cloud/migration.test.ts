import { describe, expect, it } from 'vitest'

// The migration is plain SQL that is never run by the tests; this only guards the rules
// the privacy page promises (private rows, immediate deletion) against an edit that drops
// them.
const files = import.meta.glob('../../supabase/migrations/*_characters.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const sql = Object.values(files).join('\n')

describe('the characters migration', () => {
  it('exists, and comes after the heartbeat migration', () => {
    expect(Object.keys(files)).toHaveLength(1)
    const name = Object.keys(files)[0].split('/').at(-1) ?? ''
    expect(name > '20261110001520_heartbeat.sql').toBe(true)
  })

  it('keeps each character with its owner, removed with the account', () => {
    expect(sql).toMatch(/user_id uuid not null default auth\.uid\(\)/)
    expect(sql).toMatch(/references auth\.users \(id\) on delete cascade/)
    expect(sql).toMatch(/primary key \(user_id, id\)/)
  })

  it('turns on row level security with a policy for each action, for the owner only', () => {
    expect(sql).toMatch(/alter table public\.characters enable row level security/)
    for (const action of ['select', 'insert', 'update', 'delete']) {
      expect(sql).toMatch(new RegExp(`create policy "characters_${action}_own"`))
    }
    expect(
      sql.match(/user_id = \(select auth\.uid\(\)\)/g)?.length,
    ).toBeGreaterThanOrEqual(5)
    expect(sql).toMatch(/revoke all on table public\.characters from anon/)
  })

  it('deletes an account only for a signed-in caller, on themselves', () => {
    expect(sql).toMatch(/create function public\.delete_my_account\(\)/)
    expect(sql).toMatch(/security definer\s+set search_path = ''/)
    expect(sql).toMatch(/delete from auth\.users where id = auth\.uid\(\)/)
    expect(sql).toMatch(
      /grant execute on function public\.delete_my_account\(\) to authenticated/,
    )
    expect(sql).toMatch(/revoke all on function public\.delete_my_account\(\) from anon/)
  })
})

const shareFiles = import.meta.glob('../../supabase/migrations/*_character_shares.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const shareSql = Object.values(shareFiles).join('\n')

describe('the character shares migration', () => {
  it('exists, and comes after the characters migration', () => {
    expect(Object.keys(shareFiles)).toHaveLength(1)
    const name = Object.keys(shareFiles)[0].split('/').at(-1) ?? ''
    expect(name > '20261120000000_characters.sql').toBe(true)
  })

  it('makes a 128-bit token in the database, one share per character, owned by the user', () => {
    expect(shareSql).toMatch(
      /token text primary key default encode\(extensions\.gen_random_bytes\(16\), 'hex'\)/,
    )
    expect(shareSql).toMatch(/user_id uuid not null default auth\.uid\(\)/)
    expect(shareSql).toMatch(/unique \(user_id, character_id\)/)
    expect(shareSql).toMatch(
      /foreign key \(user_id, character_id\)\s+references public\.characters \(user_id, id\) on delete cascade/,
    )
  })

  it('is private to its owner: policies for select, insert and delete, nothing for anon', () => {
    expect(shareSql).toMatch(
      /alter table public\.character_shares enable row level security/,
    )
    for (const action of ['select', 'insert', 'delete']) {
      expect(shareSql).toMatch(
        new RegExp(`create policy "character_shares_${action}_own"`),
      )
    }
    expect(shareSql).not.toMatch(/create policy "character_shares_update/)
    expect(shareSql).toMatch(/revoke all on table public\.character_shares from anon/)
    expect(shareSql).toMatch(
      /grant select, insert, delete on table public\.character_shares to authenticated/,
    )
  })

  it('gives the public one function: the character by token, without history, never a deleted one', () => {
    expect(shareSql).toMatch(
      /create function public\.get_shared_character\(p_token text\)/,
    )
    expect(shareSql).toMatch(/returns jsonb/)
    expect(shareSql).toMatch(/stable\s+security definer\s+set search_path = ''/)
    expect(shareSql).toMatch(/c\.data - 'history' - 'rollHistory'/)
    expect(shareSql).toMatch(/c\.deleted_at is null/)
    expect(shareSql).toMatch(
      /grant execute on function public\.get_shared_character\(text\) to anon, authenticated/,
    )
    expect(shareSql).toMatch(
      /revoke all on function public\.get_shared_character\(text\) from public/,
    )
  })

  it("ends a character's shares when it is deleted, so bringing it back never reopens a link", () => {
    expect(shareSql).toMatch(
      /create function public\.end_shares_of_deleted_character\(\)/,
    )
    expect(shareSql).toMatch(
      /delete from public\.character_shares\s+where user_id = new\.user_id and character_id = new\.id/,
    )
    expect(shareSql).toMatch(
      /create trigger characters_end_shares_on_delete\s+after insert or update of deleted_at on public\.characters/,
    )
    expect(shareSql).toMatch(/when \(new\.deleted_at is not null\)/)
    expect(shareSql).toMatch(
      /revoke all on function public\.end_shares_of_deleted_character\(\) from authenticated/,
    )
  })
})
