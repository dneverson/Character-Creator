// Who a character is, in words: the line under its name in the header and the list.

import type { Character } from './model'

/** "Druid 5 (Circle of the Moon) / Fighter 2": the classes with their levels. */
export function classLine(character: Character): string {
  return character.classes
    .filter((c) => c.level > 0)
    .map((c) => `${c.name} ${c.level}${c.subclass ? ` (${c.subclass.name})` : ''}`)
    .join(' / ')
}

/** "Wood Elf, Druid 5 (Circle of the Moon), Hermit": who the character is, in one line. */
export function identityLine(character: Character): string {
  return [character.race?.name, classLine(character), character.background?.name]
    .filter(Boolean)
    .join(', ')
}
