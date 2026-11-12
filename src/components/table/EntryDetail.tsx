// One entry in full: its name, then its facts group by group. This is the detail
// pane of every browse table, and the single-column form of a compare column -
// both are drawn from the same description (see facts.ts), so they always say
// the same thing about an entry.

import { Fragment, useMemo, type ReactNode } from 'react'
import Badge from 'react-bootstrap/Badge'
import Table from 'react-bootstrap/Table'
import { lookup } from '../../data/glossary'
import { useDetailStyle } from '../../theme/theme-context'
import { bookLayout } from './bookLayout'
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
  /**
   * The one thing to do with the entry ("Add to items"): above the facts in the plain
   * detail, under the text in the book styles.
   */
  action?: ReactNode
  /** Further groups that only the detail of a single entry shows. */
  children?: ReactNode
}

/** The entry laid out like a book entry: see bookLayout.ts and the --detail-* variables. */
function EntryBook<T>({
  entry,
  describe,
  name,
  tags = [],
  action,
  children,
}: EntryDetailProps<T>) {
  const groups = useMemo(() => describe([entry]), [describe, entry])
  const book = bookLayout(groups, entry, tags)
  const printed = [...tags.map((tag) => <span key={tag}>{tag}</span>)]
  if (book.source) printed.push(<span key="source">{book.source}</span>)
  if (book.page) printed.push(<span key="page">{book.page}</span>)
  const bookName = lookup(book.sourceCode, 'source')?.full ?? book.sourceCode
  return (
    <div className="entry-book p-3">
      <div className="entry-book__head">
        <h5 className="entry-book__title">{name}</h5>
        {printed.length > 0 && <div className="entry-book__printed">{printed}</div>}
      </div>
      {book.summary.length > 0 && (
        <p className="entry-book__summary">
          {book.summary.map((part, i) => (
            <Fragment key={i}>
              {i > 0 && ', '}
              {part}
            </Fragment>
          ))}
        </p>
      )}
      <hr className="entry-book__rule" />
      {book.pairs.length > 0 && (
        <dl className="entry-book__pairs">
          {book.pairs.map((pair) => (
            <div key={pair.key}>
              <dt>{pair.label}</dt> <dd>{pair.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {book.empty.map((text) => (
        <p className="text-body-secondary" key={text}>
          {text}
        </p>
      ))}
      {book.blocks.map((block) => (
        <div className="entry-book__block" key={block.key}>
          {block.label && <strong className="entry-book__run">{block.label}. </strong>}
          {block.value}
        </div>
      ))}
      {children}
      {action && <div className="entry-book__action">{action}</div>}
      {book.sourceCode && (
        <footer className="entry-book__footer">
          Source: {bookName}
          {book.pageNumber && `, page ${book.pageNumber}`}.
          {book.free && ' In the free rules.'}
        </footer>
      )}
    </div>
  )
}

export function EntryDetail<T>(props: EntryDetailProps<T>) {
  const detailStyle = useDetailStyle()
  if (detailStyle !== 'standard') return <EntryBook {...props} />
  const { entry, describe, name, tags = [], action, children } = props
  const detail = (
    <div className="p-3">
      <EntryHeading name={name} tags={tags} className="mb-3" />
      {/* Unlike the compare window (which needs a fixed layout and explicit widths
          to stop its columns collapsing), each group here sizes its label column
          to its own content. */}
      <EntryFacts entry={entry} describe={describe} />
      {children}
    </div>
  )
  return action ? (
    <div>
      <div className="p-3 pb-0">{action}</div>
      {detail}
    </div>
  ) : (
    detail
  )
}
