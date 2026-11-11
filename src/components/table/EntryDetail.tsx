// One entry in full: its name, then its facts group by group. This is the detail
// pane of every browse table, and the single-column form of a compare column -
// both are drawn from the same description (see facts.ts), so they always say
// the same thing about an entry.

import { useMemo, type ReactNode } from 'react'
import Badge from 'react-bootstrap/Badge'
import Table from 'react-bootstrap/Table'
import { factValue, groupTitle, type Describe } from './facts'
import { FACT_LABEL_CLASS, GROUP_HEAD_CLASS, groupHeadTextStyle } from './factStyles'

// One group as its own label/value table, headed by a full-width row carrying the
// same rule above and below as the compare window's group headings. A table per
// group lets each group's label column hug its own labels: "Lv N" sits right
// beside the feature text instead of inheriting the width of a long label in
// another group.
export function DetailGroup({
  title,
  children,
}: {
  title: ReactNode
  children: ReactNode
}) {
  return (
    <Table className="mb-0 small">
      <tbody>
        <tr>
          <td colSpan={2} className={GROUP_HEAD_CLASS} style={groupHeadTextStyle}>
            {title}
          </td>
        </tr>
        {children}
      </tbody>
    </Table>
  )
}

/** The name of an entry with its tags (edition and the like) as badges. */
export function EntryHeading({
  name,
  tags,
  as: Heading = 'h5',
  className = '',
}: {
  name: ReactNode
  tags: string[]
  as?: 'h3' | 'h5'
  className?: string
}) {
  return (
    <div className={`d-flex align-items-center gap-2 ${className}`.trimEnd()}>
      <Heading className={Heading === 'h3' ? 'h6 mb-0' : 'mb-0'}>{name}</Heading>
      {tags.map((tag) => (
        <Badge bg="secondary" className="fw-normal" key={tag}>
          {tag}
        </Badge>
      ))}
    </div>
  )
}

interface EntryFactsProps<T> {
  entry: T
  describe: Describe<T>
}

/** The fact groups of one entry, without a heading. */
export function EntryFacts<T>({ entry, describe }: EntryFactsProps<T>) {
  const groups = useMemo(() => describe([entry]), [describe, entry])
  return (
    <>
      {groups.map((group) => {
        const shown = group.facts.flatMap((fact) => {
          const value = factValue(fact, entry)
          return value === null ? [] : [{ fact, value }]
        })
        if (shown.length === 0 && !group.empty) return null
        return (
          <DetailGroup title={groupTitle(group, entry)} key={group.key}>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-body-secondary">
                  {group.empty}
                </td>
              </tr>
            ) : (
              shown.map(({ fact, value }) => (
                <tr key={fact.key}>
                  <th scope="row" className={FACT_LABEL_CLASS}>
                    {fact.label}
                  </th>
                  <td className="align-top">{value}</td>
                </tr>
              ))
            )}
          </DetailGroup>
        )
      })}
    </>
  )
}

interface EntryDetailProps<T> extends EntryFactsProps<T> {
  name: ReactNode
  tags?: string[]
  /** Further groups that only the detail of a single entry shows. */
  children?: ReactNode
}

export function EntryDetail<T>({
  entry,
  describe,
  name,
  tags = [],
  children,
}: EntryDetailProps<T>) {
  return (
    <div className="p-3">
      <EntryHeading name={name} tags={tags} className="mb-3" />
      {/* Unlike the compare window (which needs a fixed layout and explicit widths
          to stop its columns collapsing), each group here sizes its label column
          to its own content. */}
      <EntryFacts entry={entry} describe={describe} />
      {children}
    </div>
  )
}
