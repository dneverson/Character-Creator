// The build checklist: what a character still needs before the build is complete, worked
// out once from the character and the loaded data. The editor marks each section with
// it (caution while something is open, a check when nothing is) and the Done window
// lists it. Nothing here blocks anything; it only says what is open and where.

import { ABILITIES } from '../dice/dice'
import { isSlotEmpty } from '../character/feats'
import type { Character } from '../character/model'
import type { PickCard } from '../character/picks'
import { characterCasters } from '../character/spellcasting'
import { resolveSpellGrants } from '../character/spellGrants'
import { cardGrantsOf, hasRoom, spellRooms } from '../character/spellTiers'
import { subclassesFor, subclassUnlockLevel } from '../data/class'
import type { OpenPick } from './grantBlocks'
import type { DeriveDeps, Sources } from './sources'

/** The creator's sections, top to bottom, with the heading each one gives itself. */
export const SECTION_TITLES = {
  books: 'Books',
  class: 'Class & Level',
  race: 'Race / Species',
  background: 'Background',
  abilities: 'Ability Scores',
  feats: 'Feats & Ability Score Improvements',
  skills: 'Skills',
  proficiencies: 'Proficiencies',
  hp: 'Hit Points',
  combat: 'Combat',
  spells: 'Spells',
  wildshape: 'Wild Shape',
  equipment: 'Equipment',
} as const

export type SectionId = keyof typeof SECTION_TITLES

/** Where an open item is fixed: a section, or the name at the top of the editor. */
export type ChecklistTarget = SectionId | 'name'

export interface ChecklistItem {
  id: string
  /** What is open, in words: "2 cantrips or spells not chosen". */
  label: string
  count: number
  section: ChecklistTarget
}

/** Caution while the section has something open; a check when it has and nothing is open. */
export type SectionStatus = 'open' | 'done'

export interface Checklist {
  items: ChecklistItem[]
  /** Only the sections the checklist can judge for this character have a status. */
  status: Partial<Record<SectionId, SectionStatus>>
}

/** What the sheet has worked out that the checklist counts. */
export interface ChecklistInputs {
  sources: Sources
  deps: DeriveDeps
  /** The picks the grants still wait for. */
  openPicks: OpenPick[]
  /** The skill cards and the expertise cards. */
  skills: PickCard[]
  expertise: PickCard[]
  /** The class option cards (fighting styles). */
  classOptions: PickCard[]
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

const sumLeft = (cards: PickCard[]) => cards.reduce((n, c) => n + c.left, 0)

const hasClass = (character: Character) => character.classes.some((c) => c.level > 0)

export function buildChecklist({
  sources,
  deps,
  openPicks,
  skills,
  expertise,
  classOptions,
}: ChecklistInputs): Checklist {
  const { character, summary } = sources
  const items: ChecklistItem[] = []
  const add = (id: string, section: ChecklistTarget, count: number, label: string) => {
    if (count > 0) items.push({ id, section, count, label })
  }

  add(
    'name',
    'name',
    character.name.trim() === 'New Character' ? 1 : 0,
    'Name your character',
  )
  add('class', 'class', hasClass(character) ? 0 : 1, 'Choose a class')
  add('race', 'race', character.race ? 0 : 1, 'Choose a race or species')
  add('background', 'background', character.background ? 0 : 1, 'Choose a background')

  const unassigned = ABILITIES.filter((key) => character.abilities[key].base === null)
  add(
    'abilities',
    'abilities',
    unassigned.length,
    `${plural(unassigned.length, 'ability score')} not assigned`,
  )

  const subclassDue = sources.classes.filter(
    ({ row, loaded, level }) =>
      loaded !== undefined &&
      !row.subclass &&
      level >= subclassUnlockLevel(loaded) &&
      subclassesFor(loaded).some((s) => character.selectedBooks.includes(s.source)),
  )
  add(
    'subclass',
    'class',
    subclassDue.length,
    `Subclass not chosen: ${subclassDue.map((c) => c.row.name).join(', ')}`,
  )

  const emptySlots = summary.slots.filter(isSlotEmpty)
  add(
    'feats',
    'feats',
    emptySlots.length,
    `${plural(emptySlots.length, 'feat slot')} empty`,
  )

  // A Skilled pick is a skill or a tool; its budget is on the skill card.
  const skillsLeft = sumLeft(skills) + sumLeft(expertise)
  const profsLeft = openPicks
    .filter(
      (o) =>
        !o.spec.kinds.includes('expertise') &&
        !o.spec.kinds.includes('skill') &&
        !o.spec.kinds.includes('save'),
    )
    .reduce((n, o) => n + o.left, 0)
  const savesLeft = openPicks
    .filter((o) => o.spec.kinds.includes('save'))
    .reduce((n, o) => n + o.left, 0)
  add('skills', 'skills', skillsLeft, `${plural(skillsLeft, 'skill choice')} to make`)
  add(
    'proficiencies',
    'proficiencies',
    profsLeft,
    `${plural(profsLeft, 'language, tool or weapon choice')} to make`,
  )
  add(
    'saves',
    'proficiencies',
    savesLeft,
    `${plural(savesLeft, 'saving throw choice')} to make`,
  )
  const optionsLeft = sumLeft(classOptions)
  add(
    'class-options',
    'combat',
    optionsLeft,
    `${plural(optionsLeft, 'class option')} to choose`,
  )

  const casters = characterCasters(character, deps.classByKey, summary.abilityBonus)
  const { grants } = resolveSpellGrants(character, {
    race: deps.race,
    background: deps.background,
    featSlots: summary.slots,
    classByKey: deps.classByKey,
  })
  const cardGrants = cardGrantsOf(grants, casters)
  const rooms = spellRooms(character, casters, cardGrants)
  const roomLeft = (ofClasses: boolean) =>
    rooms
      .filter((r) => r.id.startsWith('grant:') !== ofClasses)
      .filter(hasRoom)
      .reduce((n, r) => n + r.target - r.count, 0)
  const classLeft = roomLeft(true)
  const grantLeft = roomLeft(false)
  add(
    'spells',
    'spells',
    classLeft,
    `${plural(classLeft, 'cantrip or spell')} not chosen`,
  )
  add(
    'spell-grants',
    'spells',
    grantLeft,
    `${plural(grantLeft, 'spell')} to choose from what your species, feats or class give`,
  )

  const firstClass = sources.classes[0]?.loaded?.entry
  const starting = character.equipment.starting
  const owed = [
    firstClass?.startingEquipment?.defaultData?.length
      ? { which: 'class' as const, source: `${firstClass.name}|${firstClass.source}` }
      : undefined,
    deps.background?.startingEquipment?.length
      ? { which: 'background' as const, source: deps.background.key }
      : undefined,
  ].filter((o) => o !== undefined)
  const notTaken = owed.filter((o) => starting[o.which]?.source !== o.source)
  add(
    'equipment',
    'equipment',
    notTaken.length,
    `Starting equipment not taken: ${notTaken.map((o) => o.which).join(' and ')}`,
  )

  const opened = new Set(items.map((i) => i.section))
  // The sections that mean something for this character, so a check is not shown on one
  // with nothing to do (feats with no slot, spells for a Fighter).
  const applies: Partial<Record<SectionId, boolean>> = {
    class: true,
    race: true,
    background: true,
    abilities: true,
    feats: summary.slots.length > 0,
    skills: hasClass(character),
    proficiencies: hasClass(character),
    combat: classOptions.length > 0,
    spells: casters.length > 0 || cardGrants.some((g) => g.pick && !g.locked),
    equipment: owed.length > 0,
  }
  const status: Checklist['status'] = {}
  for (const id of Object.keys(applies) as SectionId[]) {
    if (opened.has(id)) status[id] = 'open'
    else if (applies[id]) status[id] = 'done'
  }
  return { items, status }
}
