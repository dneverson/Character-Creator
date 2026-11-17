// A reference to an entry in a text: "{@spell fireball}" drawn as a link. Hover or focus
// shows what the entry is and the start of its text; a click opens it in Quick lookup.
// The entries are loaded the first time one is hovered, never when the text is drawn.

import { useState, type ReactNode } from 'react'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { appConfig } from '../config/app'
import { loadResolver, summaryOf, type Reference } from '../lookup/references'
import { useLookupStore } from '../lookup/state'
import { KIND_LABELS, type LookupRow } from '../lookup/types'

/** undefined while loading, null when the loaded content has no such entry. */
type Found = LookupRow | null | undefined

export function TagRef({
  reference,
  text,
  label,
}: {
  reference: Reference
  text: string
  /** What the link shows when it is more than the text (the words of a search marked). */
  label?: ReactNode
}) {
  const [found, setFound] = useState<Found>(undefined)
  const openLookup = useLookupStore((s) => s.openLookup)
  const resolve = async (): Promise<LookupRow | null> => {
    const row = (await loadResolver()).find(reference) ?? null
    setFound(row)
    return row
  }
  const summary = found ? summaryOf(found, appConfig.lookup.summaryChars) : ''
  return (
    <OverlayTrigger
      placement="top"
      onToggle={(show) => {
        if (show) void resolve().catch(() => setFound(null))
      }}
      overlay={
        <Tooltip className="tag-tooltip">
          {found === undefined && 'Loading...'}
          {found === null && (
            <>
              <strong>{KIND_LABELS[reference.kind]}</strong> - not in the loaded content
            </>
          )}
          {found && (
            <>
              <strong>{KIND_LABELS[found.kind]}</strong> - {found.name}
              {summary && <div className="mt-1">{summary}</div>}
              <div className="mt-1 opacity-75">Click to open it in Lookup.</div>
            </>
          )}
        </Tooltip>
      }
    >
      <button
        type="button"
        className="tag-ref"
        onClick={() => {
          void resolve()
            .then((row) => row && openLookup(row.id))
            .catch(() => setFound(null))
        }}
      >
        {label ?? text}
      </button>
    </OverlayTrigger>
  )
}
