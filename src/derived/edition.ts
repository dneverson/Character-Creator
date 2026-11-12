// Which rules edition applies to a character, for the rests, the conditions and the labels
// that differ between the 2014 and the 2024 rules. There is no setting for it: the first
// class's book decides, then the species' book, then the books selected (the 2024 rules
// when the 2024 Player's Handbook is on and the 2014 one is off, else the 2014 rules).

import type { Character } from '../character/model'
import type { Edition } from '../data/edition'

/** The edition a book source is written for, as the books list gives it. */
export type EditionOf = (source: string) => Edition

/** The edition of a source when the books list is not loaded: the 2024 books are these. */
const ONE_SOURCES: ReadonlySet<string> = new Set(['XPHB', 'XDMG', 'XMM'])
const fallbackEdition: EditionOf = (source) =>
  ONE_SOURCES.has(source) ? 'one' : 'classic'

export function characterEdition(
  character: Character,
  editionOf: EditionOf = fallbackEdition,
): Edition {
  const first = character.classes[0]
  if (first) return editionOf(first.source)
  if (character.race) return editionOf(character.race.source)
  const books = new Set(character.selectedBooks)
  return books.has('XPHB') && !books.has('PHB') ? 'one' : 'classic'
}
