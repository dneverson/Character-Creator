// An item that is in no book: a DM's gift or a homebrew one. Only the name is needed;
// the rest is what the player knows. It is kept whole on the character, so nothing
// is looked up later. Opened on an existing custom item it edits that one.

import { useState } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import { rarityLabel } from '../../data/items'
import type { ItemKind } from '../../data/itemTypes'
import { ITEM_KIND_LABELS } from '../../data/labels'
import type { CustomItem, InventoryItem } from '../../character/model'

const RARITIES = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']
/** Coinage is the purse's, not a thing to carry. */
const KINDS = (Object.keys(ITEM_KIND_LABELS) as ItemKind[]).filter((k) => k !== 'coin')

export interface CustomItemDraft {
  name: string
  quantity: number
  custom: CustomItem
}

interface Props {
  show: boolean
  /** The custom stack being edited; absent when making a new item. */
  editing?: InventoryItem
  onSave: (draft: CustomItemDraft) => void
  onHide: () => void
}

/** The fields as typed: numbers stay text until saved, so a box can be emptied. */
interface Fields {
  name: string
  kind: ItemKind
  rarity: string
  weight: string
  gold: string
  attunement: boolean
  description: string
  quantity: string
}

const fieldsOf = (stack?: InventoryItem): Fields => ({
  name: stack?.name ?? '',
  kind: stack?.custom?.kind ?? 'gear',
  rarity: stack?.custom?.rarity ?? '',
  weight: stack?.custom?.weight?.toString() ?? '',
  gold: stack?.custom?.value === undefined ? '' : String(stack.custom.value / 100),
  attunement: stack?.custom?.attunement ?? false,
  description: stack?.custom?.description ?? '',
  quantity: String(stack?.quantity ?? 1),
})

const numberOf = (text: string) => (text.trim() === '' ? undefined : Number(text))

function CustomItemForm({ editing, onSave, onHide }: Omit<Props, 'show'>) {
  const [fields, setFields] = useState(() => fieldsOf(editing))
  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((f) => ({ ...f, [key]: value }))
  const name = fields.name.trim()
  const save = () => {
    const weight = numberOf(fields.weight)
    const gold = numberOf(fields.gold)
    onSave({
      name,
      quantity: Math.max(1, Math.floor(Number(fields.quantity) || 1)),
      custom: {
        kind: fields.kind,
        rarity: fields.rarity || undefined,
        weight: weight !== undefined && weight >= 0 ? weight : undefined,
        value: gold !== undefined && gold >= 0 ? Math.round(gold * 100) : undefined,
        attunement: fields.attunement || undefined,
        description: fields.description.trim(),
      },
    })
  }
  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault()
        if (name) save()
      }}
    >
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {editing ? 'Edit custom item' : 'Add a custom item'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-grid gap-3">
        <Form.Group controlId="custom-item-name">
          <Form.Label>Name</Form.Label>
          <Form.Control
            autoFocus
            required
            value={fields.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </Form.Group>
        <div className="d-flex flex-wrap gap-3">
          <Form.Group controlId="custom-item-kind">
            <Form.Label>Type</Form.Label>
            <Form.Select
              value={fields.kind}
              onChange={(e) => set('kind', e.target.value as ItemKind)}
            >
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {ITEM_KIND_LABELS[kind]}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group controlId="custom-item-rarity">
            <Form.Label>Rarity</Form.Label>
            <Form.Select
              value={fields.rarity}
              onChange={(e) => set('rarity', e.target.value)}
            >
              <option value="">Not magic</option>
              {RARITIES.map((rarity) => (
                <option key={rarity} value={rarity}>
                  {rarityLabel(rarity)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group controlId="custom-item-quantity">
            <Form.Label>Quantity</Form.Label>
            <Form.Control
              type="number"
              min={1}
              style={{ width: 90 }}
              value={fields.quantity}
              onChange={(e) => set('quantity', e.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="custom-item-weight">
            <Form.Label>Weight (lb)</Form.Label>
            <Form.Control
              type="number"
              min={0}
              step="any"
              style={{ width: 110 }}
              value={fields.weight}
              onChange={(e) => set('weight', e.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="custom-item-cost">
            <Form.Label>Cost (gp)</Form.Label>
            <Form.Control
              type="number"
              min={0}
              step="any"
              style={{ width: 110 }}
              value={fields.gold}
              onChange={(e) => set('gold', e.target.value)}
            />
          </Form.Group>
        </div>
        <Form.Check
          type="checkbox"
          id="custom-item-attunement"
          label="Requires attunement"
          checked={fields.attunement}
          onChange={(e) => set('attunement', e.target.checked)}
        />
        <Form.Group controlId="custom-item-description">
          <Form.Label>Description</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={fields.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={!name}>
          {editing ? 'Save' : 'Add'}
        </Button>
      </Modal.Footer>
    </Form>
  )
}

export function CustomItemModal({ show, editing, onSave, onHide }: Props) {
  return (
    <Modal show={show} onHide={onHide} centered>
      {/* Remounted per opening, so the form starts from the item being edited. */}
      {show && (
        <CustomItemForm
          key={editing ? `${editing.name}|${editing.source}` : 'new'}
          editing={editing}
          onSave={onSave}
          onHide={onHide}
        />
      )}
    </Modal>
  )
}
