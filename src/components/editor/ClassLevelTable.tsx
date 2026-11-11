import { Fragment } from 'react'
import Table from 'react-bootstrap/Table'
import { buildLevelTable, type LevelTableColumn } from '../../derived/classLevelTable'
import type { ClassTableGroup, ResolvedFeature } from '../../data/class'
import { Abbr, AbbrText } from '../Abbr'

interface Props {
  /** The class's (or subclass's) `classTableGroups`. */
  groups: ClassTableGroup[] | undefined
  /** The features of each level, for the Features column. */
  features: Map<number, ResolvedFeature[]>
  /** The character's level in this class: its row is marked, the levels beyond it are dimmed. */
  level: number
  /** The table's name for assistive technology. */
  label: string
}

function Heading({ column }: { column: LevelTableColumn }) {
  return column.proficiency ? (
    <Abbr code="PB" kind="stat" />
  ) : (
    <AbbrText text={column.label} />
  )
}

/** The runs of neighbouring columns under the same group heading. */
function groupRuns(columns: LevelTableColumn[]) {
  const runs: { group: string | undefined; columns: LevelTableColumn[] }[] = []
  for (const column of columns) {
    const last = runs[runs.length - 1]
    if (last && last.group !== undefined && last.group === column.group) {
      last.columns.push(column)
    } else {
      runs.push({ group: column.group, columns: [column] })
    }
  }
  return runs
}

/**
 * A class's level table as the books print it: a row per level, the character's
 * level marked and the levels it has not reached yet dimmed. Compact, scrolls
 * sideways inside its card on a narrow screen with the Level column held in place.
 */
export function ClassLevelTable({ groups, features, level, label }: Props) {
  const { columns, rows } = buildLevelTable(groups, features)
  const runs = groupRuns(columns)
  const grouped = runs.some((run) => run.group !== undefined)
  return (
    <div className="class-level-table table-responsive mt-3">
      <Table size="sm" bordered className="mb-0" aria-label={label}>
        <thead>
          <tr>
            {runs.map((run, i) =>
              run.group === undefined ? (
                <Fragment key={i}>
                  {run.columns.map((column, c) => (
                    <th key={c} rowSpan={grouped ? 2 : 1} scope="col">
                      <Heading column={column} />
                    </th>
                  ))}
                </Fragment>
              ) : (
                <th key={i} colSpan={run.columns.length} scope="colgroup">
                  <AbbrText text={run.group} />
                </th>
              ),
            )}
          </tr>
          {grouped && (
            <tr>
              {runs.flatMap((run) =>
                run.group === undefined
                  ? []
                  : run.columns.map((column, c) => (
                      <th key={c} scope="col">
                        <Heading column={column} />
                      </th>
                    )),
              )}
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((row) => {
            const state =
              row.level === level
                ? 'table-active fw-semibold'
                : row.level > level
                  ? 'class-level-table__ahead'
                  : ''
            return (
              <tr
                key={row.level}
                className={state}
                aria-current={row.level === level ? 'true' : undefined}
              >
                {row.cells.map((cell, c) =>
                  c === 0 ? (
                    <th key={c} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td
                      key={c}
                      className={columns[c]?.features ? 'text-start' : 'text-center'}
                    >
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}
