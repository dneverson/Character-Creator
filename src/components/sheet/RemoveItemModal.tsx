// Letting an item go: sold (the price is put in the purse; the price the rules give is
// filled in and can be changed) or dropped (nothing comes back). A count below the stack
// leaves the rest of it in the inventory.

import { useState } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import { dispose } from '../../character/inventoryPlay'
import { useCarry } from '../../character/inventoryEdit'
import { inventoryKey } from '../../character/inventory'
import type { InventoryItem } from '../../character/model'
import type { Item } from '../../data/items'
import { sellPrice } from '../../rules/selling'
import { AbbrText } from '../Abbr'

interface Props {
  item: Item | undefined
  stack: InventoryItem | undefined
  edition: Item['edition']
  onHide: () => void
}

const gold = (copper: number) => String(Math.round(copper) / 100)

export function RemoveItemModal({ item, stack, edition, onHide }: Props) {
  const carry = useCarry()
  const [count, setCount] = useState('1')
  // What was typed in the price box; the price the rules give stands until something is typed.
  const [typed, setTyped] = useState<string>()
  if (!item || !stack) return null

  const n = Math.min(stack.quantity, Math.max(1, Math.floor(Number(count)) || 1))
  const rule = sellPrice(item, edition)
  const price = typed ?? (rule.copper === undefined ? '' : gold(rule.copper * n))
  const copper = Math.round((Number(price) || 0) * 100)
  const close = () => {
    setCount('1')
    setTyped(undefined)
    onHide()
  }
  const run = (how: 'sell' | 'drop') => {
    carry((equipment) =>
      dispose(equipment, inventoryKey(stack), n, how, how === 'sell' ? copper : 0),
    )
    close()
  }

  return (
    <Modal show onHide={close} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Remove {item.name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <Form.Label htmlFor="remove-count">
            How many (you have {stack.quantity})
          </Form.Label>
          <Form.Control
            id="remove-count"
            type="number"
            min={1}
            max={stack.quantity}
            style={{ width: 120 }}
            value={count}
            onChange={(e) => {
              setCount(e.target.value)
              setTyped(undefined)
            }}
          />
        </div>
        <div>
          <Form.Label htmlFor="remove-price">
            Price received in <AbbrText text="gp" kind="currency" /> (all {n})
          </Form.Label>
          <Form.Control
            id="remove-price"
            type="number"
            min={0}
            step={0.01}
            style={{ width: 120 }}
            value={price}
            onChange={(e) => setTyped(e.target.value)}
          />
          <Form.Text>{rule.note}</Form.Text>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => run('drop')}>
          Drop for nothing
        </Button>
        <Button variant="primary" disabled={copper <= 0} onClick={() => run('sell')}>
          Sell
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
