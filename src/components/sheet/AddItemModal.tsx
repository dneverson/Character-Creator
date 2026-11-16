// Adding an item in play: the creator's item lookup table in a window (every stat as a
// column, the detail pane beside it), with a choice of how the item comes: found or given
// (no cost) or bought (its listed price comes out of the purse, and a purse that cannot
// pay it is flagged, never refused). Each click adds one; the window stays open for more.

import { useMemo, useState, type ReactNode } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import Modal from 'react-bootstrap/Modal'
import { acquire, type Outcome } from '../../character/inventoryPlay'
import { useCarry } from '../../character/inventoryEdit'
import type { Currency } from '../../character/model'
import type { Item } from '../../data/items'
import { coinListText, coinsText } from '../../rules/coins'
import { purseValue } from '../../rules/equipment'
import { AbbrText } from '../Abbr'
import { BaseItemChooser } from '../editor/BaseItemChooser'
import {
  describeItems,
  itemColumns,
  itemKey,
  itemName,
  itemRowMeta,
  itemSearchText,
  itemTags,
  lookupItems,
} from '../editor/itemFacts'
import { NonStandardBadge } from '../NonStandardBadge'
import { BrowseTable } from '../table/BrowseTable'

type How = 'add' | 'buy'

const coins = (text: string) => <AbbrText text={text} kind="currency" />

/** What the last click did, in words. */
function said(out: Outcome): ReactNode {
  const name = out.action.item
  if (out.action.change === 'add') return <>Added {name}.</>
  if (out.unpriced) {
    return <>{name} has no listed price, so it was added and nothing was spent.</>
  }
  const paid = out.action.price ?? 0
  return (
    <>
      Bought {name} for {coins(coinsText(paid))}.
      {out.broke && <> A {coins(out.broke)} was broken for change.</>}
      {out.short !== undefined && (
        <>
          {' '}
          <NonStandardBadge
            reason={`The purse was ${coinsText(out.short)} short of the price and is now empty (DM approval).`}
            label="Not enough coin"
          />{' '}
          Short by {coins(coinsText(out.short))}.
        </>
      )}
    </>
  )
}

interface Props {
  show: boolean
  onHide: () => void
  catalog: readonly Item[]
  books: readonly string[]
  edition: Item['edition']
  currency: Currency
}

export function AddItemModal({ show, onHide, catalog, books, edition, currency }: Props) {
  const carry = useCarry()
  const [how, setHow] = useState<How>('add')
  const [choosing, setChoosing] = useState<Item>()
  const [last, setLast] = useState<ReactNode>(null)
  const rows = useMemo(() => lookupItems(catalog, books), [catalog, books])
  const baseRows = useMemo(() => rows.filter((row) => !row.variant), [rows])
  const rowMeta = useMemo(() => itemRowMeta(edition), [edition])

  const take = (item: Item, base?: Item) => {
    const out = carry((equipment) => acquire(equipment, item, how, base))
    if (out) setLast(said(out))
  }
  const word = how === 'buy' ? 'Buy' : 'Add'

  return (
    <>
      <Modal show={show} onHide={onHide} size="xl" scrollable>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5">
            Add an item
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex flex-wrap align-items-center gap-3 mb-2">
            <ButtonGroup aria-label="How the item comes">
              <Button
                variant={how === 'add' ? 'primary' : 'secondary'}
                aria-pressed={how === 'add'}
                onClick={() => setHow('add')}
              >
                Add: found or given, no cost
              </Button>
              <Button
                variant={how === 'buy' ? 'primary' : 'secondary'}
                aria-pressed={how === 'buy'}
                onClick={() => setHow('buy')}
              >
                Buy: pay the listed price
              </Button>
            </ButtonGroup>
            {how === 'buy' && (
              <span className="small">
                Purse {coins(coinListText(currency))} (worth{' '}
                {coins(coinsText(purseValue(currency)))})
              </span>
            )}
          </div>
          {last && (
            <Alert variant="secondary" className="py-2" role="status">
              {last}
            </Alert>
          )}
          <BrowseTable<Item>
            tableId="sheet-item-add"
            rows={rows}
            columns={itemColumns}
            idOf={itemKey}
            nameOf={itemName}
            tagsOf={itemTags}
            describe={describeItems}
            searchText={itemSearchText}
            rowMeta={rowMeta}
            action={{
              key: 'take',
              header: word,
              of: (item) => ({
                label: `${word} ${item.name}`,
                detailLabel: how === 'buy' ? 'Buy one' : 'Add one',
                run: () => (item.variant ? setChoosing(item) : take(item)),
              }),
            }}
            tableShare={70}
            labels={{
              compare: 'Compare items',
              search: 'Search items and text...',
              table: 'Items',
            }}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={onHide}>
            Done
          </Button>
        </Modal.Footer>
      </Modal>
      <BaseItemChooser
        template={choosing}
        rows={baseRows}
        edition={edition}
        onChoose={(template, base) => {
          take(template, base)
          setChoosing(undefined)
        }}
        onHide={() => setChoosing(undefined)}
      />
    </>
  )
}
