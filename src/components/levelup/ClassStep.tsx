import { useMemo } from 'react'
import Button from 'react-bootstrap/Button'
import { newClassFlags, targetKey, type LevelTarget } from '../../character/levelUp'
import type { Character } from '../../character/model'
import type { Deviation } from '../../rules/compliance'
import { NonStandardBadge } from '../NonStandardBadge'
import { BrowseTable, type RowAction } from '../table/BrowseTable'
import type { Column } from '../table/types'
import { AvailableSubclasses } from '../editor/ClassBrowser'
import { referenceColumns, searchText } from '../editor/classReference'
import { rowKey, type ClassRow } from '../editor/classRows'
import { classTags, colTitle, describeClasses } from '../editor/classViewShared'
import { classKey, useClassBuild } from '../editor/useClassBuild'
import { useFeatSummary } from '../editor/useFeatSummary'
import { StepCard } from './StepCard'

interface Props {
  character: Character
  target: LevelTarget | null
  onTarget: (target: LevelTarget) => void
  collapseOn: number
}

const targetOf = (row: ClassRow): LevelTarget => ({
  name: row.loaded.entry.name,
  source: row.loaded.entry.source,
})

/**
 * The first step: which class the level goes to. A class of the build first, one button
 * each, then every other class of the books in the class reference table. A class whose
 * multiclass prerequisites are not met is flagged, and can still be taken (the DM's call).
 */
export function ClassStep({ character, target, onTarget, collapseOn }: Props) {
  const { available } = useClassBuild()
  const { classByKey, summary } = useFeatSummary()
  const chosen = target ? targetKey(target) : ''

  const rows = useMemo<ClassRow[]>(() => {
    const had = new Set(character.classes.map((c) => classKey(c.name, c.source)))
    return available
      .filter((l) => !had.has(classKey(l.entry.name, l.entry.source)))
      .map((loaded) => ({ loaded }))
  }, [available, character.classes])

  const flags = useMemo(() => {
    const m = new Map<string, Deviation[]>()
    for (const row of rows) {
      m.set(rowKey(row), newClassFlags(character, targetOf(row), classByKey, summary))
    }
    return m
  }, [rows, character, classByKey, summary])

  const columns = useMemo<Column<ClassRow>[]>(
    () => [
      {
        key: 'prerequisites',
        header: 'Prerequisites',
        render: (r) => {
          const found = flags.get(rowKey(r)) ?? []
          return found.length > 0 ? (
            <NonStandardBadge
              reason={found.map((d) => d.message).join(' ')}
              label="Not met"
            />
          ) : (
            'Met'
          )
        },
        sortValue: (r) => (flags.get(rowKey(r))?.length ? 1 : 0),
        filterValue: (r) => (flags.get(rowKey(r))?.length ? 'Not met' : 'Met'),
      },
      ...referenceColumns,
    ],
    [flags],
  )

  const current = character.classes.find((c) => classKey(c.name, c.source) === chosen)
  const newRow = rows.find((r) => rowKey(r) === chosen)
  const subtitle = current
    ? `${current.name} ${current.level} to ${current.level + 1}`
    : newRow
      ? `${newRow.loaded.entry.name} 1, a new class`
      : 'Choose the class to gain the level in'

  const take = (r: ClassRow): RowAction | undefined =>
    rowKey(r) === chosen
      ? undefined
      : {
          label: 'Take',
          detailLabel: `Take a level of ${r.loaded.entry.name}`,
          run: () => onTarget(targetOf(r)),
        }

  return (
    <StepCard
      title="Class"
      subtitle={subtitle}
      done={!!target}
      openText="choose a class"
      collapseOn={collapseOn}
    >
      {character.classes.length > 0 && (
        <div
          className="d-flex flex-wrap gap-2 mb-3"
          role="group"
          aria-label="Your classes"
        >
          {character.classes.map((c) => {
            const key = classKey(c.name, c.source)
            return (
              <Button
                key={key}
                variant={key === chosen ? 'primary' : 'secondary'}
                aria-pressed={key === chosen}
                onClick={() => onTarget({ name: c.name, source: c.source })}
              >
                {c.name} {c.level} to {c.level + 1}
              </Button>
            )
          })}
        </div>
      )}
      {rows.length > 0 && (
        <>
          <div className="small text-body-secondary mb-2">
            Or take the level in a new class (multiclassing):
          </div>
          <BrowseTable<ClassRow>
            tableId="levelup-class"
            rows={rows}
            columns={columns}
            idOf={rowKey}
            nameOf={colTitle}
            tagsOf={classTags}
            describe={describeClasses}
            searchText={searchText}
            action={{ key: 'take', header: 'Level', of: take }}
            detailFooter={(r) => <AvailableSubclasses row={r} />}
            labels={{
              compare: 'Compare classes',
              search: 'Search classes...',
              table: 'Classes to multiclass into',
            }}
          />
        </>
      )}
    </StepCard>
  )
}
