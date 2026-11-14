// The charges of an item: counted for an equipped item, only said for the rest. The
// Inventory tab and the Favorites draw it the same way.

import type { Item } from '../../data/items'
import type { DerivedResource } from '../../derived/resources'
import type { UsePool } from '../../play/derivePlay'
import { RechargeNote } from './RechargeNote'
import { UseCounter } from './UseCounter'

export function ItemCharges({
  item,
  resources,
  pools,
}: {
  item: Item
  resources: readonly DerivedResource[]
  pools: readonly UsePool[] | undefined
}) {
  const resource = resources.find((r) => r.id === `item:${item.key}`)
  if (!resource) return <>{item.charges?.max ?? ''}</>
  return (
    <span className="sheet-uses-cell__item">
      <UseCounter resource={resource} pool={pools?.find((p) => p.id === resource.id)} />
      <RechargeNote resource={resource} named={false} />
    </span>
  )
}
