import type { SourceRef } from '../../derived/types'

const KIND_WORD: Partial<Record<SourceRef['kind'], string>> = {
  race: 'race',
  background: 'background',
  feat: 'feat',
  option: 'option',
  item: 'item',
}

/** Where a value comes from, in the words a player knows it by. */
export function sourceText(source: SourceRef): string {
  const word = KIND_WORD[source.kind]
  return word ? `${source.label} (${word})` : source.label
}
