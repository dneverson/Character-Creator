// The Extras tab: what only some characters have. For now the Wild Shape forms, each
// with its full stat block in the sheet's detail pane.

import { useMemo } from 'react'
import Alert from 'react-bootstrap/Alert'
import { loadBeasts, type Beast } from '../../data/beasts'
import { useCharacter } from '../../character/useCharacterDoc'
import { useAsyncData } from '../../hooks/useAsyncData'
import {
  beastKey,
  beastName,
  beastSearchText,
  beastSummaryColumns,
  beastTags,
  describeBeasts,
} from '../editor/beastFacts'
import { BrowseTable } from '../table/BrowseTable'
import { useSheetRowDetail } from './SheetDetail'
import type { SheetPanelProps } from './SheetPanels'

export function ExtrasPanel({ sheet }: SheetPanelProps) {
  const character = useCharacter()
  const detailTarget = useSheetRowDetail('extras')
  const booksKey = (character?.selectedBooks ?? []).join(',')
  const loader = useMemo(
    () => () => loadBeasts(booksKey ? booksKey.split(',') : []),
    [booksKey],
  )
  const { data: beasts, error, loading } = useAsyncData(loader)
  const forms = useMemo(() => {
    const known = new Map((beasts ?? []).map((b) => [beastKey(b), b]))
    return sheet.wildShapes.flatMap((ref) => known.get(beastKey(ref)) ?? [])
  }, [beasts, sheet.wildShapes])

  if (loading) return <div className="text-body-secondary">Loading beasts...</div>
  if (error) return <Alert variant="danger">Failed to load beasts: {error.message}</Alert>
  return (
    <section aria-label="Wild Shape">
      <h3 className="h6 mb-2">Wild Shape forms</h3>
      <BrowseTable<Beast>
        tableId="sheet-wild-shape"
        rows={forms}
        columns={beastSummaryColumns}
        idOf={beastKey}
        nameOf={beastName}
        tagsOf={beastTags}
        describe={describeBeasts}
        searchText={beastSearchText}
        compact
        detailTarget={detailTarget}
        labels={{
          compare: 'Compare beasts',
          search: 'Search beasts...',
          table: 'Wild Shape forms',
        }}
      />
    </section>
  )
}
