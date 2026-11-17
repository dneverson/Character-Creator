// A crochet pattern of a book (the Crochet Adventures book), as the entries the reader
// prints: the facts a pattern opens with, then what it needs and how it is worked, each
// under its own heading. The data keeps these as fields, not as text, so they are set in
// order here; the words of every field are the book's own.

import { fetchData } from '../data/dataClient'
import type { Entry } from '../text/Entries'

const FILE = 'homecrafts.json'

/** What the one letter of a pattern's level stands for. */
const LEVELS: Readonly<Record<string, string>> = {
  B: 'Beginner',
  I: 'Intermediate',
  A: 'Advanced',
}

interface Measure {
  mm?: number
  entry?: string
}

/** One size a pattern is worked in, named when it has more than one. */
interface PatternSize {
  name?: string
  height?: Measure
  width?: Measure
}

/** The hooks of the pattern: a size in millimeters, or sizes by the part they are for. */
type Hook = number | { name: string; hooks: number[] }

/** A pattern of the data. */
export interface CrochetPattern {
  name: string
  source: string
  designers?: string[]
  level?: string
  patternType?: string
  size?: PatternSize[]
  sizeNote?: string
  yarn?: Entry[]
  hooks?: Hook[]
  notions?: Entry[]
  gauge?: Entry[]
  notes?: Entry[]
  stitches?: Entry[]
  abbreviations?: Entry[]
  instructions?: Entry[]
  finishing?: Entry[]
  seeAlsoItem?: string[]
  seeAlsoCreature?: string[]
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const sizeText = (size: PatternSize): string =>
  [
    size.name,
    size.height?.entry && `Height ${size.height.entry}`,
    size.width?.entry && `Width ${size.width.entry}`,
  ]
    .filter(Boolean)
    .join(', ')

const hookText = (hook: Hook): string =>
  typeof hook === 'number'
    ? `${hook} mm`
    : `${hook.name}: ${hook.hooks.map((mm) => `${mm} mm`).join(', ')}`

/** A heading of the pattern over its text, or nothing when the pattern has none of it. */
const section = (name: string, entries: Entry[] | undefined): Entry[] =>
  entries?.length ? [{ type: 'entries', name, entries }] : []

/** The entries a pattern is printed as. */
export function patternEntries(pattern: CrochetPattern): Entry[] {
  const facts: [string, string | undefined][] = [
    ['Designed by:', pattern.designers?.join(', ')],
    ['Level:', pattern.level && (LEVELS[pattern.level] ?? pattern.level)],
    ['Type:', pattern.patternType && capital(pattern.patternType)],
    ['Size:', pattern.size?.map(sizeText).join('; ') || undefined],
    ['Size note:', pattern.sizeNote],
  ]
  const alsoSee = [
    ...(pattern.seeAlsoItem ?? []).map((item) => `{@item ${item}}`),
    ...(pattern.seeAlsoCreature ?? []).map((creature) => `{@creature ${creature}}`),
  ]
  return [
    {
      type: 'list',
      style: 'list-hang-notitle',
      items: facts.flatMap(([name, text]) =>
        text ? [{ type: 'item', name, entries: [text] }] : [],
      ),
    },
    ...section('Yarn', pattern.yarn),
    ...section('Hook', pattern.hooks?.map(hookText)),
    ...section('Notions', pattern.notions),
    ...section('Gauge', pattern.gauge),
    ...section('Notes', pattern.notes),
    ...section('Stitches', pattern.stitches),
    ...section('Abbreviations', pattern.abbreviations),
    ...section('Instructions', pattern.instructions),
    ...section('Finishing', pattern.finishing),
    ...section('See also', alsoSee.length ? [alsoSee.join(', ')] : undefined),
  ]
}

/** The pattern of a book by its name, as the entries it is printed as. */
export async function loadCrochet(
  name: string,
  source: string | undefined,
): Promise<Entry[] | undefined> {
  const file = await fetchData<{ crochetPattern?: CrochetPattern[] }>(FILE).catch(
    (): { crochetPattern?: CrochetPattern[] } => ({}),
  )
  const same = (a: string, b: string | undefined) => a.toLowerCase() === b?.toLowerCase()
  const found = file.crochetPattern?.find(
    (pattern) =>
      same(pattern.name, name) && (source === undefined || same(pattern.source, source)),
  )
  return found && patternEntries(found)
}
