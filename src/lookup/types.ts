// What Quick lookup searches: one row for every entry of the loaded content, whatever
// kind it is. A row keeps the entry as its own dataset reads it (a spell, an item), so
// the detail pane can draw it with that dataset's own description.

import type { ClassRow } from '../components/editor/classRows'
import type { Edition } from '../data/edition'
import type { Feat } from '../data/feats'
import type { Item } from '../data/items'
import type { PlayableBackground } from '../data/background'
import type { PlayableRace } from '../data/race'
import type { Reward } from '../data/rewards'
import type { Spell } from '../data/spells'
import type { Entry } from '../text/Entries'

/** Every kind of entry the lookup holds, in the order the kind filter lists them. */
export const LOOKUP_KINDS = [
  'spell',
  'item',
  'race',
  'background',
  'feat',
  'class',
  'subclass',
  'classFeature',
  'subclassFeature',
  'optionalFeature',
  'condition',
  'disease',
  'status',
  'action',
  'sense',
  'skill',
  'language',
  'variantRule',
  'reward',
  'deity',
  'trap',
  'hazard',
  'cult',
  'boon',
  'characterOption',
  'psionic',
  'facility',
  'vehicleUpgrade',
  'table',
] as const

export type LookupKind = (typeof LOOKUP_KINDS)[number]

/** What a kind is called, as a table cell and a filter option say it. */
export const KIND_LABELS: Record<LookupKind, string> = {
  spell: 'Spell',
  item: 'Item',
  race: 'Race or species',
  background: 'Background',
  feat: 'Feat',
  class: 'Class',
  subclass: 'Subclass',
  classFeature: 'Class feature',
  subclassFeature: 'Subclass feature',
  optionalFeature: 'Optional feature',
  condition: 'Condition',
  disease: 'Disease',
  status: 'Status',
  action: 'Action',
  sense: 'Sense',
  skill: 'Skill',
  language: 'Language',
  variantRule: 'Variant rule',
  reward: 'Reward',
  deity: 'Deity',
  trap: 'Trap',
  hazard: 'Hazard',
  cult: 'Cult',
  boon: 'Boon',
  characterOption: 'Character option',
  psionic: 'Psionic',
  facility: 'Bastion facility',
  vehicleUpgrade: 'Vehicle upgrade',
  table: 'Table',
}

/** An entry with no dataset of its own: a name, a few labelled facts and its text. */
export interface TextSubject {
  name: string
  source: string
  edition?: Edition
  page?: number
  facts: { label: string; value: string }[]
  entries: Entry[]
}

/** The entry of a row, in the form its own dataset reads it. */
export type Subject =
  | { type: 'spell'; value: Spell }
  | { type: 'item'; value: Item }
  | { type: 'race'; value: PlayableRace }
  | { type: 'background'; value: PlayableBackground }
  | { type: 'feat'; value: Feat }
  | { type: 'reward'; value: Reward }
  | { type: 'class'; value: ClassRow }
  | { type: 'text'; value: TextSubject }

export interface LookupRow {
  /** Unique across the lookup: the kind and the entry's own key. */
  id: string
  kind: LookupKind
  name: string
  /** Where a name alone is not enough ("Druid 2" for a class feature). */
  context?: string
  source: string
  edition?: Edition
  subject: Subject
}
