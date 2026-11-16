// Taking one option of a race's trait (Custom Lineage's Variable Trait: darkvision or a
// skill; a kobold's legacy): every option a row with what it says, side by side to
// compare. Once one is taken it shrinks to a summary with Change.

import type { RaceTraitChoice, RaceTraitOption } from '../../data/race'
import { Entries, type Entry } from '../../text/Entries'
import { stripTags } from '../../text/tags'
import { PickOne } from '../table/PickOne'
import type { Describe, Fact } from '../table/facts'
import type { Column } from '../table/types'

interface Props {
  choice: RaceTraitChoice
  /** The option the character took. */
  taken: string | undefined
  onTake: (name: string | undefined) => void
}

/** The option's text as plain words, for search, sorting and comparing. */
const plain = (entries: Entry[]): string =>
  entries.flatMap((e) => (typeof e === 'string' ? [stripTags(e)] : [])).join(' ')

const textFact: Fact<RaceTraitOption> = {
  key: 'text',
  label: 'What it gives',
  text: (o) => plain(o.text),
  render: (o) => <Entries entries={o.text} />,
}

const describe: Describe<RaceTraitOption> = () => [
  { key: 'option', title: 'The option', facts: [textFact] },
]

const columns: Column<RaceTraitOption>[] = [
  {
    key: 'name',
    header: 'Option',
    render: (o) => <strong>{o.name}</strong>,
    sortValue: (o) => o.name,
    filterable: false,
  },
  {
    key: 'text',
    header: 'What it gives',
    render: (o) => plain(o.text),
    sortValue: (o) => plain(o.text),
    filterable: false,
  },
]

export function RaceTraitChooser({ choice, taken, onTake }: Props) {
  const picked = choice.options.find((o) => o.name === taken)
  return (
    <PickOne<RaceTraitOption>
      tableId="race-trait"
      rows={choice.options}
      columns={columns}
      idOf={(o) => o.name}
      nameOf={(o) => o.name}
      describe={describe}
      searchText={(o) => `${o.name} ${plain(o.text)}`}
      picked={picked}
      onPick={(o) => onTake(o.name)}
      onClear={() => onTake(undefined)}
      noun="option"
      summary={[textFact]}
      labels={{
        compare: `Compare ${choice.title} options`,
        search: 'Search options…',
        table: `${choice.title} options`,
      }}
    />
  )
}
