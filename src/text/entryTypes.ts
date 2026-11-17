// The entry types the book renderer knows (see Entries.tsx), kept apart from the
// components so a test can read them.

/**
 * Every entry `type` the renderer draws. The books and adventures use all of these (and
 * the tables' detail panes use the first few); an audit test reads every book on a
 * machine that has them and fails on a type missing here.
 */
export const ENTRY_TYPES: readonly string[] = [
  'entries',
  'section',
  'inset',
  'insetReadaloud',
  'list',
  'item',
  'itemSub',
  'table',
  'tableGroup',
  'row',
  'cell',
  'cellHeader',
  'image',
  'gallery',
  'quote',
  'statblock',
  'flowBlock',
  'flowchart',
  'wrapper',
  'variantInner',
  'inlineBlock',
  'hr',
  'abilityGeneric',
  'abilityDc',
  'abilityAttackMod',
  'spellcasting',
  'actions',
  'attack',
]

/** Parts of an entry that are not entries themselves, and so never audited as one. */
export const NON_ENTRY_TYPES: readonly string[] = [
  // An image's address, and the grid laid over a map.
  'internal',
  'external',
  'square',
  'none',
  'hexColsOdd',
  'hexColsEven',
  'hexRowsOdd',
  'hexRowsEven',
]
