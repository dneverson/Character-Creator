// The multiclass prerequisite flag against the Ability Scores table, on the free rules
// the site hosts: for a Druid and a Bard of either edition, in either order, the flag
// is raised exactly when the Charisma the second class was taken with is short of 13
// or not assigned. That is the Charisma the table shows, less any increase gained
// after it, such as a level 4 Ability Score Improvement.

import { readFileSync } from 'node:fs'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { AbilityScores } from './AbilityScores'
import { useClassBuild } from './useClassBuild'
import { useDerivedSheet } from './useDerivedSheet'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter, type Character, type ClassRef } from '../../character/model'
import { fetchData } from '../../data/dataClient'

vi.mock('../../data/dataClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/dataClient')>()),
  fetchData: vi.fn(),
}))

/** Everything the flag and the sheet read, side by side with the table. */
function Probe() {
  const build = useClassBuild()
  const { sheet } = useDerivedSheet()
  return (
    <div>
      <div data-testid="loading">{String(build.loading || !sheet)}</div>
      <div data-testid="sheet-cha">{sheet?.totals.cha}</div>
      <ul>
        {[...build.deviationByKey].map(([key, d]) => (
          <li key={key} data-testid={key}>
            {d.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface Way {
  label: string
  /** The Charisma the table shows, or null when it is not assigned. */
  cha: number | null
  /** The scores at character level 2, when the second class is taken, where they differ. */
  atEntry?: { cha: number; wis: number }
  build: (c: Character) => void
}

const ARRAY = [15, 14, 13, 12, 10, 8]

/** Each way a character reaches its Charisma (Wisdom always meets the Druid's 13). */
const WAYS: Way[] = [
  {
    label: 'array base 13',
    cha: 13,
    build: (c) => {
      c.statMethod = 'array'
      c.statPool = [...ARRAY]
      c.abilities.cha.base = 13
      c.abilities.wis.base = 14
    },
  },
  {
    label: 'point buy 12 and a race +2',
    cha: 14,
    build: (c) => {
      c.statMethod = 'pointbuy'
      c.abilities.cha.base = 12
      c.abilities.wis.base = 13
      c.race = {
        name: 'Half-Elf',
        baseName: 'Half-Elf',
        source: 'PHB',
        abilityFixed: { cha: 2 },
        abilityChoices: { wis: 1 },
      }
    },
  },
  {
    label: 'point buy 11 and a 2024 background +2',
    cha: 13,
    build: (c) => {
      c.statMethod = 'pointbuy'
      c.abilities.cha.base = 11
      c.abilities.wis.base = 13
      c.background = {
        name: 'Entertainer',
        source: 'XPHB',
        abilityOption: 0,
        abilityChoices: { cha: 2, wis: 1 },
      }
    },
  },
  {
    label: 'point buy 12 and Other +1',
    cha: 13,
    build: (c) => {
      c.statMethod = 'pointbuy'
      c.abilities.cha.base = 12
      c.abilities.cha.other = 1
      c.abilities.wis.base = 13
    },
  },
  {
    label: 'point buy 12 and the Druid level 4 Ability Score Improvement',
    cha: 13,
    atEntry: { cha: 12, wis: 12 },
    build: (c) => {
      c.statMethod = 'pointbuy'
      c.abilities.cha.base = 12
      c.abilities.wis.base = 12
      for (const source of ['PHB', 'XPHB']) {
        c.feats.choices[`class:Druid|${source}:4:Ability Score Improvement`] = {
          kind: 'asi',
          abilityOption: 1,
          abilityChoices: { cha: 1, wis: 1 },
        }
      }
    },
  },
  {
    label: 'point buy 12',
    cha: 12,
    build: (c) => {
      c.statMethod = 'pointbuy'
      c.abilities.cha.base = 12
      c.abilities.wis.base = 13
    },
  },
  {
    label: 'array with Charisma unassigned',
    cha: null,
    build: (c) => {
      c.statMethod = 'array'
      c.statPool = [...ARRAY]
      c.abilities.wis.base = 13
    },
  },
]

const EDITIONS = ['PHB', 'XPHB']

const CASES = EDITIONS.flatMap((druid) =>
  EDITIONS.flatMap((bard) =>
    [true, false].flatMap((druidFirst) =>
      WAYS.map((way) => ({ druid, bard, druidFirst, way })),
    ),
  ),
)

function seed({ druid, bard, druidFirst, way }: (typeof CASES)[number]) {
  const c = createCharacter('Sweep')
  c.selectedBooks = ['PHB', 'XPHB', 'MM', 'DMG', 'XGE', 'TCE']
  const d: ClassRef = { name: 'Druid', source: druid, level: 4 }
  const b: ClassRef = { name: 'Bard', source: bard, level: 1 }
  c.classes = druidFirst ? [d, b] : [b, d]
  way.build(c)
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'editor',
  })
}

describe('the multiclass flag against the Ability Scores table', () => {
  beforeAll(() => {
    vi.mocked(fetchData).mockImplementation(
      (path: string) =>
        Promise.resolve(
          JSON.parse(readFileSync(`public/data/${path}`, 'utf8')),
        ) as Promise<never>,
    )
  })
  afterEach(cleanup)

  it('covers every edition, order and way of reaching the score', () => {
    expect(CASES).toHaveLength(56)
  })

  it.each(CASES)(
    'Druid|$druid and Bard|$bard, Druid first $druidFirst: $way.label',
    async (c) => {
      seed(c)
      render(
        <ThemeProvider>
          <AbilityScores />
          <Probe />
        </ThemeProvider>,
      )
      await waitFor(
        () => expect(screen.getByTestId('loading')).toHaveTextContent('false'),
        {
          timeout: 20_000,
        },
      )
      const row = screen.getByText('Charisma').closest('tr')
      const shown = row?.querySelectorAll('td')[5]?.textContent
      // The table, the sheet and the flag read the same Charisma.
      expect(shown).toBe(String(c.way.cha ?? 0))
      expect(screen.getByTestId('sheet-cha')).toHaveTextContent(String(c.way.cha ?? 0))
      const bardFlag = screen.queryByTestId(`multiclass-req:Bard|${c.bard}`)
      const druidFlag = screen.queryByTestId(`multiclass-req:Druid|${c.druid}`)
      const cha = c.way.atEntry?.cha ?? c.way.cha
      if (cha === null) {
        expect(bardFlag).toHaveTextContent(
          'Bard needs Charisma 13 to multiclass, Charisma is not set yet - allowed with DM approval.',
        )
      } else if (cha < 13) {
        expect(bardFlag).toHaveTextContent(
          `Bard needs Charisma 13 to multiclass, you have ${cha} at character level 2 - allowed with DM approval.`,
        )
      } else {
        expect(bardFlag).toBeNull()
      }
      if (c.way.atEntry && c.way.atEntry.wis < 13) {
        expect(druidFlag).toHaveTextContent(
          `Druid needs Wisdom 13 to multiclass, you have ${c.way.atEntry.wis} at character level 2 - allowed with DM approval.`,
        )
      } else {
        expect(druidFlag).toBeNull()
      }
    },
  )
})
