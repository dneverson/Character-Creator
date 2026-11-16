// What the data audit of the standing rules (src/rules/standingRules.test.ts) does not
// count, each with the reason: records of the book data whose text gives the character
// advantage or disadvantage that is not a standing note of a saving throw, a skill or a
// death save. The audit checks both ways: a record named here must still match, and none
// may be a row.

/** Records of the holder collections that are not a standing note, each with why. */
export const STANDING_TEXT_EXCUSED: Readonly<Record<string, string>> = {
  'background|Fisher|GoS':
    'A check with a tool or with no skill named, so there is no skill row to put it on.',
  'classFeature|Countercharm|PHB|Bard':
    'Held only after an action, for a time or while something is used: not standing.',
  'feat|Boon of Communication|FRHoF': 'It removes a disadvantage; it gives no advantage.',
  'feat|Cohort of Chaos|SatO':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  'feat|Enclave Magic|FRHoF':
    'A check with a tool or with no skill named, so there is no skill row to put it on.',
  'item|Antitoxin|XPHB':
    'A consumable or a potion that works for a time once used; the sheet holds no used-up items.',
  'item|Ascendant Scaled Ornament|FTD':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  "item|Baba Yaga's Mortar and Pestle|TCE":
    'A check with a tool or with no skill named, so there is no skill row to put it on.',
  'item|Book of Vile Darkness|XDMG':
    'Held only after an action, for a time or while something is used: not standing.',
  'item|Charm of Plant Command|GoS':
    'Held only after an action, for a time or while something is used: not standing.',
  'item|Cursed Luckstone|GoS':
    'A use that gives advantage to one roll chosen in play, not a standing note.',
  'item|Deck of Many Things|XDMG':
    'One result of a random roll or draw, not a feature the character holds.',
  'item|Deck of Several Things|LLK':
    'One result of a random roll or draw, not a feature the character holds.',
  'item|Deck of Wonder|BMT':
    'One result of a random roll or draw, not a feature the character holds.',
  'item|Demonomicon of Iggwilv|XDMG':
    'Held only after an action, for a time or while something is used: not standing.',
  'item|Frostmourne|WoW':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  'item|Gloves of Soul Catching|CM':
    'A use that gives advantage to one roll chosen in play, not a standing note.',
  'item|Holy Symbol of Ravenkind|CoS':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  "item|Infiltrator's Key (Dormant)|EGW":
    'A check with a tool or with no skill named, so there is no skill row to put it on.',
  'item|Medal of the Maze|CRCotN':
    'Held only after an action, for a time or while something is used: not standing.',
  'item|Perfume of Bewitching|XDMG':
    'A consumable or a potion that works for a time once used; the sheet holds no used-up items.',
  'item|Perfume of Bewitching|XGE':
    'A consumable or a potion that works for a time once used; the sheet holds no used-up items.',
  'item|Perfume|XPHB':
    'A consumable or a potion that works for a time once used; the sheet holds no used-up items.',
  'item|Potion of Advantage|WBtW':
    'A consumable or a potion that works for a time once used; the sheet holds no used-up items.',
  'item|Potion of Aqueous Form|MOT':
    'A consumable or a potion that works for a time once used; the sheet holds no used-up items.',
  'item|Potion of Climbing|DMG':
    'A consumable or a potion that works for a time once used; the sheet holds no used-up items.',
  'item|Potion of Climbing|XDMG':
    'A consumable or a potion that works for a time once used; the sheet holds no used-up items.',
  'item|Potion of Polychromy|DitLCoT':
    'A consumable or a potion that works for a time once used; the sheet holds no used-up items.',
  'item|Shadowmourne|ICC':
    'Held only after an action, for a time or while something is used: not standing.',
  'item|Shard of Xeluan|KftGV':
    'Held only after an action, for a time or while something is used: not standing.',
  'item|Stirring Scaled Ornament|FTD':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  'item|The Infernal Machine of Lum the Mad|IMR':
    'One result of a random roll or draw, not a feature the character holds.',
  'item|Theki Root|EGW':
    'A consumable or a potion that works for a time once used; the sheet holds no used-up items.',
  'item|Wakened Scaled Ornament|FTD':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  'item|Wand of Binding|DMG':
    'Held only after an action, for a time or while something is used: not standing.',
  'item|War Horn of Valor|BGG':
    'Held only after an action, for a time or while something is used: not standing.',
  'optionalfeature|Cloud Rune|TCE':
    'Already a row of the class options in rules/optionEffects.ts.',
  'optionalfeature|Eldritch Mind|TCE':
    'Already a row of the class options in rules/optionEffects.ts.',
  'optionalfeature|Eldritch Mind|XPHB':
    'Already a row of the class options in rules/optionEffects.ts.',
  'optionalfeature|Extended Spell|XPHB':
    'Held only after an action, for a time or while something is used: not standing.',
  'optionalfeature|Frost Rune|TCE':
    'Already a row of the class options in rules/optionEffects.ts.',
  'optionalfeature|Hill Rune|TCE':
    'Already a row of the class options in rules/optionEffects.ts.',
  'optionalfeature|Stone Rune|TCE':
    'Already a row of the class options in rules/optionEffects.ts.',
  'optionalfeature|Storm Rune|TCE':
    'Already a row of the class options in rules/optionEffects.ts.',
  'race|Goliath|XPHB':
    'Held only after an action, for a time or while something is used: not standing.',
  'race|Kenku|MPMM':
    'A check with a tool or with no skill named, so there is no skill row to put it on.',
  'race|Kenku|VGM':
    'A check with a tool or with no skill named, so there is no skill row to put it on.',
  'race|Tortle|MPMM':
    'Held only after an action, for a time or while something is used: not standing.',
  'race|Tortle|TTP':
    'Held only after an action, for a time or while something is used: not standing.',
  'reward|Charm of the Black Rose|RHW':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Bladesong|FRHoF|Wizard|Bladesinger':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Bladesong|TCE|Wizard|Bladesinging':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Blessing of the Trickster|XPHB|Cleric|Trickery':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Elder Champion|PHB|Paladin|Ancients':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  'subclassFeature|Elegant Maneuver|XGE|Rogue|Swashbuckler':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Exalted Champion|SCAG|Paladin|Crown':
    'Held only after an action, for a time or while something is used: not standing.',
  "subclassFeature|Giant's Might|TCE|Fighter|Rune Knight":
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Holy Nimbus|PHB|Paladin|Devotion':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Holy Nimbus|XPHB|Paladin|Devotion':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Lunar Empowerment|DSotDQ|Sorcerer|Lunar':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Magical Ambush|PHB|Rogue|Arcane Trickster':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  'subclassFeature|Magical Ambush|XPHB|Rogue|Arcane Trickster':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  'subclassFeature|Peerless Athlete|TCE|Paladin|Glory':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Peerless Athlete|XPHB|Paladin|Glory':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Perfected Armor|EFA|Artificer|Armorer':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Spirit Totem|XGE|Druid|Shepherd':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Unbreakable Majesty|XGE|Bard|Glamour':
    'A roll of another creature, an ally or a target: not a roll of the character.',
  "subclassFeature|Watcher's Will|TCE|Paladin|Watchers":
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Wild Magic Surge|PHB|Sorcerer|Wild':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Zealous Presence|XGE|Barbarian|Zealot':
    'Held only after an action, for a time or while something is used: not standing.',
  'subclassFeature|Zealous Presence|XPHB|Barbarian|Zealot':
    'Held only after an action, for a time or while something is used: not standing.',
  'subrace|Ixalan|PSX|Vampire':
    'Held only after an action, for a time or while something is used: not standing.',
}
