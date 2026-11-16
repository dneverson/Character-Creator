import { Fragment, type ReactNode } from 'react'
import Table from 'react-bootstrap/Table'
import { TaggedText } from './TaggedText'
import { stripTags } from './tags'

// Minimal shapes for the 5etools "entries" structures we render.
interface ListEntry {
  type: 'list'
  items: Entry[]
}
interface NamedEntry {
  type: 'entries' | 'section' | 'inset' | 'insetReadaloud'
  name?: string
  entries?: Entry[]
}
interface TableEntry {
  type: 'table'
  caption?: string
  colLabels?: string[]
  rows: Entry[][]
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

function cellText(cell: Entry): ReactNode {
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
  return ''
}

function renderEntry(entry: Entry, key: number): ReactNode {
  if (typeof entry === 'string' || typeof entry === 'number') {
    return (
      <p key={key} className="mb-2">
        <TaggedText text={String(entry)} />
      </p>
    )
  }
  const obj = entry as ObjEntry
  switch (obj.type) {
    case 'list':
      return (
        <ul key={key} className="mb-2">
          {(obj as ListEntry).items.map((item, i) => (
            <li key={i}>
              {typeof item === 'string' || typeof item === 'number' ? (
                <TaggedText text={String(item)} />
              ) : (
                <Entries entries={[item]} />
              )}
            </li>
          ))}
        </ul>
      )
    case 'entries':
    case 'section':
    case 'inset':
    case 'insetReadaloud': {
      const named = obj as NamedEntry
      return (
        <div key={key} className="mb-2">
          {named.name && <div className="fw-semibold">{named.name}</div>}
          {named.entries && <Entries entries={named.entries} />}
        </div>
      )
    }
    case 'table': {
      const t = obj as TableEntry
      return (
        <div key={key} className="table-responsive mb-2">
          <Table size="sm" bordered className="mb-0">
            {t.colLabels && (
              <thead>
                <tr>
                  {t.colLabels.map((c, i) => (
                    <th key={i}>{stripTags(c)}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {t.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cellText(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )
    }
    case 'actions': {
      // An action of an object or a vehicle: its name, then what it does.
      const named = obj as NamedEntry
      return (
        <div key={key} className="mb-2">
          {named.name && <span className="fw-semibold">{named.name}. </span>}
          {named.entries && <Entries entries={named.entries} />}
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
    case 'itemSub': {
      // List items with a bold name and inline text (e.g. background "Skill
      // Proficiencies: ...", "Languages: ...", "Equipment: ...").
      const it = obj as { name?: string; entry?: string; entries?: Entry[] }
      return (
        <div key={key} className="mb-1">
          {it.name && (
            <>
              <span className="fw-semibold text-decoration-underline">
                {it.name}
              </span>{' '}
            </>
          )}
          {it.entry && (
            <span>
              <TaggedText text={it.entry} />
            </span>
          )}
          {it.entries && <Entries entries={it.entries} />}
        </div>
      )
    }
    default: {
      // Unknown structured entry - render its nested entries if present.
      const maybe = obj as NamedEntry
      if (maybe.entries) return <Entries key={key} entries={maybe.entries} />
      return null
    }
  }
}

/** Render an array of 5etools "entries" as React nodes. */
export function Entries({ entries }: { entries: Entry[] }) {
  return (
    <>
      {entries.map((e, i) => (
        <Fragment key={i}>{renderEntry(e, i)}</Fragment>
      ))}
    </>
  )
}
