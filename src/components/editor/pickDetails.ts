// What a pick is, in the data's own words, so it can be read before it is picked:
// a skill's text, a tool's or weapon's item text, a language's script and speakers.
// One builder for every pick card that has no description of its own in its chips.

import type { PickChip, PickChipDetail } from '../../character/picks'
import type { Item } from '../../data/items'
import type { Language } from '../../data/languages'
import type { SkillTexts } from '../../data/skills'
import { editionYear } from '../../data/labels'
import type { Entry } from '../../text/Entries'
import { stripTags } from '../../text/tags'
import { damageText, damageTypeText } from './itemFacts'

export interface PickDetailData {
  items: readonly Item[]
  languages: readonly Language[]
  skills?: SkillTexts
}

const TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  exotic: 'Exotic',
  rare: 'Rare',
  secret: 'Secret',
}

/** The plain, non-magic items of this name (one per book), which is what a proficiency means. */
const plainItems = (items: readonly Item[], value: string) =>
  items.filter((i) => i.name.toLowerCase() === value && !i.magic && !i.variant)

/** The item's text, one block per edition when both editions print it. */
function itemText(found: readonly Item[]): Entry[] {
  const written = found.filter(
    (item, i) =>
      item.entries.length > 0 &&
      found.findIndex((o) => o.entries.length > 0 && o.edition === item.edition) === i,
  )
  if (written.length < 2) return written[0]?.entries ?? []
  return written.map((item) => ({
    type: 'entries',
    name: `${editionYear(item.edition)} rules`,
    entries: item.entries,
  }))
}

function itemDetail(found: readonly Item[]): PickChipDetail {
  const [item] = found
  const weapon = item.weapon
  const rules: Entry[] = (weapon?.properties ?? [])
    .filter((p) => p.rule)
    .map((p) => `${p.label}: ${p.rule}`)
  return {
    facts: [
      ...(item.category ? [{ label: 'Category', value: item.category }] : []),
      ...(weapon && damageText(item)
        ? [
            { label: 'Damage', value: damageText(item) },
            { label: 'Damage type', value: damageTypeText(item) },
          ].filter((fact) => fact.value !== '')
        : []),
      ...(weapon && weapon.properties.length > 0
        ? [
            {
              label: 'Properties',
              value: weapon.properties.map((p) => p.label).join(', '),
            },
          ]
        : []),
    ],
    entries: [
      ...itemText(found),
      ...(rules.length > 0 ? [{ type: 'list', items: rules }] : []),
    ],
  }
}

/** Who speaks a language, each once (the books word some alike once tags are gone). */
const speakersText = (speakers: readonly string[]) => {
  const seen = new Set<string>()
  return speakers
    .map(stripTags)
    .filter((name) => {
      const key = name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join(', ')
}

/** The detail of a chip from the loaded data, or none where the data has nothing to say. */
export function pickDetailOf(
  data: PickDetailData,
): (chip: PickChip) => PickChipDetail | undefined {
  return (chip) => {
    if (chip.kind === 'skill' || chip.kind === 'expertise') {
      const texts = data.skills?.get(chip.value)
      if (texts) {
        return {
          facts: [],
          entries:
            texts.length === 1
              ? texts[0].entries
              : texts.map((t) => ({
                  type: 'entries',
                  name: `${editionYear(t.edition)} rules`,
                  entries: t.entries,
                })),
        }
      }
    }
    if (chip.kind === 'tool' || chip.kind === 'weapon' || chip.kind === 'expertise') {
      const found = plainItems(data.items, chip.value)
      return found.length > 0 ? itemDetail(found) : undefined
    }
    if (chip.kind === 'language') {
      const language = data.languages.find((l) => l.name.toLowerCase() === chip.value)
      if (!language) return undefined
      return {
        facts: [
          {
            label: 'Type',
            value: [
              ...new Set(language.entries.map((e) => TYPE_LABELS[e.type] ?? e.type)),
            ].join(', '),
          },
          ...(language.script ? [{ label: 'Script', value: language.script }] : []),
          ...(language.speakers && language.speakers.length > 0
            ? [
                {
                  label: 'Typical speakers',
                  value: speakersText(language.speakers),
                },
              ]
            : []),
        ],
        entries: [],
      }
    }
    return undefined
  }
}
