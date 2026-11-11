// Names in the data are lowercase ("thieves' tools", "sleight of hand"); this is
// how they are written for display.

const MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
])

/** Title-case lowercase data names, keeping minor words ("of", "the") lowercase. */
export function titleCase(s: string): string {
  return s.replace(/[\w']+/g, (w, offset: number) =>
    offset > 0 && MINOR_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
  )
}
