import { describe, expect, it } from 'vitest'
import { readArmorBlocks, readWeaponBlocks } from '../derived/proficiencies'
import { dataDir, findIds, records, recordId, type Rec } from '../test/dataAudit'
import { PROFICIENCY_GRANTS, proficiencyGrantId } from './proficiencyGrants'

/** A feature that gives proficiency, or training, with armor, shields or weapons in text. */
const GRANTS_TEXT =
  /(proficien\w*|training)\b[^.]{0,60}\b(armor|shields?|weapons?|scimitars?|rapiers?|longswords?|shortswords?|hand crossbows?|firearms?|martial|simple)\b/i
const COLLECTIONS = [
  'classFeature',
  'subclassFeature',
  'optionalfeature',
  'race',
  'subrace',
  'feat',
  'background',
  'item',
] as const

/** A feature that gives proficiency with a tool or a language, or a language to know, in text. */
const GRANTS_TOOL_TEXT =
  /(proficien\w*|training)\b[^.]{0,60}\b(tools?|kits?|supplies|instruments?|utensils|gaming sets?|vehicles?)\b|\b(learn|know|speak|read|write)\b[^.]{0,40}\blanguages?\b|\blanguages? of your choice|proficien\w*[^.]{0,30}languages?\b|\b(one|two) (extra |additional )?languages?\b/i

/**
 * What the books say about proficiency with armor, weapons, tools and languages that the
 * sheet does not give as a standing proficiency, with the reason. A new book's grant
 * fails the audit until it is in PROFICIENCY_GRANTS or here.
 */
export const PROFICIENCY_NOT_GRANTED: Record<string, string> = {
  'classFeature|Weapon Mastery|XPHB|Barbarian':
    'a weapon mastery property, not a proficiency',
  'classFeature|Weapon Mastery|XPHB|Fighter':
    'a weapon mastery property, not a proficiency',
  'classFeature|Weapon Mastery|XPHB|Paladin':
    'a weapon mastery property, not a proficiency',
  'classFeature|Weapon Mastery|XPHB|Ranger':
    'a weapon mastery property, not a proficiency',
  'classFeature|Weapon Mastery|XPHB|Rogue':
    'a weapon mastery property, not a proficiency',
  'feat|Weapon Master|XPHB':
    'a weapon mastery property, not a proficiency, the pick is not stored',
  'classFeature|Deflect Missiles|PHB|Monk':
    'proficiency with the one attack, not a standing proficiency',
  'subclassFeature|Path of the Kensei|XGE|Monk|Kensei':
    'a pick the character makes that is not stored yet',
  'classFeature|Bonus Proficiencies|TCE|Expert Sidekick':
    'a sidekick, not a character of its own',
  'classFeature|Bonus Proficiencies|TCE|Spellcaster Sidekick':
    'a sidekick, not a character of its own',
  'classFeature|Bonus Proficiencies|TCE|Warrior Sidekick':
    'a sidekick, not a character of its own',
  'subclassFeature|Undead Thralls|PHB|Wizard|Necromancy':
    'the proficiency bonus of a summoned creature, not a proficiency',
  'feat|Defensive Duelist|XPHB':
    'the proficiency bonus added to armor class, not a proficiency',
  'feat|Tavern Brawler|PHB':
    'improvised weapons are not items, so they are not on the list of weapons',
  'item|Boomerang Shield|BMT':
    'a shield attack that needs shield proficiency, which is read from the class',
  'item|Horn of the Endless Maze|WDMM':
    'a requirement to use the item, not a proficiency it grants',
  'item|Horn of Valhalla, Brass|DMG':
    'a requirement to use the item, not a proficiency it grants',
  'item|Horn of Valhalla, Brass|XDMG':
    'a requirement to use the item, not a proficiency it grants',
  'item|Horn of Valhalla, Bronze|DMG':
    'a requirement to use the item, not a proficiency it grants',
  'item|Horn of Valhalla, Bronze|XDMG':
    'a requirement to use the item, not a proficiency it grants',
  'item|Horn of Valhalla, Iron|DMG':
    'a requirement to use the item, not a proficiency it grants',
  'item|Horn of Valhalla, Iron|XDMG':
    'a requirement to use the item, not a proficiency it grants',
  'optionalfeature|Pact of the Blade|XPHB':
    'the bonded weapon is a pick that is not stored yet',
  'race|Astral Elf|AAG':
    'a pick the character makes that is not stored yet (a trance gives a weapon or tool)',
  'race|Eladrin|MPMM':
    'a pick the character makes that is not stored yet (a trance gives a weapon or tool)',
  'race|Githyanki|MPMM':
    'a pick the character makes that is not stored yet (a long rest gives a weapon or tool)',
  'race|Sea Elf|MPMM':
    'a pick the character makes that is not stored yet (a trance gives a weapon or tool)',
  'race|Shadar-Kai|MPMM':
    'a pick the character makes that is not stored yet (a trance gives a weapon or tool)',
  'background|Variant Entertainer (Gladiator)|PHB':
    'inherits the tools of its base background',
  'classFeature|Spellcasting|TCE|Artificer':
    'a requirement to use a spellcasting focus, not a proficiency',
  'classFeature|Tool Expertise|TCE|Artificer':
    'doubles the bonus of a tool proficiency, not a proficiency',
  'subclassFeature|Channeler|RHW|Bard|Spirits':
    'a gaming set the character picks, a pick that is not stored yet',
  'subclassFeature|Blessings of Knowledge|PHB|Cleric|Knowledge':
    'two languages and two skills of their choice, a pick that is not stored yet',
  'subclassFeature|Channel Divinity: Knowledge of the Ages|PHB|Cleric|Knowledge':
    'a skill or tool for 10 minutes, not a standing proficiency',
  'subclassFeature|Blessings of Knowledge|FRHoF|Cleric|Knowledge':
    'an artisan tool and two skills of their choice, a pick that is not stored yet',
  'subclassFeature|Student of War|PHB|Fighter|Battle Master':
    'an artisan tool of their choice, a pick that is not stored yet',
  'subclassFeature|Student of War|XPHB|Fighter|Battle Master':
    'an artisan tool and a skill of their choice, a pick that is not stored yet',
  'subclassFeature|Bonus Proficiency|XGE|Fighter|Cavalier':
    'a skill or a language of their choice, a pick that is not stored yet',
  'subclassFeature|Bonus Proficiency|XGE|Fighter|Samurai':
    'a skill or a language of their choice, a pick that is not stored yet',
  'subclassFeature|Knightly Envoy|FRHoF|Fighter|Banneret':
    'a language of their choice, a pick that is not stored yet',
  'classFeature|Telepathy|UATheMysticClass|Mystic':
    'a telepathic ability, not a language',
  'subclassFeature|Breadth of Knowledge|UATheMysticClass|Mystic|Nomad':
    'proficiencies that change each long rest, a pick that is not stored yet',
  'classFeature|Deft Explorer|TCE|Ranger':
    'a skill expertise and two languages of their choice, a pick that is not stored yet',
  'classFeature|Deft Explorer|XPHB|Ranger':
    'a skill expertise and two languages of their choice, a pick that is not stored yet',
  'classFeature|Favored Enemy|PHB|Ranger':
    'a language of their choice, a pick that is not stored yet',
  'classFeature|Expertise|PHB|Rogue': 'expertise, which is read from the expertise table',
  'subclassFeature|Psychic Whispers|TCE|Rogue|Soulknife':
    'a telepathic ability, not a language',
  'classFeature|Sidekick Class|TCE|Expert Sidekick':
    'a sidekick, not a character of its own',
  'classFeature|Sidekick Class|TCE|Spellcaster Sidekick':
    'a sidekick, not a character of its own',
  'subclassFeature|Telepathic Speech|TCE|Sorcerer|Aberrant Mind':
    'a telepathic ability, not a language',
  'subclassFeature|Awakened Mind|PHB|Warlock|Great Old One':
    'a telepathic ability, not a language',
  'subclassFeature|The Third Eye|PHB|Wizard|Divination':
    'reading any language is not a language proficiency',
  'subclassFeature|The Third Eye|XPHB|Wizard|Diviner':
    'reading any language is not a language proficiency',
  'feat|Rune Shaper|BGG': 'a spell (Comprehend Languages), not a language',
  'optionalfeature|Fire Rune|TCE':
    'doubles the bonus of a tool proficiency, not a proficiency',
  'race|Dragonborn (Gem)|FTD': 'a telepathic ability, not a language',
  'race|Human (Kaladesh)|PSK':
    'its languages are in the text only; use a non-standard language pick',
  'race|Human (Zendikar)|PSZ':
    'its languages are in the text only; use a non-standard language pick',
  'race|Khoravar|EFA': 'a skill or tool of their choice, a pick that is not stored yet',
  'race|Skeleton|DMG': 'the languages known in life, not a grant',
  'race|Zombie|DMG': 'the languages known in life, not a grant',
  'race|Thri-kreen|AAG': 'how the languages are spoken, not a grant',
  'subrace|Amonkhet|PSA':
    'its languages are in the text only; use a non-standard language pick',
  'subrace|Vahadar|PSK':
    'its languages are in the text only; use a non-standard language pick',
}

describe('proficiency readers', () => {
  it('reads armor words and blocks', () => {
    expect(
      readArmorBlocks(['light', { medium: true }, { proficiency: 'shield' }]),
    ).toEqual({
      grants: ['light', 'medium', 'shield'],
      unknown: [],
    })
    expect(readArmorBlocks([{ weird: true }]).unknown).toEqual(['weird'])
  })

  it('reads weapon categories, named weapons and filters', () => {
    const read = readWeaponBlocks([
      'simple',
      { martial: true },
      '{@item scimitar|phb|scimitars}',
      { 'longsword|phb': true },
      { all: { fromFilter: 'type=martial weapon|property=light;finesse' } },
      { choose: { fromFilter: 'type=martial weapon', count: 1 } },
      'improvised',
    ])
    expect(read.unknown).toEqual([])
    expect(read.grants).toEqual([
      { category: 'simple' },
      { category: 'martial' },
      { name: 'scimitar' },
      { name: 'longsword' },
      { category: 'martial', anyProperty: ['L', 'F'] },
    ])
  })

  it('reports a key it does not know', () => {
    expect(readWeaponBlocks(['trebuchet']).unknown).toEqual(['trebuchet'])
  })
})

describe.skipIf(!dataDir)('proficiency grants against the data', () => {
  const dir = dataDir ?? ''
  const rowIds = new Set(PROFICIENCY_GRANTS.map(proficiencyGrantId))

  it('grants or explains every feature that gives armor or weapon proficiency in text', () => {
    // A record that lists its proficiencies as data is read from there, not from its text.
    const structured = (r: Rec) =>
      !!r.armorProficiencies || !!r.weaponProficiencies || r.grantsProficiency === true
    const found = findIds(
      dir,
      COLLECTIONS,
      (text, r) => !structured(r) && GRANTS_TEXT.test(text),
    )
    const unknown = [...found].filter(
      (id) => !rowIds.has(id) && !(id in PROFICIENCY_NOT_GRANTED),
    )
    expect(unknown).toEqual([])
  })

  it('grants or explains every feature that gives a tool or a language in text', () => {
    const structured = (r: Rec) =>
      !!r.toolProficiencies ||
      !!r.languageProficiencies ||
      !!r.skillToolLanguageProficiencies ||
      !!r.startingProficiencies
    // An item's text describes what the tool is for, not what it grants.
    const found = findIds(
      dir,
      COLLECTIONS.filter((c) => c !== 'item'),
      (text, r) => !structured(r) && GRANTS_TOOL_TEXT.test(text),
    )
    const unknown = [...found].filter(
      (id) => !rowIds.has(id) && !(id in PROFICIENCY_NOT_GRANTED),
    )
    expect(unknown).toEqual([])
  })

  it('has every row of the table present in the data', () => {
    const all = new Set(
      records(dir).map(({ collection, record }) => recordId(collection, record)),
    )
    expect([...rowIds].filter((id) => !all.has(id))).toEqual([])
  })

  it('reads every armor and weapon list of the classes, species and feats', () => {
    const unknown: string[] = []
    for (const { collection, record } of records(dir)) {
      if (!['class', 'race', 'subrace', 'feat'].includes(collection)) continue
      const start = record.startingProficiencies
      const multi = (
        record.multiclassing as { proficienciesGained?: unknown } | undefined
      )?.proficienciesGained
      for (const block of [start, multi, record]) {
        if (!block || typeof block !== 'object') continue
        const b = block as Record<string, unknown>
        for (const key of ['armor', 'armorProficiencies']) {
          if (Array.isArray(b[key])) {
            unknown.push(
              ...readArmorBlocks(b[key]).unknown.map(
                (k) => `${recordId(collection, record)} armor ${k}`,
              ),
            )
          }
        }
        for (const key of ['weapons', 'weaponProficiencies']) {
          if (Array.isArray(b[key])) {
            unknown.push(
              ...readWeaponBlocks(b[key]).unknown.map(
                (k) => `${recordId(collection, record)} weapon ${k}`,
              ),
            )
          }
        }
      }
    }
    expect(unknown).toEqual([])
  })
})
