// The Inventory tab: what is carried against what can be, who is attuned, the coins, and
// the items as the Equipment section's short table, each with its full text one click
// away in the sheet's detail pane. Wearing and attuning are toggled here, as in the editor.

import { useMemo } from 'react'
import { useCharacter } from '../../character/useCharacterDoc'
import { loadItems, type Item } from '../../data/items'
import { useAsyncData } from '../../hooks/useAsyncData'
import { inventoryColumns, useEditStack } from '../editor/inventoryColumns'
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
import { PinButton } from './PinButton'
import { useSheetRowDetail } from './SheetDetail'
import { ItemCharges } from './ItemCharges'
import { usePlay } from './usePlay'

export function InventoryPanel({ sheet }: SheetPanelProps) {
  const character = useCharacter()
  const editStack = useEditStack()
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
  const pools = usePlay(sheet)?.derived.uses
  const resources = sheet.resources

  const columns = useMemo<Column<Item>[]>(() => {
    const [name, ...rest] = inventoryColumns({
      editStack,
      stackOf,
      strength,
      classNames,
    })
    const quantity: Column<Item> = {
      key: 'quantity',
      header: 'Qty',
      priority: 0,
      render: (item) => stackOf.get(item.key)?.quantity ?? 1,
      sortValue: (item) => stackOf.get(item.key)?.quantity ?? 1,
      filterable: false,
    }
    // The charges of an equipped item are counted; the rest only say how many they hold.
    const charges: Column<Item> = {
      key: 'charges',
      header: 'Charges',
      priority: 1,
      filterable: false,
      sortValue: (item) => Number(item.charges?.max) || 0,
      render: (item) => <ItemCharges item={item} resources={resources} pools={pools} />,
    }
    return [name, quantity, charges, ...rest]
  }, [editStack, stackOf, strength, classNames, resources, pools])

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
          pin={(item) => <PinButton kind="item" id={itemKey(item)} />}
          labels={{ compare: 'Compare items', search: 'Search items...', table: 'Items' }}
        />
      )}
    </div>
  )
}
