import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SpellsSection } from './SpellsSection'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import {
  BONUS_SLOT_PREFIX,
  createCharacter,
  type Character,
  type RaceRef,
} from '../../character/model'
import { loadClasses, type LoadedClass, type SubclassEntry } from '../../data/class'
import { loadSpells } from '../../data/spells'
import { listsOf, makeSpell } from '../../test/spellFixtures'
import { loadBackgrounds } from '../../data/background'
import { loadRaces, type PlayableRace } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { settle } from '../../test/settle'
import { makeFeat } from '../../test/featFixtures'

vi.mock('../../data/class', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/class')>()),
  loadClasses: vi.fn(),
}))
vi.mock('../../data/background', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/background')>()),
  loadBackgrounds: vi.fn(),
}))
vi.mock('../../data/race', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/race')>()),
  loadRaces: vi.fn(),
}))
vi.mock('../../data/feats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/feats')>()),
  loadFeats: vi.fn(),
}))
vi.mock('../../data/spells', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/spells')>()
  return { ...actual, loadSpells: vi.fn() }
})
const mockClasses = vi.mocked(loadClasses)
const mockSpells = vi.mocked(loadSpells)
const mockBackgrounds = vi.mocked(loadBackgrounds)
const mockRaces = vi.mocked(loadRaces)
const mockFeats = vi.mocked(loadFeats)

const wizard: LoadedClass = {
  entry: {
    name: 'Wizard',
    source: 'PHB',
    edition: 'classic',
    hd: { number: 1, faces: 6 },
    spellcastingAbility: 'int',
    casterProgression: 'full',
    cantripProgression: [3, 3, 3],
    preparedSpells: '<$level$> + <$int_mod$>',
    classFeatures: [],
  },
  file: {},
}

// A one-third "known" caster that gains no slots at low level (Arcane
// Trickster-style): exercises the known cap label and the empty slot overview.
const trickster: LoadedClass = {
  entry: {
    name: 'Trickster',
    source: 'PHB',
    hd: { number: 1, faces: 8 },
    spellcastingAbility: 'int',
    casterProgression: '1/3',
    cantripProgression: [2, 2, 2],
    spellsKnownProgression: [2, 2, 3],
    classFeatures: [],
  },
  file: {},
}

// A Pact Magic caster: exercises the pact slot badge and the "Pact Magic" tag.
const warlock: LoadedClass = {
  entry: {
    name: 'Warlock',
    source: 'PHB',
    hd: { number: 1, faces: 8 },
    spellcastingAbility: 'cha',
    casterProgression: 'pact',
    cantripProgression: [2, 2, 2],
    spellsKnownProgression: [2, 3, 4],
    classFeatures: [],
  },
  file: {},
}

// A generic prepared caster that prepares from its whole list (not a spellbook):
// exercises the plain <ClassSpells> path now that the Wizard has its own editor.
const cleric: LoadedClass = {
  entry: {
    name: 'Cleric',
    source: 'PHB',
    hd: { number: 1, faces: 8 },
    spellcastingAbility: 'wis',
    casterProgression: 'full',
    cantripProgression: [3, 3, 3],
    preparedSpells: '<$level$> + <$wis_mod$>',
    classFeatures: [],
  },
  file: {},
}

const sacredFlame = makeSpell({
  name: 'Sacred Flame',
  source: 'PHB',
  level: 0,
  school: 'V',
  lists: listsOf('Cleric|PHB'),
})

const bless = makeSpell({
  name: 'Bless',
  source: 'PHB',
  level: 1,
  school: 'E',
  concentration: true,
  lists: listsOf('Cleric|PHB'),
})

const trickCantrip = makeSpell({
  name: 'Mage Hand',
  source: 'PHB',
  level: 0,
  school: 'C',
  lists: listsOf('Trickster|PHB'),
})

// A cantrip from a book the character has not selected -> filtered out.
const offBookCantrip = makeSpell({
  name: 'Booming Blade',
  source: 'TCE',
  level: 0,
  school: 'V',
  lists: listsOf('Trickster|PHB'),
})

const fireBolt = makeSpell({
  name: 'Fire Bolt',
  source: 'PHB',
  level: 0,
  school: 'V',
  lists: listsOf('Wizard|PHB'),
})

const magicMissile = makeSpell({
  name: 'Magic Missile',
  source: 'PHB',
  level: 1,
  school: 'V',
  lists: listsOf('Wizard|PHB'),
})

const detectMagic = makeSpell({
  name: 'Detect Magic',
  source: 'PHB',
  level: 1,
  school: 'D',
  ritual: true,
  concentration: true,
  lists: listsOf('Wizard|PHB', 'Cleric|PHB'),
})

const cureWounds = makeSpell({
  name: 'Cure Wounds',
  source: 'PHB',
  level: 1,
  school: 'V',
  lists: listsOf('Cleric|PHB'),
})

const wish = makeSpell({
  name: 'Wish',
  source: 'PHB',
  level: 9,
  school: 'C',
  lists: listsOf('Wizard|PHB'),
})

function seedActive(mutate: (c: ReturnType<typeof createCharacter>) => void = () => {}) {
  const c = createCharacter('Tordek')
  c.selectedBooks = ['PHB']
  mutate(c)
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'editor',
  })
  return c
}

function renderSection() {
  return render(
    <ThemeProvider>
      <SpellsSection />
    </ThemeProvider>,
  )
}

function active(id: string) {
  return useCharacterStore.getState().characters[id]
}

/** A table by its accessible name: "Cleric spells prepared", "Wizard cantrips". */
const tableOf = (name: string) => within(screen.getByRole('table', { name }))
/** The row of a spell in a table. */
const rowOf = (table: string, spell: string) => {
  const cell = within(screen.getByRole('table', { name: table })).getByText(spell, {
    selector: 'strong',
  })
  const row = cell.closest('tr')
  if (!row) throw new Error(`no row for ${spell}`)
  return within(row)
}
const add = (user: ReturnType<typeof userEvent.setup>, table: string, spell: string) =>
  user.click(rowOf(table, spell).getByRole('button', { name: 'Add' }))
const choose = (user: ReturnType<typeof userEvent.setup>, noun: string) =>
  user.click(screen.getByRole('button', { name: `Choose ${noun}` }))

// The 2024 Wizard: its own prepared table, and spells from both editions to tell apart.
const wizard2024: LoadedClass = {
  entry: {
    name: 'Wizard',
    source: 'XPHB',
    edition: 'one',
    hd: { number: 1, faces: 6 },
    spellcastingAbility: 'int',
    casterProgression: 'full',
    cantripProgression: [3, 3, 3],
    preparedSpellsProgression: [4, 5, 6],
    classFeatures: [],
  },
  file: {},
}
const shield2024 = makeSpell({
  name: 'Shield',
  source: 'XPHB',
  edition: 'one',
  lists: listsOf('Wizard|XPHB'),
})
const shield2014 = makeSpell({
  name: 'Shield',
  source: 'PHB',
  lists: listsOf('Wizard|PHB'),
})
const mageHand2 = makeSpell({
  name: 'Prestidigitation',
  level: 0,
  lists: listsOf('Trickster|PHB'),
})
const light = makeSpell({ name: 'Light', level: 0, lists: listsOf('Trickster|PHB') })
// Optional on the Cleric list while Tasha's is selected.
const optionalSpell = makeSpell({
  name: 'Spare the Dying',
  level: 0,
  lists: { classes: [], variants: { 'Cleric|PHB': ['TCE'] }, subclasses: [] },
})

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockClasses.mockResolvedValue([wizard])
  mockSpells.mockResolvedValue([fireBolt, magicMissile])
  mockBackgrounds.mockResolvedValue([])
  mockRaces.mockResolvedValue([])
  mockFeats.mockResolvedValue([])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('SpellsSection', () => {
  it('renders nothing without an active character', async () => {
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    // Still nothing once the section data has loaded.
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('warns when the character has no spellcasting class', async () => {
    seedActive()
    renderSection()
    expect(await screen.findByText(/No spellcasting class yet/i)).toBeInTheDocument()
  })

  it('lists a caster and lets you add a cantrip and a spell from the tables', async () => {
    const user = userEvent.setup()
    mockClasses.mockResolvedValue([cleric])
    mockSpells.mockResolvedValue([sacredFlame, bless])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Cleric', source: 'PHB', level: 3 }]
    })
    renderSection()

    expect(await screen.findByText('Cleric')).toBeInTheDocument()
    // The limit is always beside the count.
    expect(screen.getByText(/Cantrips 0 of 3/)).toBeInTheDocument()

    await add(user, 'Cleric cantrips', 'Sacred Flame')
    await waitFor(() =>
      expect(active(c.id).spells['Cleric|PHB'].cantrips).toHaveLength(1),
    )
    expect(screen.getByText(/Cantrips 1 of 3/)).toBeInTheDocument()

    // Done shuts the table to the cantrips chosen, each with its Remove.
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(
      rowOf('Cleric cantrips', 'Sacred Flame').getByRole('button', { name: 'Remove' }),
    ).toBeInTheDocument()

    await choose(user, 'spells prepared')
    await add(user, 'Cleric spells prepared', 'Bless')
    await waitFor(() => expect(active(c.id).spells['Cleric|PHB'].spells).toHaveLength(1))
    expect(screen.getByText(/Spells prepared 1 of \d+/)).toBeInTheDocument()
    expect(screen.getAllByText('Concentration').length).toBeGreaterThan(0)
  })

  it('greys off-list and over-level spells with the reason until the switch allows them', async () => {
    const user = userEvent.setup()
    mockClasses.mockResolvedValue([cleric])
    mockSpells.mockResolvedValue([detectMagic, magicMissile, wish])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Cleric', source: 'PHB', level: 3 }]
      // WIS 14 -> +2, so a level-3 cleric prepares five and the table stays open.
      ch.abilities.wis = { base: 14, other: 0 }
    })
    renderSection()

    // Slot overview renders per-level badges for a level-3 full caster.
    expect(await screen.findByText(/Level 1: 4 slots/)).toBeInTheDocument()
    await choose(user, 'spells prepared')
    const table = 'Cleric spells prepared'
    // Ritual and concentration are written out on the spell's name.
    expect(screen.getAllByText('Ritual').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Concentration').length).toBeGreaterThan(0)

    // The reasons are short and sit in the row; Add waits for the switch.
    expect(
      rowOf(table, 'Magic Missile').getByText('Not on the 2014 Cleric list'),
    ).toBeVisible()
    expect(
      rowOf(table, 'Wish').getByText('Not on the 2014 Cleric list; Needs level 9 slots'),
    ).toBeVisible()
    expect(
      rowOf(table, 'Magic Missile').getByRole('button', { name: 'Add' }),
    ).toBeDisabled()
    expect(
      rowOf(table, 'Detect Magic').getByRole('button', { name: 'Add' }),
    ).toBeEnabled()

    await user.click(screen.getByLabelText('Allow non-standard choices (DM approval)'))
    await add(user, table, 'Magic Missile')
    await add(user, table, 'Wish')
    await waitFor(() => expect(active(c.id).spells['Cleric|PHB'].spells).toHaveLength(2))

    // The picks keep their flag and reason.
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getAllByRole('note').length).toBeGreaterThan(0)
    expect(
      rowOf(table, 'Wish').getByText('Not on the 2014 Cleric list; Needs level 9 slots'),
    ).toBeVisible()
  })

  it('searches the table', async () => {
    const user = userEvent.setup()
    mockClasses.mockResolvedValue([cleric])
    mockSpells.mockResolvedValue([sacredFlame])
    seedActive((ch) => {
      ch.classes = [{ name: 'Cleric', source: 'PHB', level: 3 }]
    })
    renderSection()

    await user.type(await screen.findByPlaceholderText(/Search spells/), 'zzz')
    await waitFor(() =>
      expect(
        tableOf('Cleric cantrips').queryByText('Sacred Flame'),
      ).not.toBeInTheDocument(),
    )
  })

  it('shows a known cap and an empty slot overview for a slotless known caster', async () => {
    mockClasses.mockResolvedValue([trickster])
    mockSpells.mockResolvedValue([trickCantrip, offBookCantrip])
    seedActive((ch) => {
      // A one-third caster at level 2 contributes no full-caster levels -> no slots.
      ch.classes = [{ name: 'Trickster', source: 'PHB', level: 2 }]
    })
    renderSection()

    // Known casters read "known", not "prepared", with the cap beside the count.
    expect(await screen.findByText(/Spells known 0 of 2/)).toBeInTheDocument()
    expect(screen.getByText('Known')).toBeInTheDocument()
    // No standard slots and no pact -> the slot overview renders nothing.
    expect(screen.queryByText(/^Level \d/)).not.toBeInTheDocument()
    // A cantrip from an unselected book is not a row; the selected book's is.
    expect(
      tableOf('Trickster cantrips').queryByText('Booming Blade'),
    ).not.toBeInTheDocument()
    expect(tableOf('Trickster cantrips').getByText('Mage Hand')).toBeInTheDocument()
  })

  it('lets an Eldritch Knight choose from its subclass list, with its own slots', async () => {
    const user = userEvent.setup()
    const knight: LoadedClass = {
      entry: {
        name: 'Fighter',
        source: 'PHB',
        hd: { number: 1, faces: 10 },
        classFeatures: [],
      },
      file: {
        subclass: [
          {
            name: 'Eldritch Knight',
            shortName: 'Eldritch Knight',
            source: 'PHB',
            className: 'Fighter',
            classSource: 'PHB',
            subclassFeatures: [],
            casterProgression: '1/3',
            spellcastingAbility: 'int',
            cantripProgression: [0, 0, 2],
            spellsKnownProgression: [0, 0, 3],
          },
        ],
      },
    }
    const shield = makeSpell({
      name: 'Shield',
      level: 1,
      lists: {
        classes: ['Wizard|PHB'],
        variants: {},
        subclasses: ['Fighter|PHB|Eldritch Knight'],
      },
    })
    mockClasses.mockResolvedValue([knight])
    mockSpells.mockResolvedValue([shield, magicMissile])
    seedActive((ch) => {
      ch.classes = [
        {
          name: 'Fighter',
          source: 'PHB',
          level: 3,
          subclass: {
            name: 'Eldritch Knight',
            shortName: 'Eldritch Knight',
            source: 'PHB',
          },
        },
      ]
    })
    renderSection()

    expect(await screen.findByText(/Spells known 0 of 3/)).toBeInTheDocument()
    expect(screen.getByText(/Level 1: 2 slots/)).toBeInTheDocument()
    await choose(user, 'spells known')
    const table = 'Fighter (Eldritch Knight) spells known'
    // On the subclass list, not merely the Wizard's.
    expect(rowOf(table, 'Shield').getByRole('button', { name: 'Add' })).toBeEnabled()
    expect(
      rowOf(table, 'Magic Missile').getByText(
        /Not on the 2014 Fighter \(Eldritch Knight\) list/,
      ),
    ).toBeVisible()
  })

  it('shows pact slots and a Pact Magic tag for a warlock', async () => {
    mockClasses.mockResolvedValue([warlock])
    mockSpells.mockResolvedValue([])
    seedActive((ch) => {
      ch.classes = [{ name: 'Warlock', source: 'PHB', level: 3 }]
    })
    renderSection()

    expect(await screen.findByText(/Pact:/)).toBeInTheDocument()
    expect(screen.getByText('Pact Magic')).toBeInTheDocument()
  })

  it('flags a cantrip overflow, removes a picked cantrip, and reads a lone slot singular', async () => {
    const user = userEvent.setup()
    // A level-7 wizard has a single level-4 slot -> singular "slot".
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Wizard', source: 'PHB', level: 7 }]
      // One chosen cantrip already exceeds the level-7 known count.
      ch.spells = {
        'Wizard|PHB': {
          cantrips: [{ name: 'Fire Bolt', source: 'PHB', level: 0 }],
          spells: [],
        },
      }
    })
    renderSection()

    // The lone level-4 slot is worded in the singular.
    expect(await screen.findByText(/Level 4: 1 slot(?!s)/)).toBeInTheDocument()
    // Over the cantrip cap -> a non-standard note is surfaced.
    expect(screen.getByText(/Cantrips 1 of 0/)).toBeInTheDocument()
    expect(screen.getAllByRole('note').length).toBeGreaterThan(0)

    // Remove in the table of picks takes the cantrip off.
    await user.click(
      rowOf('Wizard cantrips', 'Fire Bolt').getByRole('button', { name: 'Remove' }),
    )
    await waitFor(() =>
      expect(active(c.id).spells['Wizard|PHB'].cantrips).toHaveLength(0),
    )
  })

  it('shuts a full table by itself, opens the next, and greys what no longer fits', async () => {
    const user = userEvent.setup()
    mockClasses.mockResolvedValue([trickster])
    mockSpells.mockResolvedValue([trickCantrip, mageHand2, light])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Trickster', source: 'PHB', level: 2 }]
    })
    renderSection()

    await screen.findByRole('table', { name: 'Trickster cantrips' })
    await add(user, 'Trickster cantrips', 'Light')
    await add(user, 'Trickster cantrips', 'Mage Hand')
    await waitFor(() =>
      expect(active(c.id).spells['Trickster|PHB'].cantrips).toHaveLength(2),
    )
    // The cantrips are done: they fold to their picks and the spells table opens.
    expect(
      screen.getByRole('table', { name: 'Trickster spells known' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Cantrips 2 of 2/)).toBeInTheDocument()

    // Change brings the full table back; one more is a reason, not a hard stop.
    await user.click(screen.getAllByRole('button', { name: 'Change' })[0])
    expect(
      rowOf('Trickster cantrips', 'Prestidigitation').getByText('All 2 cantrips chosen'),
    ).toBeVisible()
    expect(
      rowOf('Trickster cantrips', 'Prestidigitation').getByRole('button', {
        name: 'Add',
      }),
    ).toBeDisabled()
  })

  it('counts an optional list as standard while its book is selected', async () => {
    mockClasses.mockResolvedValue([cleric])
    mockSpells.mockResolvedValue([optionalSpell])
    seedActive((ch) => {
      ch.classes = [{ name: 'Cleric', source: 'PHB', level: 3 }]
      ch.selectedBooks = ['PHB', 'TCE']
    })
    renderSection()
    await screen.findByText('Cleric')
    expect(
      rowOf('Cleric cantrips', 'Spare the Dying').getByRole('button', { name: 'Add' }),
    ).toBeEnabled()
  })

  it('keeps and shows spells saved for a class that no longer casts', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Wizard', source: 'PHB', level: 3 }]
      ch.spells = {
        'Fighter|PHB': {
          cantrips: [{ name: 'Mage Hand', source: 'PHB', level: 0 }],
          spells: [],
        },
      }
    })
    renderSection()

    expect(
      await screen.findByText(/Spells for Fighter \(no longer casting\)/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove all' }))
    await waitFor(() => expect(active(c.id).spells['Fighter|PHB']).toBeUndefined())
  })

  it('says when a chosen spell is from a book that is not selected, and removes it', async () => {
    const user = userEvent.setup()
    mockSpells.mockResolvedValue([fireBolt, offBookCantrip])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Wizard', source: 'PHB', level: 3 }]
      ch.spells = {
        'Wizard|PHB': {
          cantrips: [{ name: 'Booming Blade', source: 'TCE', level: 0 }],
          spells: [],
        },
      }
    })
    renderSection()

    expect(await screen.findByText(/is not in the selected books/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove spell' }))
    await waitFor(() =>
      expect(active(c.id).spells['Wizard|PHB'].cantrips).toHaveLength(0),
    )
  })

  it('caps a 2024 caster by its prepared table and marks the other edition', async () => {
    const user = userEvent.setup()
    mockClasses.mockResolvedValue([wizard2024])
    mockSpells.mockResolvedValue([shield2024, shield2014])
    seedActive((ch) => {
      ch.classes = [{ name: 'Wizard', source: 'XPHB', level: 1 }]
      ch.selectedBooks = ['PHB', 'XPHB']
    })
    renderSection()

    expect(await screen.findByText(/Spells prepared 0 of 4/)).toBeInTheDocument()
    await choose(user, 'spellbook spells')
    expect(
      screen.getByText('2014 printing - your 2024 Wizard has the 2024 one (class list)'),
    ).toBeVisible()
    expect(
      screen
        .getAllByRole('button', { name: 'Add' })
        .filter((b) => !b.hasAttribute('disabled')),
    ).toHaveLength(1)
  })

  it('surfaces a loader error', async () => {
    seedActive((ch) => {
      ch.classes = [{ name: 'Wizard', source: 'PHB', level: 3 }]
    })
    mockSpells.mockRejectedValue(new Error('boom'))
    renderSection()
    expect(await screen.findByText(/Failed to load spells: boom/i)).toBeInTheDocument()
  })
})

describe('Wizard tiers', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockClasses.mockResolvedValue([wizard])
    mockSpells.mockResolvedValue([fireBolt, magicMissile])
    useCharacterStore.setState({
      characters: {},
      order: [],
      activeId: null,
      view: 'list',
    })
  })

  it('adds cantrips, fills a spellbook, and prepares from the book', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Wizard', source: 'PHB', level: 3 }]
    })
    renderSection()

    // The book baseline is informational: six at level 1, +2 per level after.
    expect(
      await screen.findByText(/Free from your levels: 10 spells/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Chosen from your spellbook/)).toBeInTheDocument()

    // Cantrips are chosen directly, as before.
    await add(user, 'Wizard cantrips', 'Fire Bolt')
    await waitFor(() =>
      expect(active(c.id).spells['Wizard|PHB'].cantrips).toHaveLength(1),
    )
    await user.click(screen.getByRole('button', { name: 'Done' }))

    // A leveled spell goes into the spellbook first, not straight to prepared.
    await choose(user, 'spellbook spells')
    await add(user, 'Wizard spellbook spells', 'Magic Missile')
    await waitFor(() =>
      expect(active(c.id).spells['Wizard|PHB'].spellbook).toHaveLength(1),
    )
    expect(active(c.id).spells['Wizard|PHB'].spells).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Done' }))

    // Now it can be prepared from the book.
    await choose(user, 'spells prepared')
    await add(user, 'Wizard spells prepared', 'Magic Missile')
    await waitFor(() => expect(active(c.id).spells['Wizard|PHB'].spells).toHaveLength(1))
  })

  it('copies an off-list spell into the spellbook when non-standard choices are allowed', async () => {
    const user = userEvent.setup()
    mockSpells.mockResolvedValue([magicMissile, cureWounds])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Wizard', source: 'PHB', level: 3 }]
    })
    renderSection()

    await screen.findByText(/Free from your levels/)
    await choose(user, 'spellbook spells')
    const table = 'Wizard spellbook spells'
    // Off-list Cure Wounds is greyed with its reason until the switch allows it.
    expect(
      rowOf(table, 'Cure Wounds').getByText('Not on the 2014 Wizard list'),
    ).toBeVisible()
    expect(
      rowOf(table, 'Cure Wounds').getByRole('button', { name: 'Add' }),
    ).toBeDisabled()

    await user.click(screen.getByLabelText('Allow non-standard choices (DM approval)'))
    await add(user, table, 'Cure Wounds')
    await waitFor(() =>
      expect(active(c.id).spells['Wizard|PHB'].spellbook).toHaveLength(1),
    )
    // A copied off-list spell is flagged, not blocked.
    expect(screen.getAllByRole('note').length).toBeGreaterThan(0)
  })

  it('flags over-preparing and unprepares a spell removed from the book', async () => {
    const user = userEvent.setup()
    mockSpells.mockResolvedValue([fireBolt, magicMissile, detectMagic])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Wizard', source: 'PHB', level: 1 }]
      // INT 10 -> +0, so a level-1 wizard prepares just one spell.
      ch.abilities.int = { base: 10, other: 0 }
      ch.spells = {
        'Wizard|PHB': {
          cantrips: [],
          spellbook: [
            { name: 'Magic Missile', source: 'PHB', level: 1 },
            { name: 'Detect Magic', source: 'PHB', level: 1 },
          ],
          spells: [
            { name: 'Magic Missile', source: 'PHB', level: 1 },
            { name: 'Detect Magic', source: 'PHB', level: 1 },
          ],
        },
      }
    })
    renderSection()

    // Two prepared against a max of one is flagged, not blocked.
    expect(await screen.findByText(/Spells prepared 2 of 1/)).toBeInTheDocument()
    expect(screen.getAllByRole('note').length).toBeGreaterThan(0)

    // Erasing a spell from the book also unprepares it.
    await user.click(
      rowOf('Wizard spellbook spells', 'Magic Missile').getByRole('button', {
        name: 'Remove',
      }),
    )
    await waitFor(() =>
      expect(active(c.id).spells['Wizard|PHB'].spellbook).toHaveLength(1),
    )
    expect(active(c.id).spells['Wizard|PHB'].spells).toHaveLength(1)
  })

  it('treats a pre-spellbook wizard prepared spells as its starting book', async () => {
    const user = userEvent.setup()
    mockSpells.mockResolvedValue([magicMissile])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Wizard', source: 'PHB', level: 3 }]
      // Older data: prepared spells, but no spellbook array yet.
      ch.spells = {
        'Wizard|PHB': {
          cantrips: [],
          spells: [{ name: 'Magic Missile', source: 'PHB', level: 1 }],
        },
      }
    })
    renderSection()

    // The existing spell shows up in the book and as prepared, nothing lost.
    const booked = await screen.findByRole('table', { name: 'Wizard spellbook spells' })
    expect(within(booked).getByText('Magic Missile')).toBeInTheDocument()
    const prepared = rowOf('Wizard spells prepared', 'Magic Missile')

    // Editing persists the book explicitly.
    await user.click(prepared.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(active(c.id).spells['Wizard|PHB'].spells).toHaveLength(0))
    expect(active(c.id).spells['Wizard|PHB'].spellbook).toHaveLength(1)
  })
})

// ---- Granted spells ---------------------------------------------------------

const lifeDomain: SubclassEntry = {
  name: 'Life Domain',
  shortName: 'Life',
  source: 'PHB',
  className: 'Cleric',
  classSource: 'PHB',
  edition: 'classic',
  subclassFeatures: [],
  additionalSpells: [{ prepared: { '1': ['bless'], '3': ['cure wounds'] } }],
}
const domainCleric: LoadedClass = {
  entry: cleric.entry,
  file: { subclass: [lifeDomain] },
}

const mistyStep = makeSpell({ name: 'Misty Step', level: 2, school: 'C' })
const charmPerson = makeSpell({ name: 'Charm Person', level: 1, school: 'E' })
const fireball = makeSpell({ name: 'Fireball', level: 3, school: 'V' })
const guidance = makeSpell({
  name: 'Guidance',
  level: 0,
  school: 'D',
  lists: listsOf('Cleric|PHB'),
})
const resistance = makeSpell({
  name: 'Resistance',
  level: 0,
  school: 'A',
  lists: listsOf('Cleric|PHB'),
})
const thaumaturgy = makeSpell({ name: 'Thaumaturgy', level: 0, school: 'T' })
const poisonSpray = makeSpell({ name: 'Poison Spray', level: 0, school: 'C' })

const raceOf = (name: string, additionalSpells: unknown[]): PlayableRace => ({
  key: `${name}|phb`.toLowerCase(),
  name,
  baseName: name,
  source: 'PHB',
  edition: 'classic',
  abilityOptions: [],
  featGrants: [],
  additionalSpells,
})

const raceRef = (baseName: string): RaceRef => ({
  name: baseName,
  baseName,
  source: 'PHB',
  abilityFixed: {},
  abilityChoices: {},
})

const feat = (name: string, additionalSpells: unknown[]) =>
  makeFeat({ name, source: 'PHB', additionalSpells })

function withFeat(c: Character, name: string) {
  const id = `${BONUS_SLOT_PREFIX}a`
  c.feats = {
    choices: { [id]: { kind: 'feat', feat: { name, source: 'PHB' } } },
    bonusSlots: [id],
  }
}

describe('Granted spells', () => {
  it('shows what the subclass always prepares in the tier, costing no pick', async () => {
    const user = userEvent.setup()
    mockClasses.mockResolvedValue([domainCleric])
    mockSpells.mockResolvedValue([sacredFlame, bless, cureWounds])
    const c = seedActive((ch) => {
      ch.classes = [
        {
          name: 'Cleric',
          source: 'PHB',
          level: 1,
          subclass: { name: 'Life Domain', shortName: 'Life', source: 'PHB' },
        },
      ]
    })
    renderSection()

    await screen.findByText('Cleric')
    await add(user, 'Cleric cantrips', 'Sacred Flame')
    await user.click(screen.getByRole('button', { name: 'Done' }))

    // The domain spell is already in the table of spells prepared: no Remove, no pick.
    const table = 'Cleric spells prepared'
    expect(screen.getByText('+1 always prepared')).toBeInTheDocument()
    expect(screen.getByText(/Spells prepared 0 of/)).toBeInTheDocument()
    expect(rowOf(table, 'Bless').queryByRole('button', { name: 'Remove' })).toBeNull()
    const spells = within(screen.getByRole('table', { name: table }))
    expect(spells.getByText('Life Domain, always prepared')).toBeVisible()
    // The one gained at level 3 is listed, greyed, with when it unlocks.
    expect(spells.getByText('Life Domain, unlocks at level 3')).toBeVisible()
    expect(active(c.id).spells['Cleric|PHB'].spells).toEqual([])

    // Choosing a spell it already has is flagged, not offered as new.
    await user.click(screen.getAllByRole('button', { name: 'Change' })[1])
    expect(
      rowOf(table, 'Bless').getByText(/Already always prepared \(Life Domain\)/),
    ).toBeVisible()
  })

  it('lists the spells of a species and makes its choices, with no class at all', async () => {
    const user = userEvent.setup()
    mockSpells.mockResolvedValue([thaumaturgy, poisonSpray, mistyStep])
    mockRaces.mockResolvedValue([
      raceOf('Tiefling', [
        { name: 'Infernal', ability: 'cha', known: { '1': ['thaumaturgy#c'] } },
        {
          name: 'Abyssal',
          ability: { choose: ['int', 'wis', 'cha'] },
          known: { '1': ['poison spray#c'] },
          innate: { '3': { daily: { '1': ['misty step'] } } },
        },
      ]),
    ])
    const c = seedActive((ch) => {
      ch.race = raceRef('Tiefling')
    })
    renderSection()

    // Each set shows the spells it gives, by level, before one is taken; none is in force yet.
    const sets = within(await screen.findByRole('table', { name: 'Tiefling spell sets' }))
    expect(sets.getByText(/Level 1: Thaumaturgy/)).toBeInTheDocument()
    expect(
      sets.getByText(/Level 1: Poison Spray; At level 3: Misty Step/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('table', { name: 'Tiefling spells' }),
    ).not.toBeInTheDocument()
    const abyssal = sets.getByText('Abyssal').closest('tr') as HTMLElement
    await user.click(within(abyssal).getByRole('button', { name: 'Choose' }))
    await waitFor(() =>
      expect(active(c.id).spellGrants['race:variant']?.variant).toBe('Abyssal'),
    )
    const table = within(screen.getByRole('table', { name: 'Tiefling spells' }))
    expect(table.getByText('Poison Spray')).toBeVisible()
    expect(table.getByText('Always known')).toBeVisible()
    expect(table.getByText('Misty Step')).toBeVisible()
    expect(table.getByText(/1 per long rest/)).toBeVisible()
    expect(table.queryByText('Thaumaturgy')).not.toBeInTheDocument()
    expect(table.getByText(/Unlocks at level 3/)).toBeVisible()

    // The spellcasting ability is the player's pick, kept on the character.
    await user.click(screen.getByRole('radio', { name: 'Wisdom' }))
    await waitFor(() =>
      expect(active(c.id).spellGrants['race:1:ability']?.ability).toBe('wis'),
    )
  })

  it('lets a feat choose its cantrips from the table, held to the list it names', async () => {
    const user = userEvent.setup()
    mockFeats.mockResolvedValue([
      feat('Magic Initiate', [
        {
          ability: { choose: ['int', 'wis', 'cha'] },
          known: { _: [{ choose: 'level=0|class=Cleric', count: 2 }] },
          innate: { _: { daily: { '1': [{ choose: 'level=1|class=Cleric' }] } } },
        },
      ]),
    ])
    // The filter's class is read from the classes there are: the Cleric is one.
    mockClasses.mockResolvedValue([wizard, cleric])
    mockSpells.mockResolvedValue([guidance, resistance, sacredFlame, fireBolt, bless])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Wizard', source: 'PHB', level: 1 }]
      withFeat(ch, 'Magic Initiate')
    })
    renderSection()

    const table = 'Magic Initiate Cleric cantrips'
    await screen.findByText('Spellcasting ability:')
    await choose(user, 'Cleric cantrips')
    // Only the Cleric cantrips are standard; the wizard's is greyed with why.
    expect(rowOf(table, 'Guidance').getByRole('button', { name: 'Add' })).toBeEnabled()
    expect(rowOf(table, 'Fire Bolt').getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(
      rowOf(table, 'Fire Bolt').getByText(/Not on this list \(Cleric cantrip\)/),
    ).toBeVisible()

    await add(user, table, 'Guidance')
    await add(user, table, 'Resistance')
    await waitFor(() => {
      const picks = Object.values(active(c.id).spellGrants).flatMap((g) => g.picks)
      expect(picks.map((p) => p.name)).toEqual(['Guidance', 'Resistance'])
    })
    // The class's own cantrips are not touched.
    expect(active(c.id).spells['Wizard|PHB']?.cantrips ?? []).toEqual([])
  })

  it('applies a fixed feat spell and a species cantrip choice', async () => {
    const user = userEvent.setup()
    mockFeats.mockResolvedValue([
      feat('Fey Touched', [
        {
          ability: 'inherit',
          innate: {
            _: { daily: { '1e': ['misty step', { choose: 'level=1|school=E;D' }] } },
          },
        },
      ]),
    ])
    mockRaces.mockResolvedValue([
      raceOf('High Elf', [
        { ability: 'int', known: { '1': [{ choose: 'level=0|class=Wizard' }] } },
      ]),
    ])
    mockSpells.mockResolvedValue([mistyStep, charmPerson, fireball, fireBolt])
    const c = seedActive((ch) => {
      ch.race = raceRef('High Elf')
      withFeat(ch, 'Fey Touched')
    })
    renderSection()

    const region = within(await screen.findByRole('region', { name: /Spells from your/ }))
    expect(region.getByText(/1 per long rest each/)).toBeInTheDocument()
    expect(
      region.getByText('Spellcasting ability: the one of your class.'),
    ).toBeInTheDocument()
    await add(user, 'High Elf Wizard cantrip', 'Fire Bolt')
    await waitFor(() => {
      const picks = Object.entries(active(c.id).spellGrants).flatMap(([id, g]) =>
        g.picks.map((p) => [id, p.name]),
      )
      expect(picks).toEqual([['race:0:known:1:0:0', 'Fire Bolt']])
    })

    // That grant is full, so the feat's choice opens next.
    // The level 1 Enchantment or Divination spell: Fireball is not one.
    const fey = 'Fey Touched level 1 Enchantment or Divination spell'
    expect(rowOf(fey, 'Charm Person').getByRole('button', { name: 'Add' })).toBeEnabled()
    expect(rowOf(fey, 'Fireball').getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('names the class edition on both printings of a spell it does not have', async () => {
    mockClasses.mockResolvedValue([cleric])
    mockSpells.mockResolvedValue([
      makeSpell({ name: 'Acid Splash', source: 'XPHB', edition: 'one', level: 0 }),
      makeSpell({ name: 'Acid Splash', source: 'PHB', level: 0 }),
      sacredFlame,
    ])
    seedActive((ch) => {
      ch.classes = [{ name: 'Cleric', source: 'PHB', level: 3 }]
      ch.selectedBooks = ['PHB', 'XPHB']
    })
    renderSection()

    await screen.findByText('Cleric')
    // The edition column says which printing a row is; the reason names the class's list.
    expect(screen.getAllByText('Not on the 2014 Cleric list')).toHaveLength(2)
  })

  it('reads the 2024 printing of a Circle spell as a printing a 2014 Druid has', async () => {
    const user = userEvent.setup()
    mockClasses.mockResolvedValue([starsDruid])
    mockSpells.mockResolvedValue([guidingBolt2014, guidingBolt2024])
    seedActive((ch) => {
      ch.classes = [{ name: 'Druid', source: 'PHB', level: 2, subclass: stars }]
      ch.abilities.wis = { base: 14, other: 0 }
      ch.selectedBooks = ['PHB', 'XPHB', 'TCE']
    })
    renderSection()

    await screen.findByText('Druid')
    // The Circle spell already sits in the tier, so it opens with Change.
    await user.click(screen.getByRole('button', { name: 'Change' }))
    expect(
      screen.getByText(
        '2024 printing - your 2014 Druid has the 2014 one (always prepared)',
      ),
    ).toBeVisible()
    expect(screen.getByText(/Already always prepared \(Circle of Stars\)/)).toBeVisible()
    expect(screen.queryByText(/Not on the/)).not.toBeInTheDocument()
  })

  it('does not count a Circle spell before its level, in the table or for its twin', async () => {
    const user = userEvent.setup()
    mockClasses.mockResolvedValue([starsDruid])
    mockSpells.mockResolvedValue([guidingBolt2014, guidingBolt2024])
    seedActive((ch) => {
      ch.classes = [{ name: 'Druid', source: 'PHB', level: 1, subclass: stars }]
      ch.abilities.wis = { base: 14, other: 0 }
      ch.selectedBooks = ['PHB', 'XPHB', 'TCE']
    })
    renderSection()

    await screen.findByText('Druid')
    await user.click(screen.getByRole('button', { name: 'Change' }))
    // Locked until level 2: neither printing is had yet, and neither reads as prepared.
    expect(screen.queryByText(/Already always prepared/)).not.toBeInTheDocument()
    expect(screen.getAllByText('Not on the 2014 Druid list')).toHaveLength(2)
  })

  it('reads an optional-list spell as the 2014 printing for a 2024 Druid', async () => {
    const user = userEvent.setup()
    mockClasses.mockResolvedValue([druid2024])
    mockSpells.mockResolvedValue([
      makeSpell({
        name: 'Ice Knife',
        source: 'XGE',
        lists: { classes: [], variants: { 'Druid|PHB': ['XGE'] }, subclasses: [] },
      }),
      makeSpell({
        name: 'Ice Knife',
        source: 'XPHB',
        edition: 'one',
        lists: listsOf('Druid|XPHB'),
      }),
    ])
    seedActive((ch) => {
      ch.classes = [{ name: 'Druid', source: 'XPHB', level: 1 }]
      ch.selectedBooks = ['XPHB', 'XGE']
    })
    renderSection()

    await screen.findByText('Druid')
    await choose(user, 'spells prepared')
    expect(
      screen.getByText('2014 printing - your 2024 Druid has the 2024 one (class list)'),
    ).toBeVisible()
  })
})

// ---- Druids of both editions --------------------------------------------------

const druidEntry = {
  name: 'Druid',
  hd: { number: 1, faces: 8 },
  spellcastingAbility: 'wis',
  casterProgression: 'full',
  cantripProgression: [2, 2, 2],
  classFeatures: [],
}
const stars = { name: 'Circle of Stars', shortName: 'Stars', source: 'TCE' }
const starsDruid: LoadedClass = {
  entry: {
    ...druidEntry,
    source: 'PHB',
    edition: 'classic',
    preparedSpells: '<$level$> + <$wis_mod$>',
  },
  file: {
    subclass: [
      {
        ...stars,
        className: 'Druid',
        classSource: 'PHB',
        edition: 'classic',
        subclassFeatures: [],
        additionalSpells: [{ prepared: { '2': ['guiding bolt'] } }],
      },
    ],
  },
}
const druid2024: LoadedClass = {
  entry: {
    ...druidEntry,
    source: 'XPHB',
    edition: 'one',
    preparedSpellsProgression: [4, 5, 6],
  },
  file: {},
}
const guidingBolt2014 = makeSpell({
  name: 'Guiding Bolt',
  lists: listsOf('Cleric|PHB'),
})
const guidingBolt2024 = makeSpell({
  name: 'Guiding Bolt',
  source: 'XPHB',
  edition: 'one',
  lists: listsOf('Cleric|XPHB'),
})

describe('Your spells', () => {
  it('lists every spell once with every source, and removes only what was picked', async () => {
    const user = userEvent.setup()
    mockClasses.mockResolvedValue([domainCleric])
    mockSpells.mockResolvedValue([sacredFlame, bless, cureWounds, thaumaturgy])
    mockRaces.mockResolvedValue([
      raceOf('Tiefling', [
        { name: 'Infernal', ability: 'cha', known: { '1': ['thaumaturgy#c'] } },
      ]),
    ])
    const c = seedActive((ch) => {
      ch.race = raceRef('Tiefling')
      ch.spellGrants = { 'race:variant': { picks: [], variant: 'Infernal' } }
      ch.classes = [
        {
          name: 'Cleric',
          source: 'PHB',
          level: 3,
          subclass: { name: 'Life Domain', shortName: 'Life', source: 'PHB' },
        },
      ]
      ch.spells = {
        'Cleric|PHB': {
          cantrips: [{ name: 'Sacred Flame', source: 'PHB', level: 0 }],
          spells: [{ name: 'Bless', source: 'PHB', level: 1 }],
        },
      }
    })
    renderSection()

    const region = within(await screen.findByRole('region', { name: 'Your spells' }))
    expect(region.getByText('4 spells, 3 granted')).toBeVisible()
    const blessRow = rowOf('Your spells', 'Bless')
    expect(blessRow.getByText('Cleric, Life Domain')).toBeVisible()
    expect(blessRow.getByText('Prepared; Always prepared')).toBeVisible()
    expect(blessRow.queryByRole('button', { name: 'Remove' })).toBeNull()
    expect(
      rowOf('Your spells', 'Thaumaturgy').queryByRole('button', { name: 'Remove' }),
    ).toBeNull()

    await user.click(
      rowOf('Your spells', 'Sacred Flame').getByRole('button', { name: 'Remove' }),
    )
    await waitFor(() => expect(active(c.id).spells['Cleric|PHB'].cantrips).toEqual([]))
  })

  it('removes a spell a feat let the player choose', async () => {
    const user = userEvent.setup()
    mockFeats.mockResolvedValue([
      feat('Magic Initiate', [
        { ability: 'wis', known: { _: [{ choose: 'level=0|class=Cleric', count: 1 }] } },
      ]),
    ])
    // The filter's class is read from the classes there are: the Cleric is one.
    mockClasses.mockResolvedValue([wizard, cleric])
    mockSpells.mockResolvedValue([guidance])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Wizard', source: 'PHB', level: 1 }]
      withFeat(ch, 'Magic Initiate')
    })
    renderSection()

    await screen.findByText('Spellcasting ability: Wisdom.')
    await choose(user, 'Cleric cantrip')
    await add(user, 'Magic Initiate Cleric cantrip', 'Guidance')
    const yours = rowOf('Your spells', 'Guidance')
    expect(yours.getByText(/^Magic Initiate/)).toBeVisible()
    await user.click(yours.getByRole('button', { name: 'Remove' }))
    await waitFor(() =>
      expect(Object.values(active(c.id).spellGrants).flatMap((g) => g.picks)).toEqual([]),
    )
  })

  it('shows choices kept for a source the character no longer has, and removes them', async () => {
    const user = userEvent.setup()
    mockSpells.mockResolvedValue([guidance])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Wizard', source: 'PHB', level: 1 }]
      ch.spellGrants = {
        'feat:gone:0:known:_:0:0': {
          picks: [{ name: 'Guidance', source: 'PHB', level: 0 }],
        },
      }
    })
    renderSection()

    expect(
      await screen.findByText(/Spells from something you no longer have:/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove all' }))
    await waitFor(() => expect(active(c.id).spellGrants).toEqual({}))
  })
})
