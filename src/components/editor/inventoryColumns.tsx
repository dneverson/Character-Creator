// The short table of what a character carries: name, worn, attuned, the item's own
// stats and a note. The Equipment section and the sheet's Inventory tab draw the same
// columns, so an item reads and is worn the same way in both.

import type { ReactNode } from 'react'
import Form from 'react-bootstrap/Form'
import type { Item } from '../../data/items'
import { editItems } from '../../character/inventoryEdit'
import type { InventoryItem } from '../../character/model'
import { inventoryKey } from '../../character/inventory'
import { lacksClass, strengthNeeded } from '../../rules/equipment'
import { AbbrText } from '../Abbr'
import { NonStandardBadge } from '../NonStandardBadge'
import { NO_VALUE } from '../table/facts'
import type { Column } from '../table/types'
import { DraftInput } from './DraftInput'
import { itemColumns, itemSummaryColumns } from './itemFacts'

export const oneDecimal = (n: number) => Math.round(n * 10) / 10

/** Changes one stack of the inventory, found by its key. */
export const editStack = (key: string, patch: Partial<InventoryItem>) =>
  editItems((all) => all.map((s) => (inventoryKey(s) === key ? { ...s, ...patch } : s)))

/** Whether an item can be attuned to (it needs attunement, or may have it). */
const attunable = (item: Item) => item.attunement !== undefined

interface Inputs {
  /** The character's stacks by item key. */
  stackOf: Map<string, InventoryItem>
  /** The character's Strength, for armor that asks for some. */
  strength: number
  /** The character's class names, lower case, for items only some classes attune to. */
  classNames: string[]
  /** Further controls under an owned item's name (Unpack, Edit). */
  nameExtras?: (item: Item, stack: InventoryItem) => ReactNode
}

export function inventoryColumns({
  stackOf,
  strength,
  classNames,
  nameExtras,
}: Inputs): Column<Item>[] {
  const quantityOf = (item: Item) => stackOf.get(item.key)?.quantity ?? 1
  const weighed = (item: Item) =>
    item.weight === undefined ? undefined : oneDecimal(item.weight * quantityOf(item))
  const base = [...itemSummaryColumns, ...itemColumns.filter((c) => c.key === 'rarity')]
  const column = (key: string) => base.find((c) => c.key === key) as Column<Item>
  return [
    {
      ...column('name'),
      render: (item) => {
        const stack = stackOf.get(item.key)
        return (
          <>
            {column('name').render(item)}
            {stack && nameExtras?.(item, stack)}
          </>
        )
      },
    },
    column('edition'),
    {
      key: 'equipped',
      header: 'Equipped',
      sortable: false,
      filterable: false,
      render: (item) => {
        const equipped = stackOf.get(item.key)?.equipped === true
        const needed = equipped
          ? strengthNeeded(item.armor?.strength, strength)
          : undefined
        return (
          <>
            <Form.Check
              type="checkbox"
              aria-label={`${item.name} equipped`}
              checked={equipped}
              onChange={(e) => editStack(item.key, { equipped: e.target.checked })}
            />
            {needed !== undefined && (
              <NonStandardBadge
                reason={`${item.name} needs Strength ${needed}; the character has ${strength} (DM approval)`}
                label={`Needs Strength ${needed} (you have ${strength})`}
              />
            )}
          </>
        )
      },
    },
    {
      key: 'attuned',
      header: 'Attuned',
      sortable: false,
      filterable: false,
      render: (item) =>
        attunable(item) ? (
          <>
            <Form.Check
              type="checkbox"
              aria-label={`${item.name} attuned`}
              checked={stackOf.get(item.key)?.attuned === true}
              onChange={(e) => editStack(item.key, { attuned: e.target.checked })}
            />
            {lacksClass(item.attunement?.classes ?? [], classNames) && (
              <NonStandardBadge
                reason={`${item.name} is attuned to by ${item.attunement?.classes.join(' or ')} (DM approval)`}
                label={`Requires ${item.attunement?.classes.join(' or ')}`}
              />
            )}
          </>
        ) : (
          NO_VALUE
        ),
    },
    { ...column('type'), priority: 5 },
    { ...column('rarity'), priority: 6 },
    {
      ...column('weight'),
      priority: 8,
      sortValue: (item) => weighed(item) ?? -1,
      filterable: false,
      render: (item) => {
        const weight = weighed(item)
        return weight === undefined ? (
          NO_VALUE
        ) : (
          <AbbrText text={`${weight} lb.`} kind="term" />
        )
      },
    },
    { ...column('cost'), priority: 7 },
    { ...column('damage'), priority: 4 },
    { ...column('damageType'), priority: 4 },
    { ...column('ac'), priority: 3 },
    { ...column('properties'), priority: 2 },
    {
      key: 'note',
      header: 'Note',
      sortable: false,
      filterable: false,
      priority: 1,
      render: (item) => (
        <DraftInput
          size="sm"
          aria-label={`Note on ${item.name}`}
          value={stackOf.get(item.key)?.note ?? ''}
          onCommit={(note) => editStack(item.key, { note: note || undefined })}
        />
      ),
    },
  ]
}
