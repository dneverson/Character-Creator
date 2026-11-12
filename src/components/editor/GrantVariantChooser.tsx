// Taking one named set of spells a source offers (a Circle of the Land terrain, a
// Tiefling legacy, a Magic Initiate list): every set a row with the spells it gives
// by the level they arrive at, side by side to compare, and each spell opening its
// full detail as spells do elsewhere. A level the character has not reached reads
// "at level N". Once a set is taken it shrinks to a summary with Change.

import { useMemo } from 'react'
import type { GrantedSpellChoice } from '../../character/model'
import {
  grantedSpell,
  type SpellGrant,
  type SpellVariantSet,
} from '../../character/spellGrants'
import { spellKindText } from '../../data/grants'
import type { Spell } from '../../data/spells'
import { PickOne } from '../table/PickOne'
import type { Describe, Fact } from '../table/facts'
import type { Column } from '../table/types'
import { MODE_CAST } from './grantedCast'
import { SpellLines, type SpellLine } from './SpellLines'

interface Option {
  name: string
  /** The spells it gives (a named spell each), in the order of the data. */
  grants: SpellGrant[]
  /** What it lets the player choose besides. */
  choices: SpellGrant[]
}

interface Props {
  set: SpellVariantSet
  byName: Map<string, Spell[]>
  twins: Set<string>
  editChoice: (
    id: string,
    change: (choice: GrantedSpellChoice) => GrantedSpellChoice,
  ) => void
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** The label of the level a spell arrives at, "At level 5" when not reached. */
const gateLabel = (gate: number, locked: boolean) =>
  gate === 0 ? 'From the start' : `${locked ? 'At level' : 'Level'} ${gate}`

const nameOf = (grant: SpellGrant, byName: Map<string, Spell[]>) =>
  grantedSpell(grant, byName)?.name ?? capitalize(grant.spell?.name ?? '')

/** "Level 3: Hold Person, Spike Growth; At level 5: Sleet Storm, Slow". */
function spellsText(option: Option, byName: Map<string, Spell[]>): string {
  const gates = [...new Set(option.grants.map((g) => g.gate))].sort((a, b) => a - b)
  return gates
    .map((gate) => {
      const here = option.grants.filter((g) => g.gate === gate)
      return `${gateLabel(
        gate,
        here.some((g) => g.locked),
      )}: ${here.map((g) => nameOf(g, byName)).join(', ')}`
    })
    .join('; ')
}

const choicesText = (option: Option) =>
  option.choices
    .flatMap(({ pick }) =>
      pick ? [`${pick.count} ${spellKindText(pick.filter, pick.count)}`] : [],
    )
    .join(', ')

export function GrantVariantChooser({ set, byName, twins, editChoice }: Props) {
  const options = useMemo(
    () =>
      set.options.map(({ name, grants }): Option => ({
        name,
        grants: grants.filter((g) => g.spell),
        choices: grants.filter((g) => g.pick),
      })),
    [set.options],
  )

  const describe = useMemo<Describe<Option>>(
    () => (entries) => {
      const gates = [
        ...new Map(
          entries
            .flatMap((e) => e.grants)
            .map((g) => [g.gate, g.locked] as const)
            .sort((a, b) => a[0] - b[0]),
        ),
      ]
      const gateFacts = gates.map(([gate, locked]): Fact<Option> => ({
        key: `gate-${gate}`,
        label: gateLabel(gate, locked),
        text: (o) =>
          o.grants
            .filter((g) => g.gate === gate)
            .map((g) => nameOf(g, byName))
            .join(', '),
      }))
      return [
        { key: 'spells', title: 'Spells it gives', facts: gateFacts },
        {
          key: 'choices',
          title: 'You also choose',
          facts: [{ key: 'choices', label: 'Choices', text: choicesText }],
        },
      ]
    },
    [byName],
  )

  const columns = useMemo<Column<Option>[]>(
    () => [
      {
        key: 'name',
        header: 'Set',
        render: (o) => <strong>{o.name}</strong>,
        sortValue: (o) => o.name,
        filterable: false,
      },
      {
        key: 'spells',
        header: 'Spells',
        render: (o) => spellsText(o, byName),
        sortValue: (o) => spellsText(o, byName),
        filterValue: (o) => o.grants.map((g) => nameOf(g, byName)),
      },
      {
        key: 'choices',
        header: 'Also choose',
        render: (o) => choicesText(o),
        sortValue: choicesText,
        filterable: false,
      },
    ],
    [byName],
  )

  const lines = (option: Option): SpellLine[] =>
    option.grants.flatMap((grant): SpellLine[] => {
      const spell = grantedSpell(grant, byName)
      return spell
        ? [
            {
              id: grant.id,
              spell,
              from: [grant.from],
              cast: grant.uses || MODE_CAST[grant.mode],
              locked: grant.locked ? `at level ${grant.gate}` : undefined,
            },
          ]
        : []
    })

  const picked = options.find((o) => o.name === set.selected)

  return (
    <PickOne<Option>
      tableId={`grant-variant-${set.id}`}
      rows={options}
      columns={columns}
      idOf={(o) => o.name}
      nameOf={(o) => o.name}
      describe={describe}
      searchText={(o) => `${o.name} ${spellsText(o, byName)}`}
      detailFooter={(o) => (
        <div className="px-3 pb-3">
          <SpellLines
            tableId="spell-variant"
            lines={lines(o)}
            twins={twins}
            label={`${o.name} spells`}
          />
        </div>
      )}
      picked={picked}
      onPick={(o) => editChoice(set.id, (c) => ({ ...c, variant: o.name }))}
      onClear={() => editChoice(set.id, (c) => ({ ...c, variant: undefined }))}
      noun="set of spells"
      summary={[
        {
          key: 'spells',
          label: 'Spells',
          text: (o) => spellsText(o, byName),
        },
      ]}
      labels={{
        compare: `Compare ${set.from} spell sets`,
        search: 'Search sets or spells…',
        table: `${set.from} spell sets`,
      }}
    />
  )
}
