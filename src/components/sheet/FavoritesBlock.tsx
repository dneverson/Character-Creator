// The Favorites of the Actions tab: the attacks, spells, items, features and limited uses the
// player pinned, in the order they chose. Each row shows what the sheet says of that thing
// now, drawn by the same cells as its own table (never a copy), so a counter spends and a
// number opens how it adds up right here; a click on the row opens the same text in the
// sheet's pane. What was pinned and is gone says so and can only be removed.

import { useMemo, type ReactNode } from 'react'
import Button from 'react-bootstrap/Button'
import type { Favorite, FavoriteKind } from '../../character/favorites'
import { useCharacter } from '../../character/useCharacterDoc'
import { loadItems, type Item } from '../../data/items'
import type { DerivedSheet } from '../../derived'
import { useAsyncData } from '../../hooks/useAsyncData'
import { attackName } from '../editor/attackText'
import { AttackNotes } from '../editor/CombatSection'
import {
  describeItems,
  itemRowMeta,
  itemSummaryColumns,
  itemTags,
} from '../editor/itemFacts'
import type { SpellLine } from '../editor/SpellLines'
import { describeLines, spellLineColumns } from '../editor/spellLineFacts'
import { spellTags } from '../editor/spellFacts'
import { useOwnedItems } from '../editor/useOwnedItems'
import { useSpellLines } from '../editor/useSpellLines'
import { EntryDetail } from '../table/EntryDetail'
import { withRulesGroup } from '../table/rulesGroup'
import { NO_VALUE } from '../table/facts'
import type { Column } from '../table/types'
import { featureColumns } from './featureFacts'
import { FeatureUses } from './featureUses'
import { useFeatureUses } from './useFeatureUses'
import { ItemCharges } from './ItemCharges'
import { IconButton } from './PlayStrip'
import { AttackDamage, AttackToHit } from './SheetAttacks'
import { useSheetDetail, useSheetRowDetail } from './SheetDetail'
import { concentrationAction } from './concentrationAction'
import { UseCounter } from './UseCounter'
import { useOpenUse } from './useOpenUse'
import { useFavorites } from './useFavorites'
import { useApplyPlay, usePlay } from './usePlay'
import { rechargeShort } from './usesText'

const KIND_LABEL: Record<FavoriteKind, string> = {
  attack: 'Attack',
  spell: 'Spell',
  item: 'Item',
  feature: 'Feature',
  use: 'Limited use',
}

export const STALE_FAVORITE = 'No longer on this character'

interface Cell {
  /** What the cell is ("To hit"). */
  label: ReactNode
  node: ReactNode
}

/** A cell drawn by the column of the table the row also lives in. */
function cellOf<T>(columns: readonly Column<T>[], key: string, row: T): Cell | undefined {
  const column = columns.find((c) => c.key === key)
  return column && { label: column.header, node: column.render(row) }
}

/** Clicks on a control inside the row are the control's own, not a request for the text. */
const INTERACTIVE = 'button, a, input, select, textarea, [role="group"]'

interface RowProps {
  favorite: Favorite
  /** Where the row stands among the favorites. */
  index: number
  count: number
  /** The name as plain text: it names the buttons. */
  name: string
  /** The name as the table draws it, when that is more than the text. */
  title?: ReactNode
  cells?: (Cell | false | undefined)[]
  /** Opens the row's text in the pane; absent for a row with none. */
  open?: () => void
  selected?: boolean
  stale?: boolean
}

function FavoriteRow({
  favorite,
  index,
  count,
  name,
  title,
  cells = [],
  open,
  selected,
  stale,
}: RowProps) {
  const { remove, move } = useFavorites()
  const shown = cells.filter((c): c is Cell => c !== undefined && c !== false)
  return (
    <li
      className={`sheet-favs__row${selected ? ' sheet-favs__row--open' : ''}${
        open ? ' sheet-favs__row--link' : ''
      }`}
      aria-label={stale ? `${KIND_LABEL[favorite.kind]}: ${STALE_FAVORITE}` : name}
      onClick={(e) => {
        if (!open || (e.target instanceof Element && e.target.closest(INTERACTIVE)))
          return
        open()
      }}
    >
      <div className="sheet-favs__main">
        <div className="sheet-favs__name">
          <span className="sheet-favs__kind">{KIND_LABEL[favorite.kind]}</span>
          {stale ? (
            <span className="text-body-secondary" title={favorite.key}>
              {STALE_FAVORITE}
            </span>
          ) : (
            (title ?? name)
          )}
        </div>
        {shown.length > 0 && (
          <dl className="sheet-favs__cells">
            {shown.map((cell, i) => (
              <div key={i} className="sheet-favs__cell">
                <dt>{cell.label}</dt>
                <dd>{cell.node}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="sheet-favs__controls">
        {!stale && (
          <>
            <IconButton
              label={`Move ${name} up`}
              icon="moveUp"
              disabled={index === 0}
              onClick={() => move(favorite, -1)}
            />
            <IconButton
              label={`Move ${name} down`}
              icon="moveDown"
              disabled={index === count - 1}
              onClick={() => move(favorite, 1)}
            />
          </>
        )}
        <IconButton
          label={`Remove ${stale ? KIND_LABEL[favorite.kind] : name} from Favorites`}
          icon="minus"
          onClick={() => remove(favorite)}
        />
      </div>
    </li>
  )
}

function FavoritesList({
  sheet,
  favorites,
}: {
  sheet: DerivedSheet
  favorites: readonly Favorite[]
}) {
  const character = useCharacter()
  const applyPlay = useApplyPlay()
  const current = usePlay(sheet)
  const detail = useSheetDetail()
  const openUse = useOpenUse()
  const spellDetail = useSheetRowDetail('spells')
  const itemDetail = useSheetRowDetail('inventory')
  const featureDetail = useSheetRowDetail('features')
  const { lines, loading: spellsLoading } = useSpellLines()
  const { data: items, loading: itemsLoading } = useAsyncData(loadItems)
  const stacks = useMemo(() => character?.equipment.items ?? [], [character])
  const { owned, stackOf } = useOwnedItems(items, stacks)
  const featureUses = useFeatureUses(sheet)
  const rowMeta = useMemo(() => itemRowMeta(sheet.edition), [sheet.edition])
  const itemDescribe = useMemo(() => withRulesGroup(describeItems, rowMeta), [rowMeta])
  const pools = current?.derived.uses

  return (
    <ol className="sheet-favs__list">
      {favorites.map((favorite, index) => {
        const at = { favorite, index, count: favorites.length }
        const id = `${favorite.kind}:${favorite.key}`
        const gone = (
          <FavoriteRow key={id} {...at} name={KIND_LABEL[favorite.kind]} stale />
        )
        const loading = <FavoriteRow key={id} {...at} name="Loading" />
        switch (favorite.kind) {
          case 'attack': {
            const attack = sheet.attacks.find((a) => a.id === favorite.key)
            if (!attack) return gone
            const flag = attack.toHit.lines.find((l) => l.status === 'flag')
            return (
              <FavoriteRow
                key={id}
                {...at}
                name={attackName(attack)}
                cells={[
                  { label: 'To hit', node: <AttackToHit attack={attack} /> },
                  { label: 'Damage', node: <AttackDamage attack={attack} /> },
                  { label: 'Damage type', node: attack.damage.types || NO_VALUE },
                  { label: 'Notes', node: <AttackNotes attack={attack} flag={flag} /> },
                ]}
              />
            )
          }
          case 'spell': {
            const line = lines.find((l) => l.id === favorite.key)
            if (!line) return spellsLoading ? loading : gone
            const concentrate = concentrationAction(
              applyPlay,
              line,
              character?.play.concentration ?? null,
            )
            const detailOf = (row: SpellLine) => (
              <EntryDetail
                entry={row}
                describe={describeLines}
                name={row.spell.name}
                tags={spellTags(row.spell)}
                action={
                  concentrate && (
                    <Button
                      size="sm"
                      variant={concentrate.variant ?? 'primary'}
                      onClick={concentrate.run}
                    >
                      {concentrate.label}
                    </Button>
                  )
                }
              />
            )
            return (
              <FavoriteRow
                key={id}
                {...at}
                name={line.spell.name}
                title={spellLineColumns[0].render(line)}
                cells={['level', 'casting', 'range', 'saveOrAttack'].map((key) =>
                  cellOf(spellLineColumns, key, line),
                )}
                selected={spellDetail.openId === line.id}
                open={() => spellDetail.show(line.id, detailOf(line))}
              />
            )
          }
          case 'item': {
            const item = owned.find((i) => i.key === favorite.key)
            if (!item) return itemsLoading ? loading : gone
            const named = itemSummaryColumns.find((c) => c.key === 'name') as Column<Item>
            return (
              <FavoriteRow
                key={id}
                {...at}
                name={item.name}
                title={named.render(item)}
                cells={[
                  { label: 'Qty', node: stackOf.get(item.key)?.quantity ?? 1 },
                  item.charges && {
                    label: 'Charges',
                    node: (
                      <ItemCharges
                        item={item}
                        resources={sheet.resources}
                        pools={pools}
                      />
                    ),
                  },
                ]}
                selected={itemDetail.openId === item.key}
                open={() =>
                  itemDetail.show(
                    item.key,
                    <EntryDetail
                      entry={item}
                      describe={itemDescribe}
                      name={item.name}
                      tags={itemTags(item)}
                    />,
                  )
                }
              />
            )
          }
          case 'feature': {
            const row = sheet.features.find((f) => f.id === favorite.key)
            if (!row) return gone
            return (
              <FavoriteRow
                key={id}
                {...at}
                name={row.name}
                cells={[
                  cellOf(featureColumns, 'from', row),
                  featureUses.counters.has(row.id) && {
                    label: 'Uses',
                    node: (
                      <FeatureUses
                        row={row}
                        counters={featureUses.counters}
                        pools={featureUses.pools}
                      />
                    ),
                  },
                ]}
                selected={featureDetail.openId === row.id}
                open={() =>
                  featureDetail.show(
                    row.id,
                    <EntryDetail
                      entry={row}
                      describe={featureUses.describe}
                      name={row.name}
                    />,
                  )
                }
              />
            )
          }
          case 'use': {
            const resource = sheet.resources.find((r) => r.id === favorite.key)
            if (!resource) return gone
            return (
              <FavoriteRow
                key={id}
                {...at}
                name={resource.label}
                cells={[
                  {
                    label: 'Uses',
                    node: (
                      <UseCounter
                        resource={resource}
                        pool={pools?.find((p) => p.id === resource.id)}
                      />
                    ),
                  },
                  { label: 'Restores', node: rechargeShort(resource) },
                  { label: 'From', node: resource.from },
                ]}
                selected={detail.current?.id === `uses:${resource.id}`}
                open={() => openUse(resource)}
              />
            )
          }
        }
      })}
    </ol>
  )
}

/** The block at the top of the Actions tab. */
export function FavoritesBlock({ sheet }: { sheet: DerivedSheet }) {
  const { favorites } = useFavorites()
  return (
    <section className="sheet-favs" aria-label="Favorites">
      <h3 className="h6 mb-2">Favorites</h3>
      {favorites.length === 0 ? (
        <p className="sheet-favs__empty">
          Nothing here yet. Use the plus button in the Favorite column of an attack,
          spell, item, feature or limited use to keep it here for quick access.
        </p>
      ) : (
        <FavoritesList sheet={sheet} favorites={favorites} />
      )}
    </section>
  )
}
