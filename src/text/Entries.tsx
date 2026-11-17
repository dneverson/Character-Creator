import { Fragment, useContext, type ReactNode } from 'react'
import Table from 'react-bootstrap/Table'
import { referenceOf } from '../lookup/references'
import { EntryContext, type EntryContextValue, type ImageEntry } from './entryContext'
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
}
interface NamedEntry {
  type: 'entries' | 'section' | 'inset' | 'insetReadaloud' | 'variantInner' | 'flowBlock'
  name?: string
  page?: number
  style?: string
  entries?: Entry[]
}
interface TableEntry {
  type: 'table'
  caption?: string
  colLabels?: string[]
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

function pageMark(page: number | undefined, context: EntryContextValue | null) {
  return context?.book && page !== undefined ? (
    <span className="book-page-mark">p. {page}</span>
  ) : null
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
  const anchor = context.anchors?.get(entry)
  return (
    <Tag
      id={anchor ? `book-${anchor}` : undefined}
      data-anchor={anchor}
      className={
        box ? 'book-box-title' : `book-heading book-heading-${Math.min(depth, 4)}`
      }
    >
      <TaggedText text={entry.name ?? ''} />
      {pageMark(entry.page, context)}
    </Tag>
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
function StatblockNote({ entry }: { entry: Record<string, unknown> }) {
  const name = typeof entry.name === 'string' ? entry.name : ''
  const tag = typeof entry.tag === 'string' ? entry.tag : ''
  const source = typeof entry.source === 'string' ? `|${entry.source}` : ''
  const reference = name && tag ? referenceOf(tag, `${name}${source}`) : undefined
  return (
    <aside className="book-statblock mb-2">
      <span className="book-run">{tag ? 'Entry' : 'Stat block'}:</span>{' '}
      {reference ? <TagRef reference={reference} text={name} /> : name}
      <span className="text-body-secondary">
        {' '}
        - drawn in the lookup, not in the text of the book.
      </span>
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
    const entry = it.entry ? <Tagged text={it.entry} /> : null
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
        {it.entries && <EntryList entries={it.entries} depth={depth} />}
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

function renderTable(t: TableEntry, depth: number, context: EntryContextValue | null) {
  const book = context?.book === true
  const cls = (i: number) => (book ? columnClass(t.colStyles?.[i]) : undefined)
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
        {t.colLabels && (
          <thead>
            <tr>
              {t.colLabels.map((c, i) => (
                <th key={i} className={cls(i)}>
                  {book ? <TaggedText text={c} /> : stripTags(c)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {t.rows.map((row, ri) => {
            const cells = rowCells(row)
            return (
              <tr key={ri}>
                {cells.map((cell, ci) => {
                  const header =
                    typeof cell === 'object' &&
                    (cell as { type?: string }).type === 'cellHeader'
                  const Cell = header ? 'th' : 'td'
                  return (
                    <Cell key={ci} className={cls(ci)}>
                      {cellText(cell, depth, book)}
                    </Cell>
                  )
                })}
              </tr>
            )
          })}
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
        <EntryList entries={named.entries} depth={named.name ? depth + 1 : depth} />
      )
      const title = named.name && (
        <BookHeading entry={named} depth={depth} box={box} context={context} />
      )
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
                context.renderImage(image)
              ) : (
                <ImageNote image={image} />
              )}
            </Fragment>
          ))}
        </div>
      )
    }
    case 'statblock':
      return <StatblockNote key={key} entry={obj as Record<string, unknown>} />
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

function EntryList({ entries, depth }: { entries: Entry[]; depth: number }) {
  const context = useContext(EntryContext)
  return (
    <>
      {entries.map((e, i) => (
        <Fragment key={i}>{renderEntry(e, i, depth, context)}</Fragment>
      ))}
    </>
  )
}

/** Render an array of 5etools "entries" as React nodes. */
export function Entries({ entries }: { entries: Entry[] }) {
  return <EntryList entries={entries} depth={0} />
}
