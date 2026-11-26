// The Inventory tab: what is carried against what can be, who is attuned, the coins, and
// the items as the Equipment section's short table, each with its full text one click
// away in the sheet's detail pane. Wearing and attuning are toggled here, as in the editor.
// What is carried changes here as play: items added, bought, sold or dropped, a count up or
// down, coins in and out. None of it is a change to the build (see inventoryPlay.ts).

import { useCallback, useMemo, useState } from 'react'
import Button from 'react-bootstrap/Button'
import { useCharacter } from '../../character/useCharacterDoc'
import { loadItems, type Item } from '../../data/items'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useCarry } from '../../character/inventoryEdit'
import { patchStack } from '../../character/inventoryPlay'
import type { InventoryItem } from '../../character/model'
import { Icon } from '../Icon'
import { inventoryColumns } from '../editor/inventoryColumns'
import { InventoryTotals } from '../editor/InventoryTotals'
import { QuantityCell } from '../table/QuantityCell'
import { AddItemModal } from './AddItemModal'
import { CoinsPanel } from './CoinsPanel'
import { RemoveItemModal } from './RemoveItemModal'
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
import { useReadOnly } from './readOnly'
import { useSheetRowDetail } from './SheetDetail'
import { ItemCharges } from './ItemCharges'
import { usePlay } from './usePlay'
import { raceSize } from '../../data/race'

export function InventoryPanel({ sheet }: SheetPanelProps) {
  const character = useCharacter()
  const carry = useCarry()
  // A change to a stack made on the sheet is play: recorded as an inventory action.
  const editStack = useCallback(
    (key: string, patch: Partial<InventoryItem>) =>
      carry((equipment) => patchStack(equipment, key, patch)),
    [carry],
  )
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Item>()
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
  const readOnly = useReadOnly()
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
      render: (item) =>
        readOnly ? (
          <span>{stackOf.get(item.key)?.quantity ?? 1}</span>
        ) : (
          <QuantityCell
            name={item.name}
            quantity={stackOf.get(item.key)?.quantity ?? 1}
            onChange={(n) => editStack(item.key, { quantity: n })}
          />
        ),
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
  }, [editStack, stackOf, strength, classNames, resources, pools, readOnly])

  if (!character) return null
  return (
    <div className="sheet-inventory">
      <InventoryTotals
        stacks={stacks}
        owned={owned}
        currency={character.equipment.currency}
        strength={strength}
        size={raceSize(race)}
      />
      {!readOnly && <CoinsPanel currency={character.equipment.currency} />}
      {!readOnly && (
        <div className="mb-2">
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Icon name="add" className="me-1" />
            Add item
          </Button>
        </div>
      )}
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
          action={
            readOnly
              ? undefined
              : {
                  key: 'remove',
                  header: 'Remove',
                  of: (item) => ({
                    label: `Sell or drop ${item.name}`,
                    detailLabel: 'Sell or drop',
                    variant: 'danger',
                    run: () => setRemoving(item),
                  }),
                }
          }
          pin={(item) => <PinButton kind="item" id={itemKey(item)} />}
          labels={{ compare: 'Compare items', search: 'Search items...', table: 'Items' }}
        />
      )}
      <AddItemModal
        show={adding}
        onHide={() => setAdding(false)}
        catalog={items ?? []}
        books={character.selectedBooks}
        edition={sheet.edition}
        currency={character.equipment.currency}
      />
      <RemoveItemModal
        item={removing}
        stack={removing ? stackOf.get(removing.key) : undefined}
        edition={sheet.edition}
        onHide={() => setRemoving(undefined)}
      />
    </div>
  )
}
