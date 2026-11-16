// The purse on the Inventory tab: the five coins to type, coins added and coins spent
// (a price is made up from the coins, breaking a bigger one for change), and one kind of
// coin changed for another. A spend the purse cannot meet is flagged and still goes
// through: the purse is emptied. Every change is a play change, recorded in the history.

import { useState } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import { changeCoins, payCoins, setCoin, takeCoins } from '../../character/inventoryPlay'
import { useCarry } from '../../character/inventoryEdit'
import type { Currency } from '../../character/model'
import {
  COIN_ORDER,
  coinListText,
  coinsText,
  exchangeCoins,
  spendCoins,
  type Coin,
  coinName,
} from '../../rules/coins'
import { COIN_COPPER } from '../../rules/equipment'
import { AbbrText } from '../Abbr'
import { CoinPurse } from '../editor/InventoryTotals'
import { NonStandardBadge } from '../NonStandardBadge'

const whole = (text: string) => Math.max(0, Math.floor(Number(text)) || 0)

function CoinSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: Coin
  onChange: (coin: Coin) => void
}) {
  return (
    <div>
      <Form.Label htmlFor={id} className="small mb-1">
        {label}
      </Form.Label>
      <Form.Select
        id={id}
        size="sm"
        value={value}
        onChange={(e) => onChange(e.target.value as Coin)}
      >
        {COIN_ORDER.map((coin) => (
          <option key={coin} value={coin}>
            {coinName(coin)}
          </option>
        ))}
      </Form.Select>
    </div>
  )
}

export function CoinsPanel({ currency }: { currency: Currency }) {
  const carry = useCarry()
  const [amount, setAmount] = useState('1')
  const [coin, setCoinKind] = useState<Coin>('gp')
  const [swapAmount, setSwapAmount] = useState('10')
  const [from, setFrom] = useState<Coin>('sp')
  const [to, setTo] = useState<Coin>('gp')
  const n = whole(amount)
  const paying = n > 0 ? spendCoins(currency, n * COIN_COPPER[coin], coin) : undefined
  const swap = exchangeCoins(currency, from, to, whole(swapAmount))

  return (
    <div className="sheet-coins mb-3">
      <CoinPurse
        currency={currency}
        onSet={(kind, value) => carry((equipment) => setCoin(equipment, kind, value))}
      />
      <div className="d-flex flex-wrap align-items-end gap-2 mb-1">
        <div>
          <Form.Label htmlFor="coins-amount" className="small mb-1">
            Coins to add or spend
          </Form.Label>
          <Form.Control
            id="coins-amount"
            type="number"
            size="sm"
            min={0}
            style={{ width: 110 }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <CoinSelect
          id="coins-kind"
          label="Kind of coin"
          value={coin}
          onChange={setCoinKind}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={n === 0}
          onClick={() => carry((equipment) => takeCoins(equipment, coin, n))}
        >
          Add coins
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={n === 0}
          onClick={() => carry((equipment) => payCoins(equipment, coin, n))}
        >
          Spend coins
        </Button>
      </div>
      {paying && (
        <div className="small mb-2" aria-live="polite">
          {paying.short > 0 && (
            <>
              <NonStandardBadge
                reason={`The purse is ${coinsText(paying.short)} short of the price. Spending it empties the purse (DM approval).`}
                label="Not enough coin"
              />{' '}
              Short by <AbbrText text={coinsText(paying.short)} kind="currency" />; the
              purse would be emptied.
            </>
          )}
          {paying.short === 0 && paying.broke && (
            <>
              Breaks one <AbbrText text={paying.broke} kind="currency" /> and gives back{' '}
              <AbbrText text={coinListText(paying.change)} kind="currency" /> in change.
            </>
          )}
        </div>
      )}
      <div className="d-flex flex-wrap align-items-end gap-2">
        <div>
          <Form.Label htmlFor="coins-swap-amount" className="small mb-1">
            Coins to change
          </Form.Label>
          <Form.Control
            id="coins-swap-amount"
            type="number"
            size="sm"
            min={0}
            style={{ width: 110 }}
            value={swapAmount}
            onChange={(e) => setSwapAmount(e.target.value)}
          />
        </div>
        <CoinSelect id="coins-swap-from" label="Change" value={from} onChange={setFrom} />
        <CoinSelect id="coins-swap-to" label="For" value={to} onChange={setTo} />
        <Button
          size="sm"
          variant="secondary"
          disabled={swap.got === 0}
          onClick={() =>
            carry((equipment) => changeCoins(equipment, from, to, whole(swapAmount)))
          }
        >
          Change coins
        </Button>
        <span className="small text-body-secondary pb-1">
          {swap.got > 0 ? (
            <>
              <AbbrText text={`${swap.gave} ${from}`} kind="currency" /> for{' '}
              <AbbrText text={`${swap.got} ${to}`} kind="currency" />
            </>
          ) : (
            'Nothing to change at this amount'
          )}
        </span>
      </div>
    </div>
  )
}
