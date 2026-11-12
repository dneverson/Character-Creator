// What a character carries, in numbers: weight against what can be carried, items attuned
// against the limit, what the items are worth, and the purse. Going over either limit is
// flagged, never blocked. The Equipment section and the sheet's Inventory tab both show it.

import Form from 'react-bootstrap/Form'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { appConfig } from '../../config/app'
import { lookup } from '../../data/glossary'
import { goldLabel, type Item } from '../../data/items'
import { editEquipment } from '../../character/inventoryEdit'
import type { Currency, InventoryItem } from '../../character/model'
import {
  attunedCount,
  carriedWeight,
  carryingCapacity,
  purseValue,
  totalValue,
} from '../../rules/equipment'
import { NonStandardBadge } from '../NonStandardBadge'
import { DraftInput } from './DraftInput'
import { oneDecimal } from './inventoryColumns'

const COINS: (keyof Currency)[] = ['pp', 'gp', 'ep', 'sp', 'cp']

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
/** "Gold pieces": a coin spelled out, from the glossary the tooltips use. */
const coinName = (coin: keyof Currency) =>
  capitalize(lookup(coin, 'currency')?.full ?? coin)

const setCoin = (coin: keyof Currency, value: number) =>
  editEquipment((equipment) => ({
    ...equipment,
    currency: { ...equipment.currency, [coin]: Math.max(0, value || 0) },
  }))

interface TotalsProps {
  stacks: InventoryItem[]
  owned: Item[]
  currency: Currency
  strength: number
  /** The character's size, for the carrying capacity. */
  size?: string
}

export function InventoryTotals({
  stacks,
  owned,
  currency,
  strength,
  size,
}: TotalsProps) {
  const carried = carriedWeight(
    owned.map((item, i) => ({ quantity: stacks[i].quantity, weight: item.weight })),
    currency,
  )
  const worth = totalValue(
    owned.map((item, i) => ({ quantity: stacks[i].quantity, value: item.value })),
  )
  const capacity = strength > 0 ? carryingCapacity(strength, size) : undefined
  const attuned = attunedCount(stacks)
  const limit = appConfig.rules.attunementLimit
  return (
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
  )
}

/** The five coins, each a number to type, and what the purse is worth. */
export function CoinPurse({ currency }: { currency: Currency }) {
  return (
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
            value={String(currency[coin])}
            onCommit={(text) => setCoin(coin, Number(text))}
          />
        </div>
      ))}
      <span className="small text-body-secondary pb-1">
        Purse worth {goldLabel(purseValue(currency))}
      </span>
    </div>
  )
}
