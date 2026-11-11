// The spells a species, background, feat or class option gives (what is not a class
// pick). Each source is one block: the spells it gives for certain as a short table
// that says how each is cast, and what it lets the player choose - "1 Cleric
// cantrip" - as a chooser over the same table of spells, held to what the grant
// allows. A source with named sets (a Tiefling legacy, a Magic Initiate list) asks
// which first; one with a choice of spellcasting ability asks that too.

import Form from 'react-bootstrap/Form'
import { ABILITY_NAMES } from '../../dice/dice'
import { matchesFilter, spellKindText } from '../../data/grants'
import type { Spell } from '../../data/spells'
import type { GrantedSpellChoice, SpellGrantChoices } from '../../character/model'
import {
  grantedSpell,
  type SpellGrant,
  type SpellVariantSet,
} from '../../character/spellGrants'
import { refKey, refOf, without, withRef } from '../../character/spellRefs'
import { editionYear } from '../../data/labels'
import { MODE_CAST, pickTierId } from './grantedCast'
import { SpellLines, type SpellLine } from './SpellLines'
import { SpellPicker } from './SpellPicker'

const unlocks = (grant: SpellGrant) => `Unlocks at level ${grant.gate}`

interface Props {
  grants: SpellGrant[]
  variants: SpellVariantSet[]
  choices: SpellGrantChoices
  byName: Map<string, Spell[]>
  byKey: Map<string, Spell>
  /** Every spell of the selected books: what a choice is made among. */
  rows: Spell[]
  /** Spells with a namesake of the other edition, to say which version a row is. */
  twins: Set<string>
  open: string | null
  onBrowsingChange: (tierId: string, browsing: boolean) => void
  allowNonStandard: boolean
  onAllowNonStandardChange: (allow: boolean) => void
  editChoice: (
    id: string,
    change: (choice: GrantedSpellChoice) => GrantedSpellChoice,
  ) => void
}

interface Block {
  sourceId: string
  from: string
  variants?: SpellVariantSet
  grants: SpellGrant[]
}

/** The blocks, in the order the sources come: each source once. */
function blocksOf(grants: SpellGrant[], variants: SpellVariantSet[]): Block[] {
  const blocks = new Map<string, Block>()
  const block = (sourceId: string, from: string) => {
    let found = blocks.get(sourceId)
    if (!found) {
      found = { sourceId, from, grants: [] }
      blocks.set(sourceId, found)
    }
    return found
  }
  for (const set of variants)
    block(set.id.replace(/:variant$/, ''), set.from).variants = set
  for (const grant of grants) block(grant.sourceId, grant.from).grants.push(grant)
  return [...blocks.values()]
}

/** One note or choice per ability, however many spells share it. */
const abilityKey = (grant: SpellGrant) =>
  grant.abilityId ??
  (grant.ability?.kind === 'fixed' ? `fixed:${grant.ability.key}` : 'inherit')

const EMPTY: GrantedSpellChoice = { picks: [] }

export function GrantedSpells({
  grants,
  variants,
  choices,
  byName,
  byKey,
  rows,
  twins,
  open,
  onBrowsingChange,
  allowNonStandard,
  onAllowNonStandardChange,
  editChoice,
}: Props) {
  const blocks = blocksOf(grants, variants)
  if (blocks.length === 0) return null

  return (
    <section
      className="border rounded p-3 mb-3"
      aria-label="Spells from your species, background, feats and class options"
    >
      <h3 className="h6 mb-3">
        Spells from your species, background, feats and class options
      </h3>
      {blocks.map((block) => {
        const fixed = block.grants.flatMap((grant): SpellLine[] => {
          const spell = grantedSpell(grant, byName)
          return grant.spell && spell
            ? [
                {
                  id: grant.id,
                  spell,
                  from: [grant.from],
                  cast: grant.uses || MODE_CAST[grant.mode],
                  locked: grant.locked ? unlocks(grant) : undefined,
                },
              ]
            : []
        })
        const picks = block.grants.filter((grant) => grant.pick)
        const abilities = new Map(
          block.grants.flatMap((g) => (g.ability ? [[abilityKey(g), g] as const] : [])),
        )
        return (
          <div key={block.sourceId} className="mb-3">
            <div className="fw-semibold mb-1">{block.from}</div>
            {block.variants && (
              <Form.Group className="mb-2">
                <Form.Label className="small me-2 mb-0">
                  Take one set of spells:
                </Form.Label>
                {block.variants.names.map((name) => (
                  <Form.Check
                    inline
                    type="radio"
                    key={name}
                    id={`${block.variants?.id}-${name}`}
                    name={block.variants?.id}
                    label={name}
                    checked={block.variants?.selected === name}
                    onChange={() =>
                      block.variants &&
                      editChoice(block.variants.id, (c) => ({ ...c, variant: name }))
                    }
                  />
                ))}
              </Form.Group>
            )}
            {[...abilities.entries()].map(([id, grant]) => (
              <AbilityChoice
                key={id}
                id={id}
                grant={grant}
                chosen={choices[id]?.ability}
                onChoose={(key) => editChoice(id, (c) => ({ ...c, ability: key }))}
              />
            ))}
            {fixed.length > 0 && (
              <div className="mb-2">
                <SpellLines
                  tableId="spell-granted"
                  lines={fixed}
                  twins={twins}
                  label={`${block.from} spells`}
                />
              </div>
            )}
            {picks.map((grant) => (
              <PickBlock
                key={grant.id}
                grant={grant}
                picked={(choices[grant.id] ?? EMPTY).picks.flatMap(
                  (r) => byKey.get(refKey(r)) ?? [],
                )}
                rows={rows}
                twins={twins}
                open={open === pickTierId(grant)}
                onBrowsingChange={(browsing) =>
                  onBrowsingChange(pickTierId(grant), browsing)
                }
                allowNonStandard={allowNonStandard}
                onAllowNonStandardChange={onAllowNonStandardChange}
                edit={(change) => editChoice(grant.id, change)}
              />
            ))}
          </div>
        )
      })}
    </section>
  )
}

function AbilityChoice({
  id,
  grant,
  chosen,
  onChoose,
}: {
  id: string
  grant: SpellGrant
  chosen: string | undefined
  onChoose: (key: GrantedSpellChoice['ability']) => void
}) {
  const { ability } = grant
  if (!ability) return null
  if (ability.kind === 'inherit')
    return (
      <div className="small text-body-secondary mb-2">
        Spellcasting ability: the one of your class.
      </div>
    )
  if (ability.kind === 'fixed')
    return (
      <div className="small text-body-secondary mb-2">
        Spellcasting ability: {ABILITY_NAMES[ability.key]}.
      </div>
    )
  return (
    <Form.Group className="mb-2">
      <Form.Label className="small me-2 mb-0">Spellcasting ability:</Form.Label>
      {ability.keys.map((key) => (
        <Form.Check
          inline
          type="radio"
          key={key}
          id={`${id}-${key}`}
          name={id}
          label={ABILITY_NAMES[key]}
          checked={chosen === key}
          onChange={() => onChoose(key)}
        />
      ))}
    </Form.Group>
  )
}

function PickBlock({
  grant,
  picked,
  rows,
  twins,
  open,
  onBrowsingChange,
  allowNonStandard,
  onAllowNonStandardChange,
  edit,
}: {
  grant: SpellGrant
  picked: Spell[]
  rows: Spell[]
  twins: Set<string>
  open: boolean
  onBrowsingChange: (browsing: boolean) => void
  allowNonStandard: boolean
  onAllowNonStandardChange: (allow: boolean) => void
  edit: (change: (choice: GrantedSpellChoice) => GrantedSpellChoice) => void
}) {
  const { pick } = grant
  if (!pick) return null
  const noun = spellKindText(pick.filter, pick.count)
  if (grant.locked)
    return (
      <div className="small text-body-secondary mb-2">
        {unlocks(grant)}: {pick.count} {noun}.
      </div>
    )
  const [first] = pick.filter.levels
  const cantrips = pick.filter.levels.length === 1 && first === 0
  const single = spellKindText(pick.filter, 1)
  const pickedKeys = new Set(picked.map((s) => s.key))
  const full = picked.length >= pick.count
  const allowed = (spell: Spell) =>
    matchesFilter(spell, pick.filter, grant.edition)
      ? []
      : [
          `Not on this list (${single})${
            twins.has(spell.key) ? `; ${editionYear(spell.edition)} version` : ''
          }`,
        ]
  const meta = (problems: string[]) => ({
    standard: problems.length === 0,
    reason: problems.length > 0 ? problems.join('; ') : undefined,
  })
  return (
    <div className="mb-2">
      <SpellPicker
        twins={twins}
        rows={rows}
        picked={picked}
        noun={noun}
        limit={{ max: pick.count, reason: `More than the ${pick.count} this gives` }}
        cantrips={cantrips}
        rowMeta={(spell) =>
          meta([
            ...allowed(spell),
            ...(full && !pickedKeys.has(spell.key)
              ? [`All ${pick.count} ${noun} chosen`]
              : []),
          ])
        }
        pickedRowMeta={(spell) => meta(allowed(spell))}
        onAdd={(spell) => edit((c) => ({ ...c, picks: withRef(c.picks, refOf(spell)) }))}
        onRemove={(spell) => edit((c) => ({ ...c, picks: without(c.picks, spell.key) }))}
        open={open}
        onBrowsingChange={onBrowsingChange}
        allowNonStandard={allowNonStandard}
        onAllowNonStandardChange={onAllowNonStandardChange}
        label={`${grant.from} ${noun}`}
      />
    </div>
  )
}
