import { describe, expect, it } from 'vitest'
import { dataDir, findIds, records, recordId, textOf } from '../test/dataAudit'
import { AC_RULES, acRuleId } from './acRules'

/** The features and species whose text changes the armor class (not items). */
const AC_TEXT =
  /(your (base )?(AC|armor class)\b|(AC|armor class) (equals|is|becomes|increases)|bonus to (your )?(AC|armor class)|(AC|armor class) bonus|\+\d+ (bonus )?to (your )?(AC|armor class)|(AC|armor class) of \d+)/i
const NON_ITEMS = [
  'feat',
  'race',
  'subrace',
  'classFeature',
  'subclassFeature',
  'optionalfeature',
  'background',
  'charoption',
] as const

/** An item that sets the base in text only (a tattoo, a robe). */
const AC_FORMULA =
  /(your (base )?(AC|armor class)\b[^.]{0,60}(equals?|is|becomes)|(base|your) (AC|armor class) (equals?|is|becomes)|(AC|armor class) (equals|becomes)|(AC|armor class) of \d+|base AC|AC (is|becomes) \d+|set your AC)/i

/** A structured armor class bonus that holds only in some way of dressing or fighting. */
const AC_CONDITION =
  /reaction|aren't|are not|no armor|no shield|not using|if |when |unless|only|action/i

/**
 * Everything the books say about armor class that the sheet does not add to the number,
 * each with the reason, so a new book's rule cannot slip in unseen.
 */
export const AC_NOT_APPLIED: Record<string, string> = {
  'charoption|Gathered Whispers|VRGR': 'a reaction in play, not a standing number',
  'feat|Gathered Whispers|RHW': 'a reaction in play, not a standing number',
  'feat|Defensive Duelist|PHB': 'a reaction in play, not a standing number',
  'feat|Defensive Duelist|XPHB': 'a reaction in play, not a standing number',
  'feat|Mythal Touched|FRHoF':
    'a roll on a table of effects, 1 minute, not a standing number',
  'feat|Shield Master|PHB':
    'adds the shield to Dexterity saving throws, not to armor class',
  'subclassFeature|Defensive Flourish|XGE|Bard|Swords':
    'a bonus after a flourish, until the start of the next turn',
  'subclassFeature|Agile Parry|XGE|Monk|Kensei':
    'lasts a turn or a rage or a spell, not a standing number',
  'subclassFeature|Soul Knife|UATheMysticClass|Mystic|Soul Knife':
    'a bonus action parry, until the start of the next turn',
  'subclassFeature|Multiattack Defense|PHB|Ranger|Hunter':
    'against the one creature that hit you, for the rest of the turn',
  'subclassFeature|Dashing Strikes|WoW|Rogue|Swashbuckler':
    'against the creature you attacked, for the rest of the turn',
  'subclassFeature|Arcane Deflection|XGE|Wizard|War':
    'a reaction in play, not a standing number',
  'subclassFeature|Glorious Defense|XPHB|Paladin|Glory':
    'a reaction in play, not a standing number',
  'optionalfeature|Bait and Switch|TCE':
    'a maneuver that lasts until the start of the next turn',
  'optionalfeature|Bait and Switch|XPHB':
    'a maneuver that lasts until the start of the next turn',
  'optionalfeature|Evasive Footwork|PHB': 'a maneuver that lasts while you move',
  'optionalfeature|Evasive Footwork|XPHB': 'a maneuver that lasts while you move',
  'subclassFeature|Form of the Beast|TCE|Barbarian|Beast':
    'only while raging in a form; rage is not tracked',
  'subclassFeature|Wild Surge|TCE|Barbarian|Wild Magic':
    'one result of a table, until the rage ends',
  'subclassFeature|Wild Magic Surge|PHB|Sorcerer|Wild': 'one result of a table, 1 minute',
  'subclassFeature|Wild Magic Surge|XPHB|Sorcerer|Wild Magic':
    'one result of a table, 1 minute',
  'subclassFeature|Circle Forms|XPHB|Druid|Moon':
    'only while in a Wild Shape form, which has its own armor class',
  'subclassFeature|Wrath of the Wild|RHW|Ranger|Hollow Warden':
    'a bonus while a Wild Shape-like state lasts',
  'subclassFeature|Awakened Astral Self|TCE|Monk|Astral Self':
    'only while the Astral Arms are summoned, with its own armor class',
  'subclassFeature|Experimental Elixir|EFA|Artificer|Alchemist':
    'a potion that lasts 10 minutes, not a standing number',
  'subclassFeature|Experimental Elixir|TCE|Artificer|Alchemist':
    'a potion that lasts 10 minutes, not a standing number',
  'subclassFeature|Bladesong|TCE|Wizard|Bladesinging':
    'only while the Bladesong lasts (1 minute, a bonus action); shown as an active state, not a standing number',
  'subclassFeature|Bladesong|FRHoF|Wizard|Bladesinger':
    'only while the Bladesong lasts (1 minute, a bonus action); shown as an active state, not a standing number',
  'subclassFeature|Durable Magic|XGE|Wizard|War':
    'only while a spell is held with concentration',
  'subclassFeature|Improved Defender|TCE|Artificer|Battle Smith':
    'the armor class of the Steel Defender, a creature of its own',
  'classFeature|Improved Defense|TCE|Warrior Sidekick':
    'the armor class of a sidekick, a creature of its own',
  'subclassFeature|Eldritch Cannon|TCE|Artificer|Artillerist':
    'the armor class of the cannon, an object of its own',
  "subclassFeature|Genie's Vessel|TCE|Warlock|Genie":
    'the armor class of the vessel, an object of its own',
  'subclassFeature|Blessing of the Forge|XGE|Cleric|Forge':
    'the +1 is on one item the player makes magic each day; which item is not stored',
  'optionalfeature|Enhanced Defense|TCE':
    'an infusion on one item; which item is infused is not stored',
  'optionalfeature|Repulsion Shield|TCE':
    'an infusion on one shield; which shield is infused is not stored',
  'race|Shifter|EFA': 'only while shifted, which is not tracked',
  'race|Shifter|MPMM': 'only while shifted, which is not tracked',
  'subrace|Beasthide|ERLW': 'only while shifted, which is not tracked',
  'race|Tauren|WoW': 'natural armor depends on a lineage the character does not store',
  'item|Deck of Many More Things|BMT': 'a card of the deck, not the wielder',
  'item|Paper Bird|WDH': 'the armor class of the bird, an object of its own',
  'item|Staff of the Adder|DMG':
    'the armor class of the snake head, an object of its own',
  'item|Wrought-Iron Tower|CoA':
    'a standing +2 while attuned: read from the item\'s own bonus, the "bonus action" in its text is another property',
}

describe.skipIf(!dataDir)('armor class rules against the data', () => {
  const dir = dataDir ?? ''
  const rulesById = new Set(AC_RULES.map(acRuleId))

  const features = findIds(dir, NON_ITEMS, (text) => AC_TEXT.test(text))
  const items = findIds(
    dir,
    ['item', 'baseitem'],
    (text, r) => !r.bonusAc && AC_FORMULA.test(text),
  )
  const conditionalItems = new Set(
    records(dir).flatMap(({ collection, record }) => {
      if (collection !== 'item' || !record.bonusAc || record.armor || record.ac) return []
      const sentences = textOf(record).split(/(?<=[.!?])\s+|","/)
      const conditional = sentences.some(
        (s) =>
          /\b(AC|Armor Class)\b/i.test(s) &&
          /bonus|\+\d/i.test(s) &&
          AC_CONDITION.test(s),
      )
      return conditional ? [recordId(collection, record)] : []
    }),
  )

  it('applies or explains every feature, species and background that changes armor class', () => {
    const unknown = [...features].filter(
      (id) => !rulesById.has(id) && !(id in AC_NOT_APPLIED),
    )
    expect(unknown).toEqual([])
  })

  it('applies or explains every item that sets armor class in text', () => {
    const unknown = [...items].filter(
      (id) => !rulesById.has(id) && !(id in AC_NOT_APPLIED),
    )
    expect(unknown).toEqual([])
  })

  it('applies or explains every structured bonus that holds only conditionally', () => {
    const unknown = [...conditionalItems].filter(
      (id) => !rulesById.has(id) && !(id in AC_NOT_APPLIED),
    )
    expect(unknown).toEqual([])
  })

  it('has every rule of the table present in the data', () => {
    const all = new Set(
      records(dir).map(({ collection, record }) => recordId(collection, record)),
    )
    expect([...rulesById].filter((id) => !all.has(id))).toEqual([])
  })

  it('has no reason for a rule that is in the table too', () => {
    expect(Object.keys(AC_NOT_APPLIED).filter((id) => rulesById.has(id))).toEqual([])
  })
})
