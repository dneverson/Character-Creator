// The Inventory tab: what is carried against what can be, who is attuned, the coins, and
// the items as the Equipment section's short table, each with its full text one click
// away in the sheet's detail pane. Wearing and attuning are toggled here, as in the editor.

import { useMemo } from 'react'
import { useActiveCharacter } from '../../character/store'
import { loadItems, type Item } from '../../data/items'
import { useAsyncData } from '../../hooks/useAsyncData'
import { inventoryColumns } from '../editor/inventoryColumns'
import { CoinPurse, InventoryTotals } from '../editor/InventoryTotals'
import { useOwnedItems } from '../editor/useOwnedItems'
import {
  describeItems,
  itemKey,
  itemName,
  itemRowMeta,
  itemSearchText,
  itemTags,
} from '../editor/itemFacts'
import { useFeatSummary } from '../editor/useFeatSummary'
import { BrowseTable } from '../table/BrowseTable'
import type { Column } from '../table/types'
import type { SheetPanelProps } from './SheetPanels'
import { useSheetRowDetail } from './SheetDetail'

export function InventoryPanel({ sheet }: SheetPanelProps) {
  const character = useActiveCharacter()
  const { data: items, loading } = useAsyncData(loadItems)
  const { race } = useFeatSummary()
  const stacks = useMemo(() => character?.equipment.items ?? [], [character])
  const { owned, stackOf } = useOwnedItems(items, stacks)
  const detailTarget = useSheetRowDetail('inventory')
  const strength = sheet.totals.str
  const classNames = useMemo(
    () => (character?.classes ?? []).map((c) => c.name.toLowerCase()),
    [character?.classes],
  )
  const rowMeta = useMemo(() => itemRowMeta(sheet.edition), [sheet.edition])

  const columns = useMemo<Column<Item>[]>(() => {
    const [name, ...rest] = inventoryColumns({ stackOf, strength, classNames })
    const quantity: Column<Item> = {
      key: 'quantity',
      header: 'Qty',
      priority: 0,
      render: (item) => stackOf.get(item.key)?.quantity ?? 1,
      sortValue: (item) => stackOf.get(item.key)?.quantity ?? 1,
      filterable: false,
    }
    return [name, quantity, ...rest]
  }, [stackOf, strength, classNames])

  if (!character) return null
  return (
    <div className="sheet-inventory">
      <InventoryTotals
        stacks={stacks}
        owned={owned}
        currency={character.equipment.currency}
        strength={strength}
        size={race?.size?.[0]}
      />
      <CoinPurse currency={character.equipment.currency} />
      {loading ? (
        <div className="text-body-secondary">Loading items...</div>
      ) : (
        <BrowseTable<Item>
          tableId="sheet-inventory"
          rows={owned}
          columns={columns}
          idOf={itemKey}
          nameOf={itemName}
          tagsOf={itemTags}
          describe={describeItems}
          searchText={itemSearchText}
          rowMeta={rowMeta}
          compact
          detailTarget={detailTarget}
          labels={{ compare: 'Compare items', search: 'Search items...', table: 'Items' }}
        />
      )}
    </div>
  )
}
