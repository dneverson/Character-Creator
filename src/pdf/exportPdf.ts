// Load the data a character references, build its sheet PDF, and download it.

import { loadClasses, type LoadedClass } from '../data/class'
import { findBackground, loadBackgrounds } from '../data/background'
import { findPlayableRace, loadRaces } from '../data/race'
import { loadFeats } from '../data/feats'
import { loadItems } from '../data/items'
import type { Character } from '../character/model'

function slugify(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'character'
  )
}

/** Build and download a fillable character-sheet PDF for a character. */
export async function exportCharacterPdf(character: Character): Promise<void> {
  // Load the PDF builder (and pdf-lib) lazily so it stays out of the main bundle.
  const [{ buildCharacterSheet }, classes, backgrounds, races, feats, items] =
    await Promise.all([
      import('./characterSheet'),
      loadClasses(),
      loadBackgrounds(),
      loadRaces(),
      loadFeats(),
      loadItems(),
    ])

  const classByKey = new Map<string, LoadedClass>()
  for (const l of classes) classByKey.set(`${l.entry.name}|${l.entry.source}`, l)

  const background = findBackground(backgrounds, character.background)
  const race = findPlayableRace(races, character.race)

  const bytes = await buildCharacterSheet(character, {
    classByKey,
    background,
    race,
    feats,
    items,
  })
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slugify(character.name)}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
