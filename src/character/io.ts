// Import / export a character as a JSON file.

import {
  DEFAULT_BOOKS,
  ensureCharacterDefaults,
  historyEntry,
  type Character,
  type StoredCharacter,
} from './model'

/** Trigger a browser download of a character as pretty-printed JSON. */
export function downloadCharacter(character: Character): void {
  const blob = new Blob([JSON.stringify(character, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const safeName = character.name.replace(/[^\w-]+/g, '_').slice(0, 60) || 'character'
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Parse an imported character and complete it for the current model, whatever
 * version of the app wrote the file. Always assigns a fresh id and timestamps so
 * importing never overwrites an existing character. Its history comes along,
 * every entry as the user's own account (a file cannot vouch for itself), and the
 * import is added to it. Throws on clearly invalid input.
 */
export function parseImportedCharacter(text: string): Character {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('File is not valid JSON.')
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('File does not contain a character object.')
  }
  const obj = raw as StoredCharacter
  const name =
    typeof obj.name === 'string' && obj.name.trim() ? obj.name : 'Imported Character'
  const selectedBooks =
    Array.isArray(obj.selectedBooks) &&
    obj.selectedBooks.every((x) => typeof x === 'string')
      ? obj.selectedBooks
      : [...DEFAULT_BOOKS]

  const now = Date.now()
  const character = ensureCharacterDefaults({ ...obj, name, selectedBooks })
  const from = typeof obj.id === 'string' ? obj.id : undefined
  return {
    ...character,
    id: crypto.randomUUID(),
    history: [
      ...character.history.map((entry) => ({ ...entry, by: 'device' as const })),
      historyEntry(now, { type: 'imported', ...(from && { from }) }),
    ],
    createdAt: now,
    updatedAt: now,
  }
}
