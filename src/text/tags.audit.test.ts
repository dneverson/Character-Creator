// The audit of the tags: every `{@tag` of every data file of the content source is read,
// and a tag that has neither a rule in TAG_RULES nor a place among the lookup's reference
// tags fails the test, so a new tag in the source is noticed instead of printing raw. The
// data is not in this repository; the copy under `.local/data` is read when a machine has
// one (`.local/scripts/books/pull.mjs` makes it) and the audit is skipped where there is
// none.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REFERENCE_TAGS } from '../lookup/references'
import { TAG_RULES } from './tags'

/** Count the name of every `{@tag` under a folder of JSON files. */
export function countTags(folder: string, counts = new Map<string, number>()) {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) countTags(path, counts)
    else if (name.endsWith('.json')) {
      for (const [, tag] of readFileSync(path, 'utf8').matchAll(/\{@(\w+)/g)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
  }
  return counts
}

/** The tags found that the renderer has no place for. */
export function unhandledTags(counts: Map<string, number>): string[] {
  return [...counts.keys()].filter((tag) => !(tag in TAG_RULES || tag in REFERENCE_TAGS))
}

const root = join('.local', 'data')

describe('the tags', () => {
  it('are compared with the ones that are drawn', () => {
    expect(
      unhandledTags(
        new Map([
          ['atk', 1],
          ['spell', 2],
          ['odd', 3],
        ]),
      ),
    ).toEqual(['odd'])
  })

  it.skipIf(!existsSync(root))('of every file on this machine are all drawn', () => {
    const counts = countTags(root)
    expect(counts.size).toBeGreaterThan(50)
    expect(unhandledTags(counts)).toEqual([])
  })
})
