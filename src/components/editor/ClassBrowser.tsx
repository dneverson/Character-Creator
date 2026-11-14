// The single "Class & Level" section. It merges the
// old dropdown multiclass builder and the class reference browser into one place:
// the build tray on top shows and tunes the classes you have chosen, and the
// reference table below lets you browse every class + subclass, add one to the
// build, and compare several side by side. All build mutations go through the
// shared useClassBuild hook; everything class-specific lives here, while the
// table itself knows nothing about D&D.
//
// Each table row is a concrete class + subclass ("Druid (Circle of the Moon)")
// so a player compares the choices they would actually make; a base-class-only
// row appears only as a fallback when a class has no subclasses available from
// the enabled books (otherwise it would vanish entirely).

import { useMemo } from 'react'
import Alert from 'react-bootstrap/Alert'
import Spinner from 'react-bootstrap/Spinner'
import { BrowseTable, type RowAction } from '../table/BrowseTable'
import { DetailGroup } from '../table/EntryDetail'
import { FACT_LABEL_CLASS } from '../table/factStyles'
import { subclassesFor } from '../../data/class'
import { useCharacter } from '../../character/useCharacterDoc'
import { EditorSection } from './EditorSection'
import { ClassBuildTray } from './ClassBuildTray'
import { ClassFeatures } from './ClassFeatures'
import { classKey, useClassBuild } from './useClassBuild'
import { referenceColumns, referenceRows, searchText } from './classReference'
import { rowKey, type ClassRow } from './classRows'
import { classTags, colTitle, describeClasses } from './classViewShared'

// How the "Build" action control should read for a given row, given the current
// build. A class is one entry, so the action is one of:
//  - 'add': the class is not in the build yet, or this subclass row would switch
//    an in-build class to a different subclass ("Set subclass"). addEntry handles
//    both - it inserts the class or updates its subclass.
//  - 'remove': this row's class is in the build at exactly this state (a bare
//    class, or the matching subclass), so the action removes it. `index` is that
//    entry's position for removeEntry.
type AddState =
  | { action: 'add'; label: 'Add' | 'Set subclass' }
  | { action: 'remove'; label: 'Remove'; index: number }

function addStateFor(
  row: ClassRow,
  classes: ReturnType<typeof useClassBuild>['classes'],
): AddState {
  const key = classKey(row.loaded.entry.name, row.loaded.entry.source)
  const index = classes.findIndex((c) => classKey(c.name, c.source) === key)
  if (index < 0) return { action: 'add', label: 'Add' }
  const entry = classes[index]
  if (!row.subclass) return { action: 'remove', label: 'Remove', index }
  const same =
    entry.subclass?.shortName === row.subclass.shortName &&
    entry.subclass?.source === row.subclass.source
  return same
    ? { action: 'remove', label: 'Remove', index }
    : { action: 'add', label: 'Set subclass' }
}

// What only the detail of a single base-class row shows: the subclasses it can
// take, from the enabled books.
export function AvailableSubclasses({ row }: { row: ClassRow }) {
  if (row.subclass) return null
  const subclasses = subclassesFor(row.loaded)
  if (subclasses.length === 0) return null
  return (
    <DetailGroup
      title={`${row.loaded.entry.subclassTitle ?? 'Subclasses'} (${subclasses.length})`}
    >
      <tr>
        <th scope="row" className={FACT_LABEL_CLASS}>
          Available
        </th>
        <td className="align-top">
          <ul className="mb-0 ps-3">
            {subclasses.map((s) => (
              <li key={`${s.shortName}|${s.source}`}>
                {s.name} <span className="text-body-secondary">({s.source})</span>
              </li>
            ))}
          </ul>
        </td>
      </tr>
    </DetailGroup>
  )
}

export function ClassBrowser() {
  const character = useCharacter()
  const build = useClassBuild()
  const { loaded, loading, error, classes, addEntry, removeEntry } = build

  const selectedBooks = character?.selectedBooks
  const rows = useMemo<ClassRow[]>(
    () => (loaded && selectedBooks ? referenceRows(loaded, selectedBooks) : []),
    [loaded, selectedBooks],
  )

  if (!character) return null

  // The row's one action: add its class to the build (or switch the class to this
  // subclass), or take it back out. It leads the table as the "Build" column.
  const buildAction = (r: ClassRow): RowAction => {
    const state = addStateFor(r, classes)
    return state.action === 'remove'
      ? {
          label: state.label,
          detailLabel: 'Remove from build',
          variant: 'danger',
          run: () => removeEntry(state.index),
        }
      : {
          label: state.label,
          detailLabel: `${state.label} to build`,
          run: () => addEntry(r),
        }
  }

  return (
    <EditorSection
      id="class"
      title="Class & Level"
      subtitle="Tune your build up top, then browse every class and subclass below. Add one to your build, click a row for full details, or select rows to compare them."
    >
      {loading && (
        <div className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading classes…
        </div>
      )}
      {error && <Alert variant="danger">Failed to load classes: {error.message}</Alert>}

      {loaded && <ClassBuildTray build={build} selectedBooks={character.selectedBooks} />}

      {loaded && rows.length === 0 && (
        <Alert variant="warning" className="mb-0">
          No classes are available from the selected books. Enable a source (e.g. PHB or
          XPHB) in the Books section.
        </Alert>
      )}

      {loaded && rows.length > 0 && (
        <BrowseTable<ClassRow>
          tableId="class-reference"
          rows={rows}
          columns={referenceColumns}
          idOf={rowKey}
          nameOf={colTitle}
          tagsOf={classTags}
          describe={describeClasses}
          searchText={searchText}
          action={{ key: 'add', header: 'Build', of: buildAction }}
          detailFooter={(r) => <AvailableSubclasses row={r} />}
          labels={{
            compare: 'Compare classes',
            search: 'Search classes and subclasses…',
            table: 'Class reference',
          }}
        />
      )}

      <ClassFeatures />
    </EditorSection>
  )
}
