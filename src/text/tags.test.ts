import { describe, expect, it } from 'vitest'
import { stripTags } from './tags'

describe('stripTags', () => {
  it('shows the display override or primary text for reference tags', () => {
    expect(stripTags('Cast {@spell fireball}')).toBe('Cast fireball')
    expect(stripTags('{@spell fireball|phb|fire ball}')).toBe('fire ball')
    expect(stripTags('a {@item longsword|phb}')).toBe('a longsword')
    expect(stripTags('{@condition prone}')).toBe('prone')
    expect(stripTags('{@skill Stealth}')).toBe('Stealth')
  })

  it('shows the display text of a card, which is the fourth part', () => {
    expect(stripTags('{@card Fool|Deck of Many Things|DMG}')).toBe('Fool')
    expect(stripTags('{@card Fool|Deck of Many Things|DMG|the Fool}')).toBe('the Fool')
  })

  it('handles dice and damage', () => {
    expect(stripTags('deals {@damage 2d6} fire')).toBe('deals 2d6 fire')
    expect(stripTags('roll {@dice 1d20+5}')).toBe('roll 1d20+5')
  })

  it('handles combat shorthands', () => {
    expect(stripTags('{@atk mw} {@hit 5} to hit')).toBe('Melee Weapon Attack: +5 to hit')
    expect(stripTags('{@hit +10} and {@hit -1} and {@hit 0}')).toBe('+10 and -1 and +0')
    expect(stripTags('{@h}7 damage')).toBe('Hit: 7 damage')
    expect(stripTags('save {@dc 15}')).toBe('save DC 15')
  })

  it('resolves nested tags', () => {
    expect(stripTags('{@b {@i strong}}')).toBe('strong')
  })

  it('passes through plain text', () => {
    expect(stripTags('no tags here')).toBe('no tags here')
  })

  it('formats chance, recharge, and negative hit bonuses', () => {
    expect(stripTags('{@chance 25} to escape')).toBe('25% to escape')
    expect(stripTags('{@recharge 5}')).toBe('(Recharge 5–6)')
    expect(stripTags('{@recharge}')).toBe('(Recharge 6)')
    expect(stripTags('{@hit -2} to hit')).toBe('-2 to hit')
  })

  it('shows the first part for book/adventure references', () => {
    expect(stripTags('see {@book Player Handbook|PHB}')).toBe('see Player Handbook')
    expect(stripTags('{@footnote note text|extra}')).toBe('note text')
  })

  it('falls back to the raw kind for an unknown attack code', () => {
    expect(stripTags('{@atk weird}')).toBe('weird')
    expect(stripTags('{@atk mw,weird}')).toBe('mw,weird')
  })

  it('joins several attack kinds, with the colon of the printed books', () => {
    expect(stripTags('{@atk mw,rw}')).toBe('Melee or Ranged Weapon Attack:')
    expect(stripTags('{@atk ms,rs}')).toBe('Melee or Ranged Spell Attack:')
    expect(stripTags('{@atk m,r}')).toBe('Melee or Ranged Attack:')
    expect(stripTags('{@atk mw,rs}')).toBe('Melee Weapon Attack or Ranged Spell Attack:')
    expect(stripTags('{@atkr m}')).toBe('Melee Attack Roll:')
    expect(stripTags('{@atkr r}')).toBe('Ranged Attack Roll:')
    expect(stripTags('{@atkr m,r}')).toBe('Melee or Ranged Attack Roll:')
  })

  it('prints the labels of the 2024 actions', () => {
    expect(stripTags('{@actSave con} DC 12')).toBe('Constitution Saving Throw: DC 12')
    expect(stripTags('{@actSave odd}')).toBe('odd')
    expect(stripTags('{@actSaveFail}')).toBe('Failure:')
    expect(stripTags('{@actSaveFail 2}')).toBe('Second Failure:')
    expect(stripTags('{@actSaveFailBy 5}')).toBe('Failure by 5 or More:')
    expect(stripTags('{@actSaveSuccess}')).toBe('Success:')
    expect(stripTags('{@actSaveSuccessOrFail}')).toBe('Failure or Success:')
    expect(stripTags('{@actTrigger} x {@actResponse} y')).toBe('Trigger: x Response: y')
    expect(stripTags('{@h}1 {@m}2 {@hom}3')).toBe('Hit: 1 Miss: 2 Hit or Miss: 3')
    expect(stripTags('{@hitYourSpellAttack} to hit')).toBe(
      'your spell attack modifier to hit',
    )
    expect(stripTags('{@hitYourSpellAttack Bonus equals it}')).toBe('Bonus equals it')
    expect(stripTags('DC equals {@dcYourSpellSave}')).toBe('DC equals your spell save DC')
  })

  it('prints a bonus with its sign and an ability with its modifier', () => {
    expect(stripTags('{@d20 4} {@d20 +8} {@d20 -1}')).toBe('+4 +8 -1')
    expect(stripTags('{@skillCheck athletics 4}')).toBe('+4')
    expect(stripTags('{@savingThrow con 3}')).toBe('+3')
    expect(stripTags('{@ability str 20}')).toBe('STR 20 (+5)')
    expect(stripTags('{@ability con 10|+0}')).toBe('CON 10 (+0)')
    expect(stripTags('{@hit 5|plus five}')).toBe('plus five')
  })

  it('prints the increase of a scaling roll, not its level range', () => {
    expect(stripTags('{@scaledamage 1d6|1-9|2d6}')).toBe('2d6')
    expect(stripTags('{@scaledice 1d8|1-7|1d8|psi}')).toBe('1d8')
  })

  it('reads the display text from the part that holds it', () => {
    expect(stripTags('{@deity Silvanus|Faerûnian|SCAG}')).toBe('Silvanus')
    expect(stripTags('{@deity Vesh|Exandria|EGW|Vesh, the Bloody Siren}')).toBe(
      'Vesh, the Bloody Siren',
    )
    expect(stripTags('{@subclass Alchemist|Artificer|EFA|EFA}')).toBe('Alchemist')
    expect(stripTags("{@subclass Berserker|Barbarian|XPHB|XPHB|Berserker's}")).toBe(
      "Berserker's",
    )
    expect(stripTags('{@quickref Vision and Light||2||dim light}')).toBe('dim light')
    expect(stripTags('{@quickref difficult terrain||3}')).toBe('difficult terrain')
    expect(stripTags('{@adventure table|AUD|3|Key NPCs}')).toBe('table')
    expect(stripTags('{@chance 10|10 percent chance}')).toBe('10 percent chance')
    expect(stripTags('{@recharge 6}')).toBe('(Recharge 6)')
    expect(stripTags('{@area chapter 2|090|x}')).toBe('chapter 2')
    expect(stripTags('{@unit 1|egg|eggs} {@unit 3|egg|eggs}')).toBe('egg eggs')
    expect(stripTags('{@crochet Soul Coin Coaster||Soul Coin Coasters}')).toBe(
      'Soul Coin Coasters',
    )
  })

  it('coerces non-string input to a string', () => {
    expect(stripTags(42 as unknown as string)).toBe('42')
  })

  it('shows the name of a class or subclass feature, not its class or book', () => {
    expect(stripTags('{@classFeature Action Surge|Fighter|PHB|2}')).toBe('Action Surge')
    expect(stripTags('{@classFeature Action Surge|Fighter|PHB|2|PHB|surge}')).toBe(
      'surge',
    )
    expect(
      stripTags('{@subclassFeature Improved Critical|Fighter|PHB|Champion|PHB|3}'),
    ).toBe('Improved Critical')
    expect(
      stripTags(
        '{@subclassFeature Improved Critical|Fighter|PHB|Champion|PHB|3|PHB|crits}',
      ),
    ).toBe('crits')
  })
})
