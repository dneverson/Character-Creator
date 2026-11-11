// "Which one?": a generic variant ("+1 Weapon") is a template, so adding it asks for
// the item it is made of. The question is the same table of items as the lookup,
// narrowed to the items the template fits; one click on a row makes the item.

import { useMemo } from 'react'
import Modal from 'react-bootstrap/Modal'
import { applyVariant, variantApplies } from '../../data/itemVariants'
import type { Item } from '../../data/items'
import { BrowseTable } from '../table/BrowseTable'
import {
  describeItems,
  itemColumns,
  itemKey,
  itemName,
  itemRowMeta,
  itemSearchText,
  itemTags,
  withItemVersions,
} from './itemFacts'

interface Props {
  /** The generic variant being added; the chooser is shut without one. */
  template: Item | undefined
  /** The items it could be made of: the lookup's rows. */
  rows: Item[]
  edition: Item['edition']
  /** The template and the base item picked. */
  onChoose: (template: Item, base: Item) => void
  onHide: () => void
}

export function BaseItemChooser({ template, rows, edition, onChoose, onHide }: Props) {
  const fitting = useMemo(
    () => (template ? rows.filter((row) => variantApplies(template, row)) : []),
    [template, rows],
  )
  const columns = useMemo(() => withItemVersions(itemColumns), [])
  const rowMeta = useMemo(() => itemRowMeta(edition), [edition])
  return (
    <Modal show={template !== undefined} onHide={onHide} size="xl" scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Which one? Choose what {template?.name} is made of
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {template && (
          <BrowseTable<Item>
            tableId="item-base-chooser"
            rows={fitting}
            columns={columns}
            idOf={itemKey}
            nameOf={itemName}
            tagsOf={itemTags}
            describe={describeItems}
            searchText={itemSearchText}
            rowMeta={rowMeta}
            tableShare={70}
            action={{
              key: 'choose',
              header: 'Choose',
              of: (base) => ({
                label: 'Choose',
                detailLabel: `Make ${applyVariant(template, base).name}`,
                run: () => onChoose(template, base),
              }),
            }}
            labels={{
              compare: 'Compare items',
              search: 'Search items and text...',
              detailPlaceholder: 'Select an item to see it in full.',
              table: 'Base items',
            }}
          />
        )}
      </Modal.Body>
    </Modal>
  )
}
