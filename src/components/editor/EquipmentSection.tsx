// Equipment: look up any item of the enabled books and carry it. The lookup is the
// shared table of every item with all its stats (filters, compare, detail pane), the
// inventory its short table of what is owned: quantity, worn, attuned, a note and a
// Remove. Above them one line says what is carried against what can be, and how many
// items the character is attuned to; going over either is flagged, never blocked.

import { useMemo, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Spinner from 'react-bootstrap/Spinner'
import { applyVariant } from '../../data/itemVariants'
import { loadItems, type Item } from '../../data/items'
import { useCharacter } from '../../character/useCharacterDoc'
import { useEditItems } from '../../character/inventoryEdit'
import type { InventoryItem } from '../../character/model'
import { characterAbilityTotals } from '../../character/derive'
import {
  CUSTOM_SOURCE,
  inventoryKey,
  uniqueCustomName,
  unpackStack,
} from '../../character/inventory'
import { useAsyncData } from '../../hooks/useAsyncData'
import { PickMany } from '../table/PickMany'
import type { Column } from '../table/types'
import { EditorSection } from './EditorSection'
import { BaseItemChooser } from './BaseItemChooser'
import { CustomItemModal, type CustomItemDraft } from './CustomItemModal'
import { NotInBooksAlert } from './NotInBooksAlert'
import { StartingEquipment } from './StartingEquipment'
import { useFeatSummary } from './useFeatSummary'
import { inventoryColumns, useEditStack } from './inventoryColumns'
import { CoinPurse, InventoryTotals } from './InventoryTotals'
import { useOwnedItems } from './useOwnedItems'
import {
  describeItems,
  itemColumns,
  itemKey,
  itemName,
  itemRowMeta,
  itemSearchText,
  itemTags,
} from './itemFacts'

/** The changes the Equipment section makes to the inventory. */
function useInventoryEdits() {
  const editItems = useEditItems()
  const editStack = useEditStack()
  const addItem = (item: Item) =>
    editItems((all) =>
      all.some((s) => inventoryKey(s) === item.key)
        ? all.map((s) =>
            inventoryKey(s) === item.key ? { ...s, quantity: s.quantity + 1 } : s,
          )
        : [...all, { name: item.name, source: item.source, quantity: 1 }],
    )
  /** A stack of one more of an item that is made of a template and a base item. */
  const addVariant = (template: Item, base: Item) => {
    const made = applyVariant(template, base)
    editItems((all) =>
      all.some((s) => inventoryKey(s) === made.key)
        ? all.map((s) =>
            inventoryKey(s) === made.key ? { ...s, quantity: s.quantity + 1 } : s,
          )
        : [
            ...all,
            {
              name: made.name,
              source: template.source,
              quantity: 1,
              variantOf: template.key,
              base: base.key,
            },
          ],
    )
  }
  /** Saves an item of the player's own: a new stack, or the one being edited in place. */
  const saveCustom = (draft: CustomItemDraft, editing?: InventoryItem) =>
    editItems((all) => {
      const others = all.filter(
        (s) => !editing || inventoryKey(s) !== inventoryKey(editing),
      )
      const stack: InventoryItem = {
        ...editing,
        name: uniqueCustomName(others, draft.name),
        source: CUSTOM_SOURCE,
        quantity: draft.quantity,
        custom: draft.custom,
      }
      return editing
        ? all.map((s) => (inventoryKey(s) === inventoryKey(editing) ? stack : s))
        : [...all, stack]
    })
  const setQuantity = (item: Item, quantity: number) => editStack(item.key, { quantity })
  const removeKey = (key: string) =>
    editItems((all) => all.filter((s) => inventoryKey(s) !== key))
  return { addItem, addVariant, saveCustom, setQuantity, removeKey }
}

export function EquipmentSection() {
  const editItems = useEditItems()
  const editStack = useEditStack()
  const { addItem, addVariant, saveCustom, setQuantity, removeKey } = useInventoryEdits()
  const character = useCharacter()
  const { data: items, error, loading } = useAsyncData(loadItems)
  const { background, classByKey, race, summary } = useFeatSummary()

  const selectedBooks = character?.selectedBooks
  const lookupRows = useMemo(() => {
    const books = new Set(selectedBooks ?? [])
    // Coins belong to the purse. A generic variant stays: adding it asks for its base.
    return (items ?? []).filter((i) => books.has(i.source) && i.kind !== 'coin')
  }, [items, selectedBooks])
  const baseRows = useMemo(() => lookupRows.filter((i) => !i.variant), [lookupRows])
  const [choosing, setChoosing] = useState<Item>()
  // The custom item form: closed, new (`true`), or editing a stack.
  const [custom, setCustom] = useState<boolean | InventoryItem>(false)

  const stacks = useMemo(() => character?.equipment.items ?? [], [character])
  const { catalog, owned, stackOf } = useOwnedItems(items, stacks)
  const firstClass = classByKey.get(
    character?.classes[0]
      ? `${character.classes[0].name}|${character.classes[0].source}`
      : '',
  )
  const edition = firstClass?.entry.edition ?? 'one'
  const rowMeta = useMemo(() => itemRowMeta(edition), [edition])

  const strength = character
    ? characterAbilityTotals(character, summary.abilityBonus).str
    : 0
  const characterClasses = character?.classes
  const classNames = useMemo(
    () => (characterClasses ?? []).map((c) => c.name.toLowerCase()),
    [characterClasses],
  )

  const summaryColumns = useMemo<Column<Item>[]>(
    () =>
      inventoryColumns({
        editStack,
        stackOf,
        strength,
        classNames,
        nameExtras: (item, stack) => (
          <>
            {item.pack && item.pack.length > 0 && (
              <Button
                size="sm"
                variant="link"
                className="py-0"
                aria-label={`Unpack ${item.name}`}
                onClick={() => editItems((all) => unpackStack(all, item, catalog))}
              >
                Unpack
              </Button>
            )}
            {stack.custom && (
              <Button
                size="sm"
                variant="link"
                className="py-0"
                aria-label={`Edit ${item.name}`}
                onClick={() => setCustom(stack)}
              >
                Edit
              </Button>
            )}
          </>
        ),
      }),
    [editStack, editItems, stackOf, catalog, strength, classNames],
  )

  if (!character) return null
  const equipment = character.equipment
  const strays = owned.filter(
    (item) => item.source !== 'Custom' && !selectedBooks?.includes(item.source),
  )

  return (
    <EditorSection
      id="equipment"
      title="Equipment"
      subtitle="Look up any item of your books, add it, and keep track of what you carry."
    >
      {loading && (
        <div className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading items...
        </div>
      )}
      {error && <Alert variant="danger">Failed to load items: {error.message}</Alert>}

      {!loading && !error && (
        <>
          <InventoryTotals
            stacks={stacks}
            owned={owned}
            currency={equipment.currency}
            strength={strength}
            size={race?.size?.[0]}
          />
          <CoinPurse currency={equipment.currency} />

          <StartingEquipment
            catalog={items ?? []}
            index={catalog}
            rows={baseRows}
            edition={edition}
            firstClass={firstClass}
            background={background}
            taken={equipment.starting}
            stacks={stacks}
            history={character.history}
          />

          {strays.map((item) => (
            <NotInBooksAlert
              key={item.key}
              noun="item"
              name={item.name}
              source={item.source}
              onRemove={() => removeKey(item.key)}
            />
          ))}

          <PickMany<Item>
            tableId="item-reference"
            rows={lookupRows}
            columns={itemColumns}
            idOf={itemKey}
            nameOf={itemName}
            tagsOf={itemTags}
            describe={describeItems}
            searchText={itemSearchText}
            rowMeta={rowMeta}
            pickedRowMeta={rowMeta}
            picked={owned}
            onAdd={(item) => (item.variant ? setChoosing(item) : addItem(item))}
            onRemove={(item) => removeKey(item.key)}
            quantityOf={(item) => stackOf.get(item.key)?.quantity ?? 1}
            onQuantity={setQuantity}
            noun="items"
            toolbar={() => (
              <Button size="sm" variant="secondary" onClick={() => setCustom(true)}>
                Add custom item
              </Button>
            )}
            changeLabel="Add items"
            summaryColumns={summaryColumns}
            summaryTableId="item-picks"
            tableShare={70}
            labels={{
              compare: 'Compare items',
              search: 'Search items and text...',
              table: 'Items',
            }}
          />

          <BaseItemChooser
            template={choosing}
            rows={baseRows}
            edition={edition}
            onChoose={(template, base) => {
              addVariant(template, base)
              setChoosing(undefined)
            }}
            onHide={() => setChoosing(undefined)}
          />
          <CustomItemModal
            show={custom !== false}
            editing={typeof custom === 'object' ? custom : undefined}
            onSave={(draft) => {
              saveCustom(draft, typeof custom === 'object' ? custom : undefined)
              setCustom(false)
            }}
            onHide={() => setCustom(false)}
          />
        </>
      )}
    </EditorSection>
  )
}
