// Equipment: look up any item of the enabled books and carry it. The lookup is the
// shared table of every item with all its stats (filters, compare, detail pane), the
// inventory its short table of what is owned: quantity, worn, attuned, a note and a
// Remove. Above them one line says what is carried against what can be, and how many
// items the character is attuned to; going over either is flagged, never blocked.

import { useMemo, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import Spinner from 'react-bootstrap/Spinner'
import { applyVariant } from '../../data/itemVariants'
import { goldLabel, loadItems, type Item } from '../../data/items'
import { lookup } from '../../data/glossary'
import { appConfig } from '../../config/app'
import { useActiveCharacter } from '../../character/store'
import { editEquipment, editItems } from '../../character/inventoryEdit'
import type { Currency, InventoryItem } from '../../character/model'
import { characterAbilityTotals } from '../../character/derive'
import {
  CUSTOM_SOURCE,
  indexItems,
  inventoryKey,
  resolveInventoryItem,
  uniqueCustomName,
  unlistedItem,
  unpackStack,
} from '../../character/inventory'
import {
  attunedCount,
  carriedWeight,
  carryingCapacity,
  lacksClass,
  purseValue,
  strengthNeeded,
  totalValue,
} from '../../rules/equipment'
import { useAsyncData } from '../../hooks/useAsyncData'
import { AbbrText } from '../Abbr'
import { NonStandardBadge } from '../NonStandardBadge'
import { PickMany } from '../table/PickMany'
import { NO_VALUE } from '../table/facts'
import type { Column } from '../table/types'
import { EditorSection } from './EditorSection'
import { BaseItemChooser } from './BaseItemChooser'
import { CustomItemModal, type CustomItemDraft } from './CustomItemModal'
import { NotInBooksAlert } from './NotInBooksAlert'
import { StartingEquipment } from './StartingEquipment'
import { useFeatSummary } from './useFeatSummary'
import { DraftInput } from './DraftInput'
import {
  describeItems,
  itemColumns,
  itemKey,
  itemName,
  itemRowMeta,
  itemSearchText,
  itemSummaryColumns,
  itemTags,
} from './itemFacts'

const COINS: (keyof Currency)[] = ['pp', 'gp', 'ep', 'sp', 'cp']

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
/** "Gold pieces": a coin spelled out, from the glossary the tooltips use. */
const coinName = (coin: keyof Currency) =>
  capitalize(lookup(coin, 'currency')?.full ?? coin)

const oneDecimal = (n: number) => Math.round(n * 10) / 10

const editStack = (key: string, patch: Partial<InventoryItem>) =>
  editItems((all) => all.map((s) => (inventoryKey(s) === key ? { ...s, ...patch } : s)))

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
const setCoin = (coin: keyof Currency, value: number) =>
  editEquipment((equipment) => ({
    ...equipment,
    currency: { ...equipment.currency, [coin]: Math.max(0, value || 0) },
  }))

/** Whether an item can be attuned to (it needs attunement, or may have it). */
const attunable = (item: Item) => item.attunement !== undefined

export function EquipmentSection() {
  const character = useActiveCharacter()
  const { data: items, error, loading } = useAsyncData(loadItems)
  const { background, classByKey, race, summary } = useFeatSummary()

  const catalog = useMemo(() => indexItems(items ?? []), [items])
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
  const owned = useMemo(
    () => stacks.map((s) => resolveInventoryItem(s, catalog) ?? unlistedItem(s)),
    [stacks, catalog],
  )
  const stackOf = useMemo(
    () => new Map(stacks.map((s) => [inventoryKey(s), s])),
    [stacks],
  )
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

  const summaryColumns = useMemo<Column<Item>[]>(() => {
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
              {stack && item.pack && item.pack.length > 0 && (
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
              {stack?.custom && (
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
  }, [stackOf, catalog, strength, classNames])

  if (!character) return null
  const equipment = character.equipment
  const strays = owned.filter(
    (item) => item.source !== 'Custom' && !selectedBooks?.includes(item.source),
  )

  const carried = carriedWeight(
    owned.map((item, i) => ({ quantity: stacks[i].quantity, weight: item.weight })),
    equipment.currency,
  )
  const worth = totalValue(
    owned.map((item, i) => ({ quantity: stacks[i].quantity, value: item.value })),
  )
  const capacity = strength > 0 ? carryingCapacity(strength, race?.size?.[0]) : undefined
  const attuned = attunedCount(stacks)
  const limit = appConfig.rules.attunementLimit

  return (
    <EditorSection
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
          <div className="d-flex flex-wrap align-items-center column-gap-4 row-gap-1 mb-3">
            <span>
              Carried <strong>{oneDecimal(carried.pounds)}</strong>
              {capacity !== undefined && ` of ${capacity}`} lb
              {capacity !== undefined && carried.pounds > capacity && (
                <>
                  {' '}
                  <NonStandardBadge
                    reason="More than the character can carry (DM approval)"
                    label="Over capacity"
                  />
                </>
              )}
            </span>
            <span>
              Attuned <strong>{attuned}</strong> of {limit}
              {attuned > limit && (
                <>
                  {' '}
                  <NonStandardBadge
                    reason={`More than ${limit} attuned items (DM approval)`}
                    label={`More than ${limit} attuned`}
                  />
                </>
              )}
            </span>
            <span>
              Items worth <strong>{goldLabel(worth.copper)}</strong>
            </span>
            {carried.unlisted > 0 && (
              <span className="small text-body-secondary">
                {carried.unlisted === 1
                  ? '1 item has no listed weight'
                  : `${carried.unlisted} items have no listed weight`}
              </span>
            )}
          </div>

          <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
            {COINS.map((coin) => (
              <div key={coin} style={{ width: 110 }}>
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip>{coin.toUpperCase()}</Tooltip>}
                >
                  <Form.Label htmlFor={`coin-${coin}`} className="small mb-1">
                    {coinName(coin)}
                  </Form.Label>
                </OverlayTrigger>
                <DraftInput
                  id={`coin-${coin}`}
                  type="number"
                  size="sm"
                  min={0}
                  value={String(equipment.currency[coin])}
                  onCommit={(text) => setCoin(coin, Number(text))}
                />
              </div>
            ))}
            <span className="small text-body-secondary pb-1">
              Purse worth {goldLabel(purseValue(equipment.currency))}
            </span>
          </div>

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
