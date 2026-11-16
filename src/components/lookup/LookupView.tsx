// Quick lookup: one search across everything the loaded content holds, in the shared
// table with the entry's full text in the detail pane beside it. It opens over whatever
// view is open and never touches the character. The search looks at names and at the
// text of every entry (src/lookup/search.ts).

import { useDeferredValue, useMemo, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import Spinner from 'react-bootstrap/Spinner'
import { appConfig } from '../../config/app'
import { useLookupIndex } from '../../lookup/data'
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

const idOf = (row: LookupRow) => row.id

function Results() {
  const entryId = useLookupStore((s) => s.entryId)
  const request = useLookupStore((s) => s.request)
  const { data: index, error } = useLookupIndex()
  const [text, setText] = useState('')
  const [kind, setKind] = useState<LookupKind | ''>('')
  // Asked for an entry (a reference clicked): search its name, so it is among the rows.
  const [applied, setApplied] = useState(0)
  if (index && request !== applied) {
    setApplied(request)
    const asked = entryId ? index.rows.find((row) => row.id === entryId) : undefined
    if (asked) {
      setText(asked.name)
      setKind('')
    }
  }
  const deferred = useDeferredValue(text)
  const result = useMemo(
    () => index?.search({ text: deferred, kind: kind || undefined }),
    [index, deferred, kind],
  )
  const rows = useMemo(() => result?.hits.map((hit) => hit.row) ?? [], [result])
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
          onChange={(e) => setText(e.target.value)}
        />
        <Form.Select
          className="w-auto"
          aria-label="Kind of entry"
          value={kind}
          onChange={(e) => setKind(e.target.value as LookupKind | '')}
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
  return (
    <Modal
      show={open}
      fullscreen
      onHide={closeLookup}
      // The column menus open outside the window and must keep the focus they are given.
      enforceFocus={false}
      aria-label={`${appConfig.name} lookup`}
    >
      <Modal.Header closeButton>
        <Modal.Title>Lookup</Modal.Title>
      </Modal.Header>
      <Modal.Body className="data-table-fullscreen lookup-body">
        {open && <Results />}
      </Modal.Body>
    </Modal>
  )
}
