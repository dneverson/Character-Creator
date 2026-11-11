// Feats & Ability Score Improvements: every slot the character has, each its own
// chooser over the same table of feats. A slot's table greys the feats that do not
// fit it (a prerequisite not met, the wrong category, already taken in another
// slot) rather than hiding them, and the Ability Score Improvement is one more row
// on the slots that take it. One table is open at a time: the first slot with
// nothing chosen, then the next as each is filled. A chosen slot folds to a card
// with the choices that feat still asks for.

import { useId, useMemo, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Spinner from 'react-bootstrap/Spinner'
import { ASI_FEAT_KEY, ASI_OPTIONS, featCategoryLabel, type Feat } from '../../data/feats'
import { BONUS_SLOT_PREFIX, type FeatChoice } from '../../character/model'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import type { FeatFlag, ResolvedFeatSlot, TakenFeat } from '../../character/feats'
import { featRuleFlags } from '../../character/feats'
import { NonStandardBadge } from '../NonStandardBadge'
import { PickOne } from '../table/PickOne'
import { AbilityOptionPicker } from './AbilityOptionPicker'
import { EditorSection } from './EditorSection'
import { NotInBooksAlert } from './NotInBooksAlert'
import { useFeatSummary } from './useFeatSummary'
import {
  describeFeats,
  featColumns,
  featKey,
  featName,
  featSearchText,
  featSummary,
  featTags,
} from './featFacts'

/** Flags that mark a pick as off-standard (rules problems, flagged not blocked). */
const NON_STANDARD: FeatFlag['kind'][] = ['prerequisite', 'cap', 'repeat', 'category']

const refOf = (f: Feat) => ({ name: f.name, source: f.source })

/**
 * The Ability Score Improvement as a row of the table: the book's feat, taking its
 * increases the way the improvement does. A row of the same name stands in when the
 * data has no such feat.
 */
function asiRowOf(feats: Feat[]): Feat {
  const found = feats.find((f) => f.key === ASI_FEAT_KEY)
  return {
    key: ASI_FEAT_KEY,
    name: 'Ability Score Improvement',
    label: 'Ability Score Improvement',
    baseName: 'Ability Score Improvement',
    source: 'XPHB',
    edition: 'one',
    category: 'G',
    prerequisites: [],
    repeatable: true,
    skills: { fixed: [], choices: [] },
    hp: { perLevel: 0, flat: 0 },
    entries: ['Increase one ability score by 2, or two ability scores by 1 each.'],
    ...found,
    abilityOptions: ASI_OPTIONS,
  }
}

/** Whether a slot has nothing to show for itself yet. */
const isEmpty = (r: ResolvedFeatSlot) => r.kind !== 'asi' && !r.feat

export function FeatsSection() {
  const character = useActiveCharacter()
  const updateActive = useCharacterStore((s) => s.updateActive)
  const { feats, summary, loading, error } = useFeatSummary()
  // The slot whose table is open; unset until the player opens or shuts one, when
  // it is the first slot with nothing chosen. `null` is every table shut.
  const [opened, setOpened] = useState<string | null | undefined>(undefined)
  const [allowNonStandard, setAllowNonStandard] = useState(false)

  const selectedBooks = character?.selectedBooks
  const bookFeats = useMemo(() => {
    const books = new Set(selectedBooks ?? [])
    return feats.filter((f) => books.has(f.source) && f.key !== ASI_FEAT_KEY)
  }, [feats, selectedBooks])
  const asiRow = useMemo(() => asiRowOf(feats), [feats])

  if (!character) return null
  const state = character.feats
  const emptyOtherThan = (id: string) =>
    summary.slots.find((r) => r.slot.id !== id && isEmpty(r))?.slot.id ?? null
  const open =
    opened === undefined ? (summary.slots.find(isEmpty)?.slot.id ?? null) : opened

  function setChoice(slotId: string, choice: FeatChoice | undefined) {
    const choices = { ...state.choices }
    if (choice) choices[slotId] = choice
    else delete choices[slotId]
    updateActive({ feats: { ...state, choices } })
    // The table of the next slot with nothing chosen takes over.
    if (choice) setOpened(emptyOtherThan(slotId))
  }

  function addBonusSlot() {
    const id = `${BONUS_SLOT_PREFIX}${crypto.randomUUID()}`
    updateActive({ feats: { ...state, bonusSlots: [...state.bonusSlots, id] } })
    setOpened(id)
  }

  function removeBonusSlot(id: string) {
    const choices = { ...state.choices }
    delete choices[id]
    updateActive({
      feats: { choices, bonusSlots: state.bonusSlots.filter((s) => s !== id) },
    })
    if (open === id) setOpened(null)
  }

  return (
    <EditorSection
      title="Feats & Ability Score Improvements"
      subtitle="Each slot your race, background, and class levels grant, in the order you gain them. Every feat from your books is listed; the ones that do not fit a slot are greyed with the reason. Rules problems are flagged, not blocked."
    >
      {loading && (
        <div className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading feats…
        </div>
      )}
      {error && <Alert variant="danger">Failed to load feats: {error.message}</Alert>}

      {!loading && !error && (
        <>
          {summary.slots.length === 0 && (
            <p className="text-body-secondary">
              No feat slots yet. Your race, background, and class levels add them as you
              choose them.
            </p>
          )}
          {summary.slots.map((resolved) => (
            <SlotCard
              key={resolved.slot.id}
              resolved={resolved}
              others={summary.slots.flatMap((r) =>
                r.slot.id !== resolved.slot.id && r.feat
                  ? [{ feat: r.feat, slotLabel: r.slot.label }]
                  : [],
              )}
              allFeats={feats}
              bookFeats={bookFeats}
              asiRow={asiRow}
              selectedBooks={selectedBooks ?? []}
              browsing={open === resolved.slot.id}
              onBrowsingChange={(browsing) =>
                setOpened(browsing ? resolved.slot.id : null)
              }
              allowNonStandard={allowNonStandard}
              onAllowNonStandardChange={setAllowNonStandard}
              onChange={(choice) => setChoice(resolved.slot.id, choice)}
              onRemove={
                resolved.slot.origin === 'bonus'
                  ? () => removeBonusSlot(resolved.slot.id)
                  : undefined
              }
            />
          ))}
          <div className="d-flex align-items-center gap-2">
            <Button size="sm" variant="secondary" onClick={addBonusSlot}>
              Add bonus feat
            </Button>
            <span className="small text-body-secondary">
              For a feat from a DM reward, a magic item, or any source outside these
              rules.
            </span>
          </div>
        </>
      )}
    </EditorSection>
  )
}

interface SlotCardProps {
  resolved: ResolvedFeatSlot
  /** The feats every other slot has, to grey a repeat of one. */
  others: TakenFeat[]
  /** Every loaded feat, for the feats a slot names and saved picks. */
  allFeats: Feat[]
  /** Feats from the selected books. */
  bookFeats: Feat[]
  asiRow: Feat
  selectedBooks: string[]
  browsing: boolean
  onBrowsingChange: (browsing: boolean) => void
  allowNonStandard: boolean
  onAllowNonStandardChange: (allow: boolean) => void
  onChange: (choice: FeatChoice | undefined) => void
  onRemove?: () => void
}

/** What a slot takes, for its heading. */
function slotTakes(resolved: ResolvedFeatSlot, allFeats: Feat[]): string {
  const { slot, auto } = resolved
  if (slot.categories === 'any')
    return slot.allowsAsi ? 'any feat or an Ability Score Improvement' : 'any feat'
  if (slot.categories.length === 0) {
    const names = slot.named.map(
      (key) => allFeats.find((f) => f.key === key)?.label ?? key,
    )
    return auto ? `${names.join(' or ')} (granted)` : names.join(' or ')
  }
  return `${slot.categories.map(featCategoryLabel).join(' or ')} feat`
}

function SlotCard({
  resolved,
  others,
  allFeats,
  bookFeats,
  asiRow,
  selectedBooks,
  browsing,
  onBrowsingChange,
  allowNonStandard,
  onAllowNonStandardChange,
  onChange,
  onRemove,
}: SlotCardProps) {
  const { slot, kind, feat, auto, flags, context } = resolved
  const abilityId = useId()
  // The choice to build on when editing. An automatically granted feat has no
  // saved record yet, so edits start from the feat it grants.
  const base: FeatChoice | undefined =
    resolved.choice ?? (feat ? { kind: 'feat', feat: refOf(feat) } : undefined)
  const picked = kind === 'asi' ? asiRow : feat

  const rows = useMemo(() => {
    const listed = new Set(bookFeats.map((f) => f.key))
    const named = allFeats.filter((f) => slot.named.includes(f.key) && !listed.has(f.key))
    return [...(slot.allowsAsi ? [asiRow] : []), ...named, ...bookFeats]
  }, [slot.allowsAsi, slot.named, asiRow, allFeats, bookFeats])

  // Whether each feat fits this slot, and why not: the one set of rules the slot's
  // own flags use, asked of every row. Worked out only while the table is open.
  const metas = useMemo(() => {
    const found = new Map<string, { standard: boolean; reason?: string }>()
    if (!browsing) return found
    for (const row of rows) {
      const problems =
        row.key === asiRow.key
          ? []
          : featRuleFlags(row, slot, context, others).filter((f) =>
              NON_STANDARD.includes(f.kind),
            )
      found.set(row.key, {
        standard: problems.length === 0,
        reason:
          problems.length > 0
            ? problems
                .map((f) =>
                  f.kind === 'repeat' && !row.repeatable
                    ? `Already taken: ${f.takenIn}`
                    : f.message,
                )
                .join('; ')
            : undefined,
      })
    }
    return found
  }, [browsing, rows, asiRow, slot, context, others])

  const pick = (row: Feat) =>
    onChange(
      row.key === asiRow.key
        ? { kind: 'asi', abilityOption: 0, abilityChoices: {} }
        : { kind: 'feat', feat: refOf(row), abilityOption: 0, abilityChoices: {} },
    )

  // A slot with nothing chosen already says so ("No feat chosen yet").
  const shownFlags = picked ? flags : flags.filter((f) => f.kind !== 'incomplete')
  const inBooks = !picked || selectedBooks.includes(picked.source)

  return (
    <section className="mb-4" aria-label={slot.label}>
      <div className="d-flex align-items-center gap-2 mb-2">
        <h3 className="h6 mb-0 flex-grow-1">
          <span>{slot.label}</span>
          <span className="fw-normal text-body-secondary">
            : {slotTakes(resolved, allFeats)}
          </span>
        </h3>
        {onRemove && (
          <Button size="sm" variant="danger" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>

      {picked && !inBooks && kind === 'feat' && !auto && (
        <NotInBooksAlert
          noun="feat"
          name={picked.label}
          source={picked.source}
          onRemove={() => onChange(undefined)}
        />
      )}

      <PickOne<Feat>
        tableId="feat-reference"
        rows={rows}
        columns={featColumns}
        idOf={featKey}
        nameOf={featName}
        tagsOf={featTags}
        describe={describeFeats}
        searchText={featSearchText}
        rowMeta={(row) => metas.get(row.key) ?? { standard: true }}
        allowNonStandard={allowNonStandard}
        onAllowNonStandardChange={onAllowNonStandardChange}
        picked={picked}
        onPick={pick}
        onClear={() => onChange(undefined)}
        noun="feat"
        summary={featSummary}
        tableShare={70}
        browsing={browsing}
        onBrowsingChange={onBrowsingChange}
        labels={{
          compare: 'Compare feats',
          search: 'Search feats, prerequisites and text…',
          table: `Feats for ${slot.label}`,
        }}
      >
        {auto && picked && (
          <div className="small text-body-secondary mt-2">
            Granted automatically by {slot.origin === 'background' ? 'the ' : ''}
            {slot.label.split(' - ')[0]}.
          </div>
        )}
        {picked && base && picked.abilityOptions.length > 0 && (
          <div className="mt-3">
            <h4 className="h6">Ability score increase</h4>
            <AbilityOptionPicker
              id={abilityId}
              options={picked.abilityOptions}
              optionIndex={base.abilityOption ?? 0}
              choices={base.abilityChoices ?? {}}
              onOption={(abilityOption) =>
                onChange({ ...base, abilityOption, abilityChoices: {} })
              }
              onChoices={(abilityChoices) => onChange({ ...base, abilityChoices })}
            />
          </div>
        )}
      </PickOne>

      {shownFlags.length > 0 && (
        <div className="d-flex flex-column gap-1 mt-2">
          {shownFlags.map((flag, i) => (
            <FlagLine key={i} flag={flag} />
          ))}
        </div>
      )}
    </section>
  )
}

/** One flag on a slot: off-standard picks get the Non-standard badge. */
function FlagLine({ flag }: { flag: FeatFlag }) {
  if (NON_STANDARD.includes(flag.kind)) {
    return (
      <div className="d-flex align-items-center gap-2 small">
        <NonStandardBadge reason={flag.message} />
        <span>{flag.message}</span>
      </div>
    )
  }
  const tone = flag.kind === 'missing' ? 'text-danger' : 'text-body-secondary'
  return <div className={`small ${tone}`}>{flag.message}</div>
}
