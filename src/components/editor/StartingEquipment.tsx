// Starting equipment: the card at the top of the Equipment section where the player
// takes what the class and the background give, in few clicks. The first option of
// every choice is already selected, so one click takes the default kit; options and
// "any martial weapon" picks can be changed before or after. A taken source folds to
// one line with a Change button; leaving it alone is a click too. A 2014 class can
// take gold instead: a roll that goes in the history (and can be rolled again), or a
// total typed from a table roll.

import { useMemo, useState } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import { useUpdateCharacter } from '../../character/useCharacterDoc'
import { useEditEquipment } from '../../character/inventoryEdit'
import type { HistoryEntry, InventoryItem, StartingPick } from '../../character/model'
import type { StartingGoldRollRecord } from '../../character/model'
import { newRoll, rollAction, rollRecords } from '../../character/rollHistory'
import {
  GOLD_OPTION,
  SKIP_OPTION,
  goldOf,
  isGoldOnly,
  pickRows,
  selectedGear,
  selectionOf,
  skipStarting,
  startingChoices,
  takeStarting,
  unpickedSlots,
  type Gear,
  type GearPick,
  type StartingChoices,
  type StartingSelection,
} from '../../character/startingEquipment'
import type { LoadedClass } from '../../data/class'
import type { PlayableBackground } from '../../data/background'
import { goldLabel, type Item } from '../../data/items'
import { editionYear } from '../../data/labels'
import { rollDice } from '../../dice/dice'
import { AbbrText } from '../Abbr'
import { PickOne } from '../table/PickOne'
import { equipmentText } from './backgroundFacts'
import {
  describeItems,
  itemColumns,
  itemKey,
  itemName,
  itemRowMeta,
  itemSearchText,
  itemTags,
} from './itemFacts'

type Which = 'class' | 'background'

/** "Chain Mail, Javelin x8, any martial weapon", then the coin: the gear as a line of text. */
function gearText(gear: readonly Gear[]): string {
  const parts = gear.flatMap((g) => {
    if (g.kind === 'item')
      return [g.quantity > 1 ? `${g.item.name} x${g.quantity}` : g.item.name]
    if (g.kind === 'custom') return [g.quantity > 1 ? `${g.name} x${g.quantity}` : g.name]
    if (g.kind === 'pick') return [`any ${g.label.toLowerCase()}`]
    return []
  })
  const gold = goldOf(gear)
  if (gold > 0) parts.push(goldLabel(gold))
  return parts.join(', ')
}

/** Whether the player has changed the stacks a source gave since they were taken. */
const isEdited = (stack: InventoryItem) =>
  stack.equipped === true || stack.attuned === true || stack.note !== undefined

interface PickSlotProps {
  pick: GearPick
  rows: Item[]
  catalog: ReadonlyMap<string, Item>
  edition: Item['edition']
  chosen: string | undefined
  open: boolean
  onOpen: (open: boolean) => void
  onChoose: (key: string | undefined) => void
}

/** One "any martial weapon": the items that fit, to choose one from. */
function PickSlot({
  pick,
  rows,
  catalog,
  edition,
  chosen,
  open,
  onOpen,
  onChoose,
}: PickSlotProps) {
  const fitting = useMemo(() => pickRows(pick, rows, edition), [rows, pick, edition])
  const rowMeta = useMemo(() => itemRowMeta(edition), [edition])
  return (
    <div className="mt-2">
      <PickOne<Item>
        tableId="starting-pick"
        rows={fitting}
        columns={itemColumns}
        idOf={itemKey}
        nameOf={itemName}
        tagsOf={itemTags}
        describe={describeItems}
        searchText={itemSearchText}
        rowMeta={rowMeta}
        picked={chosen ? catalog.get(chosen) : undefined}
        onPick={(item) => onChoose(item.key)}
        onClear={() => onChoose(undefined)}
        browsing={open}
        onBrowsingChange={onOpen}
        noun={pick.label.toLowerCase()}
        tableShare={70}
        labels={{
          compare: 'Compare items',
          search: 'Search items...',
          table: pick.label,
        }}
      />
    </div>
  )
}

interface SourceProps {
  which: Which
  /** What it is called: "Fighter (2024)". */
  title: string
  /** "Fighter|XPHB": what gives it. */
  source: string
  blocks: readonly unknown[] | undefined
  goldAlternative?: unknown
  /** What to say when the data lists nothing. */
  none: string
  catalog: readonly Item[]
  index: ReadonlyMap<string, Item>
  rows: Item[]
  edition: Item['edition']
  taken: StartingPick | undefined
  stacks: readonly InventoryItem[]
  rolls: StartingGoldRollRecord[]
}

/** The line a taken source folds to: what was taken, and what is still to choose. */
function takenText(choices: StartingChoices, pick: StartingPick, left: number): string {
  if (pick.option === SKIP_OPTION) return 'Starting equipment skipped'
  const what =
    pick.option === GOLD_OPTION
      ? `Starting gold taken: ${goldLabel(pick.gold)}`
      : choices.blocks.length === 1
        ? `Option ${pick.option} taken`
        : 'Starting equipment taken'
  return left > 0 ? `${what} - ${left === 1 ? '1 choice' : `${left} choices`} left` : what
}

function SourceCard({
  which,
  title,
  source,
  blocks,
  goldAlternative,
  none,
  catalog,
  index,
  rows,
  edition,
  taken,
  stacks,
  rolls,
}: SourceProps) {
  const update = useUpdateCharacter()
  const editEquipment = useEditEquipment()
  const choices = useMemo(
    () => startingChoices(source, blocks, catalog, goldAlternative),
    [source, blocks, catalog, goldAlternative],
  )
  const current = taken?.source === source ? taken : undefined
  const [changing, setChanging] = useState(false)
  const [selection, setSelection] = useState<StartingSelection>(() =>
    selectionOf(choices, current),
  )
  const [gold, setGold] = useState(current?.option === GOLD_OPTION)
  const [goldText, setGoldText] = useState(() =>
    current?.option === GOLD_OPTION && current.gold !== undefined
      ? String(current.gold / 100)
      : '',
  )
  const [openSlot, setOpenSlot] = useState<string>()

  const hasData = choices.blocks.length > 0
  const given = stacks.filter((s) => s.from === which)
  const mine = rolls.filter((r) => r.source === source)

  if (!hasData && !choices.goldRoll)
    return (
      <div className="border rounded p-3">
        <strong>{title}</strong>
        <div className="small text-body-secondary">{none}</div>
      </div>
    )

  if (current && !changing) {
    const left = unpickedSlots(choices, selectionOf(choices, current)).length
    return (
      <div className="border rounded px-3 py-2 d-flex flex-wrap align-items-center gap-2">
        <strong>{title}</strong>
        <span className="flex-grow-1">{takenText(choices, current, left)}</span>
        <Button size="sm" variant="primary" onClick={() => setChanging(true)}>
          {left > 0 ? 'Make choices' : 'Change'}
        </Button>
      </div>
    )
  }

  const replacing = given.length > 0 && (given.some(isEdited) || !current)
  const gear = selectedGear(choices, selection)
  const picks = gear.filter((g): g is GearPick => g.kind === 'pick')
  const left = unpickedSlots(choices, selection).length

  const asking = choices.blocks.filter((block) => block.options.length > 0)

  const choose = (blockIndex: number, key: string) =>
    setSelection((s) => ({ ...s, options: { ...s.options, [blockIndex]: key } }))
  const pickItem = (slot: string, key: string | undefined) =>
    setSelection((s) => {
      const next = { ...s.picks }
      if (key) next[slot] = key
      else delete next[slot]
      return { ...s, picks: next }
    })

  const roll = () => {
    if (!choices.goldRoll) return
    const { dice, sides, multiplier } = choices.goldRoll
    const values = rollDice(dice, sides)
    const total = values.reduce((sum, v) => sum + v, 0) * multiplier
    update(
      {},
      rollAction(
        newRoll({
          stream: 'startingGold',
          kind: 'starting-gold',
          source,
          values,
          multiplier,
          gold: total,
        }),
      ),
    )
    setGoldText(String(total))
  }

  const goldCopper = Math.round(Number(goldText) * 100)
  const goldReady =
    goldText.trim() !== '' && Number.isFinite(goldCopper) && goldCopper >= 0
  const take = () => {
    const chosen = gold ? { ...selection, gold: goldCopper } : selection
    editEquipment((equipment) => takeStarting(equipment, which, choices, chosen, catalog))
    setChanging(false)
  }
  const skip = () => {
    editEquipment((equipment) => skipStarting(equipment, which, source))
    setChanging(false)
  }
  const last = mine.at(-1)

  return (
    <div className="border rounded p-3">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <strong className="flex-grow-1">{title}</strong>
        {current && (
          <Button size="sm" variant="secondary" onClick={() => setChanging(false)}>
            Keep as taken
          </Button>
        )}
      </div>

      {choices.goldRoll && (
        <Form.Group className="mb-2" role="radiogroup" aria-label={`${title} kind`}>
          <Form.Check
            type="radio"
            inline
            id={`${which}-kit`}
            name={`${which}-kind`}
            label="Take the equipment"
            checked={!gold}
            onChange={() => setGold(false)}
          />
          <Form.Check
            type="radio"
            inline
            id={`${which}-gold`}
            name={`${which}-kind`}
            label="Take gold instead"
            checked={gold}
            onChange={() => setGold(true)}
          />
        </Form.Group>
      )}

      {gold && choices.goldRoll ? (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <Button size="sm" variant="primary" onClick={roll}>
            Roll {choices.goldRoll.dice}d{choices.goldRoll.sides}
            {choices.goldRoll.multiplier > 1 && ` x ${choices.goldRoll.multiplier}`}
          </Button>
          <Form.Label className="mb-0" htmlFor={`${which}-gold-total`}>
            Gold
          </Form.Label>
          <Form.Control
            id={`${which}-gold-total`}
            type="number"
            size="sm"
            min={0}
            style={{ width: 100 }}
            value={goldText}
            onChange={(e) => setGoldText(e.target.value)}
          />
          <span className="small text-body-secondary">
            {last
              ? `Rolled ${last.values.join(' + ')}${last.multiplier > 1 ? `, times ${last.multiplier}` : ''} = ${last.gold} gp. `
              : 'Roll it, or type the total of a roll made at the table. '}
            {mine.length > 1 && `${mine.length} rolls are in the history.`}
          </span>
        </div>
      ) : (
        choices.blocks.map((block) => (
          <fieldset key={block.index} className="mb-2">
            {asking.length > 1 && block.options.length > 0 && (
              <legend className="fs-6 small text-body-secondary mb-1">
                Choice {asking.indexOf(block) + 1} of {asking.length}
              </legend>
            )}
            {block.fixed.length > 0 && (
              <div className="small text-body-secondary mb-1">
                Also: <AbbrText text={gearText(block.fixed)} kind="currency" />
              </div>
            )}
            {block.options.map((option) => {
              const selected = selection.options[block.index] === option.key
              return (
                <div
                  key={option.key}
                  className={`border rounded px-2 py-1 mb-1${selected ? ' border-primary' : ''}`}
                >
                  <Form.Check
                    type="radio"
                    id={`${which}-${block.index}-${option.key}`}
                    name={`${which}-${block.index}`}
                    checked={selected}
                    onChange={() => choose(block.index, option.key)}
                    label={
                      <span>
                        {block.options.length > 1 && (
                          <strong className="me-1">{option.key.toUpperCase()}:</strong>
                        )}
                        {isGoldOnly(option) && 'Gold only: '}
                        <AbbrText text={gearText(option.gear)} kind="currency" />
                      </span>
                    }
                  />
                </div>
              )
            })}
          </fieldset>
        ))
      )}

      {!gold &&
        picks.map((pick) => (
          <div key={pick.slot}>
            <span className="small text-body-secondary">
              Choose a {pick.label.toLowerCase()}
            </span>
            <PickSlot
              pick={pick}
              rows={rows}
              catalog={index}
              edition={edition}
              chosen={selection.picks[pick.slot]}
              open={openSlot === pick.slot}
              onOpen={(open) => setOpenSlot(open ? pick.slot : undefined)}
              onChoose={(key) => pickItem(pick.slot, key)}
            />
          </div>
        ))}

      {replacing && (
        <div className="small text-body-secondary mt-2">
          {current
            ? `Taking this again replaces the ${given.length} items it gave before; their notes and marks start over.`
            : `Taking this replaces the ${given.length} items an earlier choice gave.`}
        </div>
      )}
      {!gold && left > 0 && (
        <div className="small text-body-secondary mt-2">
          {left === 1 ? '1 choice is' : `${left} choices are`} not made yet; take now and
          make {left === 1 ? 'it' : 'them'} later with Make choices.
        </div>
      )}

      <div className="d-flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="primary" disabled={gold && !goldReady} onClick={take}>
          {gold ? `Take ${goldReady ? goldLabel(goldCopper) : 'gold'}` : 'Take equipment'}
        </Button>
        {!current && (
          <Button size="sm" variant="secondary" onClick={skip}>
            Skip, I will add my own
          </Button>
        )}
      </div>
    </div>
  )
}

interface Props {
  catalog: readonly Item[]
  index: ReadonlyMap<string, Item>
  /** The items of the enabled books a pick can choose from. */
  rows: Item[]
  edition: Item['edition']
  /** The first class: later classes give no starting equipment. */
  firstClass: LoadedClass | undefined
  background: PlayableBackground | undefined
  taken: { class?: StartingPick; background?: StartingPick }
  stacks: readonly InventoryItem[]
  history: readonly HistoryEntry[]
}

export function StartingEquipment({
  catalog,
  index,
  rows,
  edition,
  firstClass,
  background,
  taken,
  stacks,
  history,
}: Props) {
  const rolls = useMemo(
    () =>
      rollRecords(history, 'startingGold').filter(
        (r): r is StartingGoldRollRecord => r.kind === 'starting-gold',
      ),
    [history],
  )
  if (!firstClass && !background)
    return (
      <div className="border rounded p-3 mb-3 text-body-secondary">
        Choose a class and a background to take their starting equipment.
      </div>
    )
  const entry = firstClass?.entry
  return (
    <div className="mb-3">
      <h3 className="h6">Starting equipment</h3>
      <div className="d-flex flex-column gap-2">
        {entry && (
          <SourceCard
            key={`class|${entry.name}|${entry.source}`}
            which="class"
            title={`${entry.name} (${editionYear(entry.edition)})`}
            source={`${entry.name}|${entry.source}`}
            blocks={entry.startingEquipment?.defaultData}
            goldAlternative={entry.startingEquipment?.goldAlternative}
            none="This class lists no starting equipment."
            catalog={catalog}
            index={index}
            rows={rows}
            edition={entry.edition ?? edition}
            taken={taken.class}
            stacks={stacks}
            rolls={rolls}
          />
        )}
        {background && (
          <SourceCard
            key={`background|${background.key}`}
            which="background"
            title={`${background.name} (${editionYear(background.edition)})`}
            source={background.key}
            blocks={background.startingEquipment}
            none={
              equipmentText(background) || 'This background lists no starting equipment.'
            }
            catalog={catalog}
            index={index}
            rows={rows}
            edition={background.edition ?? edition}
            taken={taken.background}
            stacks={stacks}
            rolls={rolls}
          />
        )}
      </div>
    </div>
  )
}
