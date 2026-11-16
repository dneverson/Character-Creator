// Quick lookup: one search across everything the loaded content holds, in the shared
// table with the entry's full text in the detail pane beside it. It opens over whatever
// view is open and never touches the character. The search looks at names and at the
// text of every entry (src/lookup/search.ts).

import { useDeferredValue, useMemo, useRef, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import Spinner from 'react-bootstrap/Spinner'
import { appConfig } from '../../config/app'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useLookupIndex } from '../../lookup/data'
import { loadResolver } from '../../lookup/references'
import { wordsIn, type Snippet } from '../../lookup/search'
import { useLookupStore } from '../../lookup/state'
import {
  KIND_LABELS,
  LOOKUP_KINDS,
  type LookupKind,
  type LookupRow,
} from '../../lookup/types'
import { BrowseTable } from '../table/BrowseTable'
import { describeLookup, lookupColumns, lookupTags, lookupTitle } from './lookupFacts'

/** The control that closes the detail pane, which is there only while one is open. */
const CLOSE_DETAILS = '[aria-label="Close details"]'

const idOf = (row: LookupRow) => row.id

function Results() {
  const entryId = useLookupStore((s) => s.entryId)
  const request = useLookupStore((s) => s.request)
  const { data: index, error } = useLookupIndex()
  const { data: resolver } = useAsyncData(loadResolver)
  const [text, setText] = useState('')
  const [kind, setKind] = useState<LookupKind | ''>('')
  // An entry asked for that the index does not hold (an item a variant makes): it heads
  // the rows until the search is changed.
  const [pinned, setPinned] = useState<LookupRow | undefined>(undefined)
  // Asked for an entry (a reference clicked): search its name, so it is among the rows.
  const [applied, setApplied] = useState(0)
  if (index && resolver && request !== applied) {
    setApplied(request)
    const asked = entryId ? resolver.byId(entryId) : undefined
    if (asked) {
      setText(asked.name)
      setKind('')
      setPinned(index.rows.includes(asked) ? undefined : asked)
    }
  }
  const deferred = useDeferredValue(text)
  const result = useMemo(
    () => index?.search({ text: deferred, kind: kind || undefined }),
    [index, deferred, kind],
  )
  const rows = useMemo(
    () => [...(pinned ? [pinned] : []), ...(result?.hits.map((hit) => hit.row) ?? [])],
    [pinned, result],
  )
  const columns = useMemo(() => {
    const snippets = new Map<string, Snippet>()
    for (const hit of result?.hits ?? [])
      if (hit.snippet) snippets.set(hit.row.id, hit.snippet)
    return lookupColumns(snippets)
  }, [result])
  const searching = wordsIn(deferred).length > 0 || kind !== ''

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-2">
        <Form.Control
          type="search"
          autoFocus
          className="w-auto flex-grow-1"
          style={{ minWidth: '12rem', maxWidth: '32rem' }}
          aria-label="Search names and text of the rules"
          placeholder="Search names and text: spells, items, rules, classes..."
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setPinned(undefined)
          }}
        />
        <Form.Select
          className="w-auto"
          aria-label="Kind of entry"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as LookupKind | '')
            setPinned(undefined)
          }}
        >
          <option value="">All kinds</option>
          {LOOKUP_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </Form.Select>
      </div>
      {error && <Alert variant="danger">Could not load the rules: {error.message}</Alert>}
      {!index && !error && (
        <div className="text-body-secondary mb-2">
          <Spinner size="sm" animation="border" className="me-2" />
          Preparing the search...
        </div>
      )}
      {index && (
        <div className="small text-body-secondary mb-2" role="status">
          {!searching
            ? `Type to search ${index.rows.length.toLocaleString('en-US')} entries, or pick a kind.`
            : result && result.total > rows.length
              ? `${result.total.toLocaleString('en-US')} matches; showing the first ${rows.length.toLocaleString('en-US')}. Narrow the search to see the rest.`
              : `${(result?.total ?? 0).toLocaleString('en-US')} ${result?.total === 1 ? 'match' : 'matches'}.`}
        </div>
      )}
      <BrowseTable<LookupRow>
        // A reference clicked while this is open opens that entry on a fresh table.
        key={request}
        tableId="lookup"
        rows={rows}
        columns={columns}
        idOf={idOf}
        nameOf={lookupTitle}
        tagsOf={lookupTags}
        describe={describeLookup}
        initialFocusId={entryId ?? undefined}
        emptyLabel={searching ? 'Nothing matches.' : 'Nothing to show yet.'}
        tableShare={55}
        labels={{ compare: 'Compare entries', table: 'Lookup results' }}
      />
    </>
  )
}

/** The lookup window: open from the header, the "/" key or a reference in a text. */
export function LookupView() {
  const open = useLookupStore((s) => s.open)
  const closeLookup = useLookupStore((s) => s.closeLookup)
  const body = useRef<HTMLDivElement>(null)
  return (
    <Modal
      show={open}
      fullscreen
      onHide={closeLookup}
      // The column menus open outside the window and must keep the focus they are given.
      enforceFocus={false}
      // Escape closes an open detail pane first, and the lookup only when none is open.
      onEscapeKeyDown={(e) => {
        const pane = body.current?.querySelector<HTMLElement>(CLOSE_DETAILS)
        if (!pane) return
        e.preventDefault()
        pane.click()
      }}
      aria-label={`${appConfig.name} lookup`}
    >
      <Modal.Header closeButton>
        <Modal.Title>Lookup</Modal.Title>
      </Modal.Header>
      <Modal.Body ref={body} className="data-table-fullscreen lookup-body">
        {open && <Results />}
      </Modal.Body>
    </Modal>
  )
}
