import { Fragment, useContext, type ReactNode } from 'react'
import Table from 'react-bootstrap/Table'
import { placeOfTarget } from '../books/address'
import { headingDomId, headingKey } from '../books/outline'
import { BookLink } from '../books/BookLink'
import { referenceOf } from '../lookup/references'
import {
  EntryContext,
  type AnchorProps,
  type EntryContextValue,
  type ImageEntry,
  type StatblockEntry,
} from './entryContext'
import { TaggedText } from './TaggedText'
import { TagRef } from './TagRef'
import { stripTags } from './tags'

// Minimal shapes for the 5etools "entries" structures we render.
interface ListEntry {
  type: 'list'
  items: Entry[]
  name?: string
  style?: string
  columns?: number
  /** The number the first item of a numbered list has. */
  start?: number
}
interface NamedEntry {
  type: 'entries' | 'section' | 'inset' | 'insetReadaloud' | 'variantInner' | 'flowBlock'
  name?: string
  page?: number
  /** The page the book prints it on, when that is not where the text has it. */
  printedOn?: number
  style?: string
  entries?: Entry[]
}
interface TableEntry {
  type: 'table'
  caption?: string
  colLabels?: string[]
  /** Header rows of several lines, whose cells may span columns. */
  colLabelRows?: Entry[][]
  colStyles?: string[]
  /** A row is its cells, or a `row` entry that holds them. */
  rows: (Entry[] | Entry)[]
  footnotes?: Entry[]
  isStriped?: boolean
}
interface AttackEntry {
  attackType?: string
  attackEntries?: string[]
  hitEntries?: string[]
}
const ATTACKS: Record<string, string> = {
  MW: 'Melee Weapon Attack',
  RW: 'Ranged Weapon Attack',
  MS: 'Melee Spell Attack',
  RS: 'Ranged Spell Attack',
}
type ObjEntry =
  ListEntry | NamedEntry | TableEntry | { type?: string; [k: string]: unknown }
export type Entry = string | number | ObjEntry

const ABILITIES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
  spellcasting: 'spellcasting ability',
}

const ordinal = (n: number) =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}`

/** The ability words of an ability line: "Strength or Dexterity". */
function abilityNames(attributes: unknown): string {
  const names = (Array.isArray(attributes) ? attributes : []).map(
    (a) => ABILITIES[String(a)] ?? String(a),
  )
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
    : names.join('')
}

function Tagged({ text }: { text: string }) {
  return <TaggedText text={text} />
}

function cellText(cell: Entry, depth: number, book: boolean): ReactNode {
  if (typeof cell === 'string' || typeof cell === 'number')
    return <TaggedText text={String(cell)} />
  const obj = cell as Record<string, unknown>
  if (obj.type === 'cell' && obj.roll) {
    const roll = obj.roll as { exact?: number; min?: number; max?: number }
    if (roll.exact != null) return String(roll.exact)
    if (roll.min != null && roll.max != null) return `${roll.min}–${roll.max}`
  }
  if ('entry' in obj && typeof obj.entry === 'string')
    return <TaggedText text={obj.entry} />
  // A cell that holds more than a line (a list, several paragraphs): only the book
  // draws those, as the detail panes have never had them.
  if (book) {
    if (Array.isArray(obj.entries))
      return <EntryList entries={obj.entries as Entry[]} depth={depth} />
    if (obj.entry && typeof obj.entry === 'object')
      return <EntryList entries={[obj.entry as Entry]} depth={depth} />
  }
  return ''
}

/** The classes a table column's style asks for: alignment and whether it holds its line. */
function columnClass(style: string | undefined): string | undefined {
  if (!style) return undefined
  const classes = [
    style.includes('text-center') && 'text-center',
    style.includes('text-right') && 'text-end',
    style.includes('no-wrap') && 'text-nowrap',
  ].filter(Boolean)
  return classes.length > 0 ? classes.join(' ') : undefined
}

/** The share of the table's width each column asks for ("col-2" is 2 of 12), when all do. */
function columnShares(styles: string[] | undefined): number[] | undefined {
  const asked = (styles ?? []).map(
    (style) => /(?:^|\s)col-(\d+)(?:\s|$)/.exec(style)?.[1],
  )
  if (asked.length === 0 || asked.some((width) => width === undefined)) return undefined
  const total = asked.reduce((sum, width) => sum + Number(width), 0)
  return asked.map((width) => (Number(width) / total) * 100)
}

/** The cells of one row, where a cell may span columns (its `width`) and carry a style. */
function renderCells(
  cells: Entry[],
  depth: number,
  cls: (column: number) => string | undefined,
  head: boolean,
  book: boolean,
) {
  let column = 0
  return cells.map((cell, i) => {
    const named =
      typeof cell === 'object'
        ? (cell as { type?: string; width?: number; style?: string })
        : undefined
    const span = book && named?.width && named.width > 1 ? named.width : undefined
    const Cell = head || named?.type === 'cellHeader' ? 'th' : 'td'
    const className = [cls(column), book && named?.style].filter(Boolean).join(' ')
    column += span ?? 1
    return (
      <Cell key={i} className={className || undefined} colSpan={span}>
        {cellText(cell, depth, book)}
      </Cell>
    )
  })
}

/**
 * The id and the key a heading carries in the page, from its anchor in its chapter, and the
 * page the text marks it on.
 */
function anchorProps(entry: object, context: EntryContextValue): AnchorProps {
  const anchor = context.anchors?.get(entry)
  const chapter = context.chapter ?? 0
  const page = (entry as { page?: unknown }).page
  return {
    ...(anchor && {
      id: headingDomId(chapter, anchor),
      'data-anchor': headingKey(chapter, anchor),
    }),
    ...(typeof page === 'number' && { 'data-page': page }),
  }
}

/** The way from an area's heading to the maps it is drawn on. */
function MapLinks({
  id,
  context,
}: {
  id: string | undefined
  context: EntryContextValue
}) {
  const maps = id ? context.maps?.get(id) : undefined
  const { doc } = context
  if (!maps || !doc) return null
  return (
    <span className="book-heading-maps">
      {maps.map((map) => (
        <BookLink key={map.anchor} place={placeOfTarget(doc, map)}>
          Map: {map.name}
        </BookLink>
      ))}
    </span>
  )
}

/** Where a part the text only shows is printed (see src/books/printOrder.ts). */
export function PrintedOn({ page, block }: { page?: number; block?: boolean }) {
  if (page === undefined) return null
  const Tag = block ? 'div' : 'span'
  return <Tag className="book-printed-on">Printed on page {page}</Tag>
}

/** A named part of the book: its heading, with the address a link or a result jumps to. */
function BookHeading({
  entry,
  depth,
  box,
  context,
}: {
  entry: NamedEntry
  depth: number
  box: boolean
  context: EntryContextValue
}) {
  const level = Math.min(depth + (box ? 3 : 2), 6)
  const Tag = `h${level}` as 'h2'
  return (
    <Tag
      {...anchorProps(entry, context)}
      className={
        box ? 'book-box-title' : `book-heading book-heading-${Math.min(depth, 4)}`
      }
    >
      <TaggedText text={entry.name ?? ''} />
      <PrintedOn page={entry.printedOn} />
      <MapLinks id={(entry as { id?: string }).id} context={context} />
    </Tag>
  )
}

/**
 * A named part that runs in: its name in bold italic at the start of its first
 * paragraph ("Amphibious. The aboleth can breathe..."), as the printed books set the
 * lowest headings and every trait and action of a stat block.
 */
function RunIn({
  entry,
  depth,
  context,
  className,
}: {
  entry: NamedEntry
  depth: number
  context: EntryContextValue
  className?: string
}) {
  const [first, ...rest] = entry.entries ?? []
  const lead = typeof first === 'string' || typeof first === 'number'
  return (
    <div className={className}>
      <p className="mb-2">
        <span {...anchorProps(entry, context)} className="book-run-in">
          <TaggedText text={entry.name ?? ''} />
          {/[.:!?]$/.test(stripTags(entry.name ?? '')) ? '' : '.'}
        </span>
        <PrintedOn page={entry.printedOn} />
        {lead && (
          <>
            {' '}
            <TaggedText text={String(first)} />
          </>
        )}
      </p>
      <EntryList entries={lead ? rest : (entry.entries ?? [])} depth={depth + 1} />
    </div>
  )
}

function ImageNote({ image }: { image: ImageEntry }) {
  return (
    <p className="text-body-secondary fst-italic mb-2">
      Image{image.title ? `: ${stripTags(image.title)}` : ''}
    </p>
  )
}

/** A stat block, or another entry the book only points at: named, and linked to the lookup. */
export function StatblockNote({
  entry,
  note = 'drawn in the lookup, not in the text of the book.',
}: {
  entry: StatblockEntry
  note?: string
}) {
  const name = entry.name ?? ''
  const tag = entry.tag ?? ''
  const source = entry.source ? `|${entry.source}` : ''
  const reference = name && tag ? referenceOf(tag, `${name}${source}`) : undefined
  return (
    <aside className="book-statblock mb-2">
      <span className="book-run">{tag ? 'Entry' : 'Stat block'}:</span>{' '}
      {reference ? <TagRef reference={reference} text={name} /> : name}
      {entry.source && <span className="text-body-secondary"> ({entry.source})</span>}
      <span className="text-body-secondary"> - {note}</span>
    </aside>
  )
}

function spellLines(spells: unknown): ReactNode[] {
  const levels = (spells ?? {}) as Record<string, { slots?: number; spells?: string[] }>
  return Object.keys(levels)
    .sort()
    .map((level) => {
      const row = levels[level]
      const label =
        level === '0'
          ? 'Cantrips (at will)'
          : `${ordinal(Number(level))} level${row.slots ? ` (${row.slots} slots)` : ''}`
      return (
        <p key={level} className="mb-1">
          <span className="book-run">{label}:</span>{' '}
          <Tagged text={(row.spells ?? []).join(', ')} />
        </p>
      )
    })
}

/** A line of at-will or per-day spells of a stat block: "3/day each: ...". */
function usageLines(entry: Record<string, unknown>): ReactNode[] {
  const lines: ReactNode[] = []
  const will = entry.will
  if (Array.isArray(will))
    lines.push(
      <p key="will" className="mb-1">
        <span className="book-run">At will:</span> <Tagged text={will.join(', ')} />
      </p>,
    )
  const daily = (entry.daily ?? {}) as Record<string, string[]>
  for (const key of Object.keys(daily).sort()) {
    const each = key.endsWith('e')
    lines.push(
      <p key={`daily-${key}`} className="mb-1">
        <span className="book-run">
          {parseInt(key, 10)}/day{each ? ' each' : ''}:
        </span>{' '}
        <Tagged text={daily[key].join(', ')} />
      </p>,
    )
  }
  return lines
}

function renderItem(obj: Record<string, unknown>, depth: number, book: boolean) {
  const it = obj as {
    name?: string
    entry?: string
    entries?: Entry[]
    nameDot?: boolean
  }
  if (book) {
    // The text a named item opens with runs in after its name, as the printed lists set it
    // ("Row 1: (Aruba Sea) ch46..."); what follows it stands as paragraphs.
    const [lead, ...rest] = it.entries ?? []
    const runsIn = !it.entry && it.name !== undefined && typeof lead === 'string'
    const entry = it.entry ? (
      <Tagged text={it.entry} />
    ) : runsIn ? (
      <Tagged text={lead} />
    ) : null
    const more = runsIn ? rest : it.entries
    return (
      <div className="book-item">
        {it.name && (
          <>
            <strong className="book-run">
              <TaggedText text={it.name} />
              {it.nameDot === false ? '' : it.name.match(/[.:!?]$/) ? '' : '.'}
            </strong>{' '}
          </>
        )}
        {entry}
        {more && more.length > 0 && <EntryList entries={more} depth={depth} />}
      </div>
    )
  }
  // List items with a bold name and inline text (e.g. background "Skill
  // Proficiencies: ...", "Languages: ...", "Equipment: ...").
  return (
    <div className="mb-1">
      {it.name && (
        <>
          <span className="fw-semibold text-decoration-underline">{it.name}</span>{' '}
        </>
      )}
      {it.entry && (
        <span>
          <TaggedText text={it.entry} />
        </span>
      )}
      {it.entries && <EntryList entries={it.entries} depth={depth} />}
    </div>
  )
}

/** The cells of a table row, which is a list of them or a `row` entry holding them. */
function rowCells(row: Entry[] | Entry): Entry[] {
  if (Array.isArray(row)) return row
  if (typeof row === 'object' && 'row' in row && Array.isArray(row.row)) return row.row
  return []
}

/** The style a `row` entry names for its row ("row-indent-first"). */
const rowStyle = (row: Entry): string | undefined =>
  typeof row === 'object' ? (row as { style?: string }).style : undefined

function renderTable(t: TableEntry, depth: number, context: EntryContextValue | null) {
  const book = context?.book === true
  const cls = (i: number) => (book ? columnClass(t.colStyles?.[i]) : undefined)
  const shares = book ? columnShares(t.colStyles) : undefined
  return (
    <div className={`table-responsive mb-2${book ? ' book-table-wrap' : ''}`}>
      <Table
        size="sm"
        bordered
        striped={book && t.isStriped !== false}
        className={book ? 'book-table mb-0' : 'mb-0'}
      >
        {book && t.caption && (
          <caption className="book-table-caption">
            <TaggedText text={t.caption} />
          </caption>
        )}
        {shares && (
          <colgroup>
            {shares.map((share, i) => (
              <col key={i} style={{ width: `${share}%` }} />
            ))}
          </colgroup>
        )}
        {book && t.colLabelRows ? (
          <thead>
            {t.colLabelRows.map((row, ri) => (
              <tr key={ri}>{renderCells(row, depth, cls, true, book)}</tr>
            ))}
          </thead>
        ) : (
          t.colLabels && (
            <thead>
              <tr>
                {t.colLabels.map((c, i) => (
                  <th key={i} className={cls(i)}>
                    {book ? <TaggedText text={c} /> : stripTags(c)}
                  </th>
                ))}
              </tr>
            </thead>
          )
        )}
        <tbody>
          {t.rows.map((row, ri) => (
            <tr
              key={ri}
              className={(book && !Array.isArray(row) && rowStyle(row)) || undefined}
            >
              {renderCells(rowCells(row), depth, cls, false, book)}
            </tr>
          ))}
        </tbody>
      </Table>
      {book && t.footnotes && (
        <div className="book-table-notes small">
          <EntryList entries={t.footnotes} depth={depth} />
        </div>
      )}
    </div>
  )
}

function renderEntry(
  entry: Entry,
  key: number,
  depth: number,
  context: EntryContextValue | null,
  headed = false,
): ReactNode {
  const book = context?.book === true
  if (typeof entry === 'string' || typeof entry === 'number') {
    return (
      <p key={key} className="mb-2">
        <TaggedText text={String(entry)} />
      </p>
    )
  }
  const obj = entry as ObjEntry
  switch (obj.type) {
    case 'list': {
      const list = obj as ListEntry
      const style = list.style ?? ''
      const Tag = style.includes('list-decimal') ? 'ol' : 'ul'
      return (
        <Fragment key={key}>
          {book && list.name && (
            <p className="book-list-title mb-1">
              <TaggedText text={list.name} />
            </p>
          )}
          <Tag
            start={Tag === 'ol' && book ? list.start : undefined}
            className={`mb-2${book ? ` book-list ${style}` : ''}`}
            style={book && list.columns ? { columnCount: list.columns } : undefined}
          >
            {list.items.map((item, i) => (
              <li key={i}>
                {typeof item === 'string' || typeof item === 'number' ? (
                  <TaggedText text={String(item)} />
                ) : (
                  <EntryList entries={[item]} depth={depth} />
                )}
              </li>
            ))}
          </Tag>
        </Fragment>
      )
    }
    case 'section':
    case 'entries':
    case 'inset':
    case 'insetReadaloud':
    case 'variantInner':
    case 'flowBlock': {
      const named = obj as NamedEntry
      if (!book) {
        return (
          <div key={key} className="mb-2">
            {named.name && <div className="fw-semibold">{named.name}</div>}
            {named.entries && <EntryList entries={named.entries} depth={depth} />}
          </div>
        )
      }
      const box = !['section', 'entries'].includes(String(named.type))
      const style = (named.style ?? '').split(' ').filter(Boolean)
      const body = named.entries && (
        <EntryList
          entries={named.entries}
          depth={named.name ? depth + 1 : depth}
          heading={named.name}
        />
      )
      const title = named.name && (
        <BookHeading entry={named} depth={depth} box={box} context={context} />
      )
      const runIn =
        !box &&
        named.name &&
        named.type === 'entries' &&
        context.runInFrom !== undefined &&
        depth >= context.runInFrom
      if (runIn) {
        return (
          <RunIn
            key={key}
            entry={named}
            depth={depth}
            context={context}
            className={style.join(' ') || undefined}
          />
        )
      }
      if (!box) {
        return (
          <div key={key} className={style.join(' ') || undefined}>
            {title}
            {body}
          </div>
        )
      }
      const kind =
        named.type === 'insetReadaloud'
          ? 'book-readaloud'
          : named.type === 'flowBlock'
            ? 'book-flowblock'
            : 'book-inset'
      return (
        <aside key={key} className={`${kind} ${style.join(' ')}`.trim()}>
          {title}
          {body}
        </aside>
      )
    }
    case 'table':
      return (
        <Fragment key={key}>{renderTable(obj as TableEntry, depth, context)}</Fragment>
      )
    case 'tableGroup': {
      const group = obj as { name?: string; tables?: TableEntry[] }
      return (
        <div key={key} className="mb-2">
          {group.name && (
            <p className="book-list-title mb-1">
              <TaggedText text={group.name} />
            </p>
          )}
          {(group.tables ?? []).map((table, i) => (
            <Fragment key={i}>{renderTable(table, depth, context)}</Fragment>
          ))}
        </div>
      )
    }
    case 'row':
    case 'cell':
    case 'cellHeader':
      // Outside a table: its text.
      return (
        <p key={key} className="mb-2">
          {cellText(obj, depth, book)}
        </p>
      )
    case 'actions': {
      // An action of an object or a vehicle: its name, then what it does.
      const named = obj as NamedEntry
      return (
        <div key={key} className="mb-2">
          {named.name && <span className="fw-semibold">{named.name}. </span>}
          {named.entries && <EntryList entries={named.entries} depth={depth} />}
        </div>
      )
    }
    case 'attack': {
      const attack = obj as AttackEntry
      const label = ATTACKS[(attack.attackType ?? '').split(',')[0]] ?? 'Attack'
      return (
        <p key={key} className="mb-2">
          <em>{label}:</em> <TaggedText text={(attack.attackEntries ?? []).join(' ')} />{' '}
          <em>Hit:</em> <TaggedText text={(attack.hitEntries ?? []).join(' ')} />
        </p>
      )
    }
    case 'item':
    case 'itemSub':
      return (
        <Fragment key={key}>
          {renderItem(obj as Record<string, unknown>, depth, book)}
        </Fragment>
      )
    case 'quote': {
      const quote = obj as {
        entries?: Entry[]
        by?: string
        from?: string
        style?: string
      }
      return (
        <blockquote key={key} className={`book-quote ${quote.style ?? ''}`.trim()}>
          {quote.entries && <EntryList entries={quote.entries} depth={depth} />}
          {(quote.by || quote.from) && (
            <footer className="book-quote-by">
              - {quote.by && <TaggedText text={quote.by} />}
              {quote.by && quote.from && ', '}
              {quote.from && (
                <cite>
                  <TaggedText text={quote.from} />
                </cite>
              )}
            </footer>
          )}
        </blockquote>
      )
    }
    case 'image': {
      const image = obj as ImageEntry
      return (
        <Fragment key={key}>
          {context?.renderImage ? (
            context.renderImage(image)
          ) : (
            <ImageNote image={image} />
          )}
        </Fragment>
      )
    }
    case 'gallery': {
      const gallery = obj as { name?: string; images?: ImageEntry[] }
      return (
        <div key={key} className="book-gallery mb-2">
          {gallery.name && (
            <p className="book-list-title mb-1">
              <TaggedText text={gallery.name} />
            </p>
          )}
          {(gallery.images ?? []).map((image, i) => (
            <Fragment key={i}>
              {context?.renderImage ? (
                context.renderImage(image, gallery.images)
              ) : (
                <ImageNote image={image} />
              )}
            </Fragment>
          ))}
        </div>
      )
    }
    case 'statblock':
      return (
        <Fragment key={key}>
          {context?.renderStatblock ? (
            context.renderStatblock(
              obj as StatblockEntry,
              headed,
              anchorProps(obj, context),
            )
          ) : (
            <StatblockNote entry={obj as StatblockEntry} />
          )}
        </Fragment>
      )
    case 'flowchart': {
      const blocks = ((obj as { blocks?: Entry[] }).blocks ?? []) as Entry[]
      return (
        <div key={key} className="book-flowchart mb-2">
          <EntryList entries={blocks} depth={depth} />
        </div>
      )
    }
    case 'wrapper':
      return (
        <EntryList
          key={key}
          entries={(obj as { wrappeds?: Entry[] }).wrappeds ?? []}
          depth={depth}
        />
      )
    case 'inlineBlock': {
      const inline = (obj as { entries?: Entry[] }).entries ?? []
      return (
        <div key={key} className="mb-2">
          <EntryList entries={inline} depth={depth} />
        </div>
      )
    }
    case 'hr':
      return <hr key={key} className="book-rule" />
    case 'abilityGeneric': {
      const ability = obj as { name?: string; entry?: string }
      return (
        <p key={key} className="book-ability mb-2">
          {ability.name && <>{ability.name} = </>}
          <TaggedText text={ability.entry ?? ''} />
        </p>
      )
    }
    case 'abilityDc':
    case 'abilityAttackMod': {
      const ability = obj as { name?: string; attributes?: unknown }
      const who = abilityNames(ability.attributes)
      const text =
        obj.type === 'abilityDc'
          ? `${ability.name} save DC = 8 + your proficiency bonus + your ${who} modifier`
          : `${ability.name} attack modifier = your proficiency bonus + your ${who} modifier`
      return (
        <p key={key} className="book-ability mb-2">
          {text}
        </p>
      )
    }
    case 'spellcasting': {
      const casting = obj as {
        name?: string
        headerEntries?: Entry[]
        footerEntries?: Entry[]
        spells?: unknown
      }
      return (
        <div key={key} className="book-spellcasting mb-2">
          {casting.name && <p className="book-run mb-1">{casting.name}.</p>}
          {casting.headerEntries && (
            <EntryList entries={casting.headerEntries} depth={depth} />
          )}
          {spellLines(casting.spells)}
          {usageLines(obj as Record<string, unknown>)}
          {casting.footerEntries && (
            <EntryList entries={casting.footerEntries} depth={depth} />
          )}
        </div>
      )
    }
    default: {
      // An entry of a kind the renderer does not know: in the book it says so rather
      // than drop the text; elsewhere its nested entries are drawn.
      const maybe = obj as NamedEntry
      const nested = maybe.entries && (
        <EntryList key={key} entries={maybe.entries} depth={depth} />
      )
      if (!book) return nested ?? null
      return (
        <Fragment key={key}>
          <p className="text-danger small mb-1">
            This part of the book (type "{String(obj.type)}") is not drawn yet.
          </p>
          {nested}
        </Fragment>
      )
    }
  }
}

function EntryList({
  entries,
  depth,
  heading,
}: {
  entries: Entry[]
  depth: number
  /** The name of the heading these entries sit under, when they have one. */
  heading?: string
}) {
  const context = useContext(EntryContext)
  const named = heading ? stripTags(heading).toLowerCase() : undefined
  return (
    <>
      {entries.map((e, i) => {
        const first = typeof e === 'object' ? (e as { name?: string }) : undefined
        // A stat block right under a heading of its own name does not print it again.
        const headed =
          i === 0 &&
          named !== undefined &&
          first?.name !== undefined &&
          stripTags(first.name).toLowerCase() === named
        return <Fragment key={i}>{renderEntry(e, i, depth, context, headed)}</Fragment>
      })}
    </>
  )
}

/** Render an array of 5etools "entries" as React nodes. */
export function Entries({ entries }: { entries: Entry[] }) {
  return <EntryList entries={entries} depth={0} />
}

/**
 * The heading of a named part, drawn alone: the whole-book flow draws a part in pieces, so
 * the heading is one piece and what is under it are others (see src/books/units.ts).
 */
export function PartTitle({ entry, depth }: { entry: Entry; depth: number }) {
  const context = useContext(EntryContext)
  return context ? (
    <BookHeading
      entry={entry as NamedEntry}
      depth={depth}
      box={false}
      context={context}
    />
  ) : null
}

/** A run of the entries under a part, at the depth they have in it. */
export function EntryPiece({
  entries,
  depth,
  under,
}: {
  entries: Entry[]
  depth: number
  /** The name of the heading right above the run, when it starts the part's entries. */
  under?: string
}) {
  return <EntryList entries={entries} depth={depth} heading={under} />
}
