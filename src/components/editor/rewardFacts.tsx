// How a reward is described: its kind, its book and what it does, for the table of the
// supernatural gifts a DM grants (blessings, charms, boons).

import { spellGrants } from '../../data/grants'
import { plainText } from '../../data/itemRead'
import type { Reward } from '../../data/rewards'
import { Entries } from '../../text/Entries'
import { factColumn, perEntry, type Describe, type Fact } from '../table/facts'
import type { Column } from '../table/types'
import { editionFact, grantFact, sourceFact } from './grantFacts'

export const rewardKey = (reward: Pick<Reward, 'key'>) => reward.key
export const rewardName = (reward: Reward) => reward.name

const kind: Fact<Reward> = { key: 'type', label: 'Kind', text: (r) => r.type }

const spells = grantFact<Reward>('spells', 'Spells', (r) =>
  spellGrants(r.additionalSpells),
)

/** What it does, in a line: the table's column, so rewards compare without opening one. */
const effect: Fact<Reward> = {
  key: 'effect',
  label: 'What it does',
  text: perEntry((r: Reward) => plainText(r.entries)),
}

const description: Fact<Reward> = {
  key: 'description',
  role: 'body',
  label: 'Description',
  text: (r) => (r.entries.length > 0 ? JSON.stringify(r.entries) : ''),
  render: (r) => <Entries entries={r.entries} />,
}

export const describeRewards: Describe<Reward> = () => [
  { key: 'basics', title: 'Basics', facts: [kind, spells, sourceFact, editionFact] },
  { key: 'text', title: 'Text', facts: [description] },
]

export const rewardColumns: Column<Reward>[] = [
  {
    key: 'name',
    header: 'Reward',
    render: (r) => <strong>{r.name}</strong>,
    sortValue: rewardName,
    filterable: false,
  },
  factColumn(kind),
  factColumn(effect, {
    render: (r) => <span className="small">{effect.text(r)}</span>,
    filterable: false,
  }),
  factColumn(spells, { filterable: false, defaultHidden: true }),
  factColumn(sourceFact),
  factColumn(editionFact),
]

/** The short table of the rewards the character has. */
export const rewardSummaryColumns: Column<Reward>[] = rewardColumns.filter((c) =>
  ['name', 'type', 'effect'].includes(c.key),
)

export const rewardSearchText = perEntry((r: Reward) =>
  [r.name, r.type, r.source, plainText(r.entries)].join(' '),
)
