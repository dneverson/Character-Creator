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
