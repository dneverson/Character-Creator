// The rewards whose text states a number or a limit the sheet does not carry, each with
// the reason. The audit in rewards.test.ts asks every reward of the data for a row in a
// rule table (hit points, speeds, senses, counters), the spell grants, or a line here.

export const REWARD_EXCUSED: Readonly<Record<string, string>> = {
  'reward|Blessing of Valhalla|DMG':
    'recharges after 7 days, which no rest restores; the text on the Features tab says so',
  'reward|Blessing of Valhalla|XDMG':
    'recharges after 7 days, which no rest restores; the text on the Features tab says so',
  'reward|Blessing of the Flying Companion|WoW':
    'holds only while a companion has a Loyalty Score of 10 or more, which the character does not record',
  'reward|Charm of Darkvision|DMG':
    'casts the darkvision spell three times; the spell grants count the casts',
  'reward|Charm of Darkvision|XDMG':
    'casts the darkvision spell; the spell grants count the casts',
}
