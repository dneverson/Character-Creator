// What the data audit of the defense rules (src/rules/defenseRules.test.ts) does not
// count, each with the reason: records of the book data whose text names a resistance, an
// immunity or a vulnerability that is not a standing defense of the character. Lists the
// audit checks both ways: a record named here must still match, and none may be a row.

const COLLECTIONS: Readonly<Record<string, string>> = {
  background: 'The word is in a personality table ("vulnerable to fear"), not a rule.',
  boon: 'A demonic boon a DM grants; the sheet does not model these.',
  book: 'A book entry that describes the book, not a rule of the character.',
  card: 'A card of a deck: one drawn effect, not a standing defense.',
  charoption:
    'A character option of a setting (a gift, a mark); the sheet has no model for them.',
  condition: 'The rules text of a condition: what a creature under it has, not a source.',
  cult: 'A cult of the DM-side boons; the sheet does not model these.',
  deity: 'A deity entry: lore, not a rule of the character.',
  disease: 'A disease a creature suffers: lore and effects, not a source of defenses.',
  encounter: 'An encounter table.',
  facility: 'A bastion facility: a rule of the stronghold, not of the character.',
  hazard: "A hazard of the world: its own defenses, not the character's.",
  itemEntry: 'A shared text block of an item, read through the item that uses it.',
  itemType: 'A category of items.',
  magicItems: 'A table of magic items by rarity.',
  object: "An object statistic block: the object's own defenses.",
  recipe: 'A recipe of a setting book.',
  spell:
    'A spell: its effects are not standing defenses (a spell that grants one lasts for a time).',
  table: 'A table of a book.',
  trap: "A trap of the world: its own defenses, not the character's.",
  variantrule:
    'A rule of the game that defines the terms, or a rule for stat blocks and ships.',
  vehicle: "A vehicle statistic block: the vehicle's own defenses.",
  vehicleUpgrade: 'An upgrade of a vehicle: its own defenses.',
}

export const DEFENSE_COLLECTIONS_EXCUSED = COLLECTIONS

/** Records of the holder collections that are not a standing defense, each with why. */
export const DEFENSE_TEXT_EXCUSED: Readonly<Record<string, string>> = {
  'classFeature|Ki-Empowered Strikes|PHB|Monk':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'classFeature|Totems|WoW|Shaman':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'feat|Cult of the Dragon Initiate|FRHoF':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'feat|Delicious Pain|ABH':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'feat|Elemental Adept|PHB':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'feat|Elemental Adept|XPHB':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'feat|Elemental Familiar|AU': "The defense is the familiar's, not the character's.",
  'feat|Fingers of Frost|WoW':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'feat|Gift of the Chromatic Dragon|FTD':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'feat|Guile of the Cloud Giant|BGG':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'feat|Hot Streak|WoW':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'feat|Otherworldly Familiar|AU': "The defense is the familiar's, not the character's.",
  'feat|Poisoner|TCE':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'feat|Poisoner|XPHB':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'feat|Spellfire Adept|FRHoF':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'itemGroup|Absorbing Tattoo|TCE':
    'A type chosen again at each rest or when the item is made, outside the character sheet.',
  'itemGroup|Armor of Resistance|DMG':
    'A type chosen again at each rest or when the item is made, outside the character sheet.',
  'itemGroup|Armor of Resistance|XDMG':
    'A type chosen again at each rest or when the item is made, outside the character sheet.',
  'itemGroup|Armor of Vulnerability|DMG':
    'An index of the items it lists; each of those items is audited as an item.',
  'itemGroup|Armor of Vulnerability|XDMG':
    'An index of the items it lists; each of those items is audited as an item.',
  'itemGroup|Ashen Bands of Courage|ICC':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'itemGroup|Breastplate of the Tyrant|AU':
    'An index of the items it lists; each of those items is audited as an item.',
  'itemGroup|Chromatic Rose|WBtW':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'itemGroup|Devastation Orb|PotA':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'itemGroup|Eye and Hand of Vecna|DMG':
    'An index of the items it lists; each of those items is audited as an item.',
  'itemGroup|Eye and Hand of Vecna|XDMG':
    'An index of the items it lists; each of those items is audited as an item.',
  'itemGroup|Horn of Valhalla|XDMG':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'itemGroup|Mace of the Black Crown|EGW':
    'An index of the items it lists; each of those items is audited as an item.',
  'itemGroup|Potion of Resistance|XDMG':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'itemGroup|Ring of Resistance|DMG':
    'A type chosen again at each rest or when the item is made, outside the character sheet.',
  'itemGroup|Ring of Resistance|XDMG':
    'A type chosen again at each rest or when the item is made, outside the character sheet.',
  'itemGroup|Stormgirdle|EGW':
    'An index of the items it lists; each of those items is audited as an item.',
  'itemGroup|True-Ice Shards|CoA':
    'An index of the items it lists; each of those items is audited as an item.',
  'item|+1 Wraps of Unarmed Prowess|BMT':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'item|+2 Wraps of Unarmed Prowess|BMT':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'item|+3 Wraps of Unarmed Prowess|BMT':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'item|Accounting and Valuation of All Things|CoA':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Amulet of Betrayal|CoA':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Amulet of the Inferno|CoA':
    'It overcomes or ignores a resistance or immunity of its target; it gives the character no defense.',
  'item|Apparatus of Kwalish|XDMG':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  "item|Arcanist's Bestiary|AU":
    'It tells the character what a creature resists or is immune to; it gives none.',
  'item|Banner of the Krig Rune|SKT':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'item|Battle Standard of Infernal Power|BGDIA':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  "item|Bigby's Beneficent Bracelet|BGG":
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Blackstaff|WDH':
    'A match inside another word or spell name (invulnerable, Globe of Invulnerability).',
  'item|Blade of Avernus|BGDIA':
    'It overcomes or ignores a resistance or immunity of its target; it gives the character no defense.',
  'item|Blight Ichor|EGW':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'item|Bridle of Capturing|IMR':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Claw of the Wyrm Rune|SKT':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'item|Condensed Order|CoA':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  "item|Constantori's Portrait|KftGV":
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  "item|Daern's Instant Fortress|DMG":
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  "item|Daern's Instant Fortress|XDMG":
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Dancing Monkey Fruit|ToA':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Devastation Orb of Air|PotA':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Devastation Orb of Earth|PotA':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Devastation Orb of Fire|PotA':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Devastation Orb of Water|PotA':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  "item|Devlin's Staff of Striking|ToA":
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Dreamlily|ERLW':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'item|Eldritch Claw Tattoo|TCE':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'item|Elemental Essence Shard (Earth)|TCE':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'item|Figurine of Wondrous Power, Ivory Goats|DMG':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Figurine of Wondrous Power, Ivory Goats|XDMG':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Fish Suit|AAG':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Flying Citadel Helm|DSotDQ':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Fool Card|BMT':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'item|Frostmourne|WoW':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'item|Glowrune Pigment|BGG':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Golden Idol of Good Fortunes|AU':
    'A match inside another word or spell name (invulnerable, Globe of Invulnerability).',
  'item|Horn of Valhalla, Brass|XDMG':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'item|Horn of Valhalla, Bronze|XDMG':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'item|Horn of Valhalla, Iron|XDMG':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'item|Horn of Valhalla, Silver|XDMG':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'item|House of Cards|BMT':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  "item|Iggwilv's Cauldron|WBtW":
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Infernal Puzzle Box|BGDIA':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Ioun Stone of Vitality|IMR':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Absorption|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Agility|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Awareness|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Fortitude|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Greater Absorption|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Historical Knowledge|LLK':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Insight|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Intellect|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Language Knowledge|LLK':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Leadership|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Mastery|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Natural Knowledge|LLK':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Protection|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Regeneration|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Religious Knowledge|LLK':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Reserve|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Self-Preservation|LLK':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Strength|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Supreme Intellect|LLK':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Ioun Stone, Sustenance|DMG':
    'The defense is of the stone, an object that orbits the head, not of the character.',
  'item|Jade Serpent Staff|WDMM':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  "item|Knave's Eye Patch|WDH":
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  "item|Lord's Ensemble|WDH":
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Lyre of Building|TCE':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  "item|Master's Amulet|MM":
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Mimir|SatO':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Mirror of Life Trapping|DMG':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Mirror of Life Trapping|XDMG':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Mirror of Reflected Pasts|DSotDQ':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Moonblade|DMG':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Mudslick Tower|PaBTSO':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  "item|Murgaxor's Orb|SCC":
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  "item|Namer's Needle|AU":
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Net|XPHB':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Nimbus Coronet|BGG':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'item|Orb of Damara|FRAiF':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Orcus Figurine|CM':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Paper Bird|WDH':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Pipes of Haunting|DMG':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Pipes of Haunting|XDMG':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Platinum Scarf|FTD':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'item|Potion of Aqueous Form|MOT':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'item|Protective Verses|TCE':
    'A match inside another word or spell name (invulnerable, Globe of Invulnerability).',
  'item|Pyxis of Pandemonium|MOT':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Reliquary of Dawn|LFL':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Reliquary of Twilight|LFL':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Ring of Mind Shielding|DMG':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Ring of Mind Shielding|XDMG':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Rod of the Sleepwalker|WoW':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Rope of Climbing|XDMG':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Rope of Entanglement|XDMG':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Ruby Rod of Asmodeus|CoA':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Shield Guardian Amulet|IDRotF':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Snicker-Snack|WBtW':
    'It overcomes or ignores a resistance or immunity of its target; it gives the character no defense.',
  'item|Somniferous Blossom Rod|AU':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Soul Coin|BGDIA':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Staff of Power|DMG':
    'A match inside another word or spell name (invulnerable, Globe of Invulnerability).',
  'item|Staff of Power|XDMG':
    'A match inside another word or spell name (invulnerable, Globe of Invulnerability).',
  'item|Staff of the Adder|XDMG':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Stone of Golorr|WDH':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Teeth of Dahlver-Nar|TCE':
    'One of several properties rolled or picked by the DM, not a fixed property of the item.',
  'item|The Incantations of Iriolarthas|IDRotF':
    'A match inside another word or spell name (invulnerable, Globe of Invulnerability).',
  'item|The Infernal Machine of Lum the Mad|IMR':
    'One of several properties rolled or picked by the DM, not a fixed property of the item.',
  'item|Tiny Abomination in a Jar|ICC':
    'A match inside another word or spell name (invulnerable, Globe of Invulnerability).',
  'item|True-Ice Shards (Dagger)|CoA':
    'It overcomes or ignores a resistance or immunity of its target; it gives the character no defense.',
  'item|True-Ice Shards (Rapier)|CoA':
    'It overcomes or ignores a resistance or immunity of its target; it gives the character no defense.',
  'item|Vithrak, Gaze of the Deadman|WoW':
    'It tells the character what a creature resists or is immune to; it gives none.',
  'item|Voidwalker Armor|BMT':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Wave|XDMG':
    'A match inside another word or spell name (invulnerable, Globe of Invulnerability).',
  'item|Weird Tank|PotA':
    'The defense is of an object, a structure, a summon or a trapped creature, not of the character.',
  'item|Will of the Talon (Dormant)|EGW':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Witchlight Vane|WBtW':
    'One of several properties rolled or picked by the DM, not a fixed property of the item.',
  'item|Wreath of the Prism (Dormant)|EGW':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'item|Wrought-Iron Tower|CoA':
    'It overcomes or ignores a resistance or immunity of its target; it gives the character no defense.',
  'item|Wyrmreaver Gauntlets|BGG':
    'A type chosen again at each rest or when the item is made, outside the character sheet.',
  'item|Wyrmskull Throne|SKT':
    'A match inside another word or spell name (invulnerable, Globe of Invulnerability).',
  'magicvariant|Acheron Blade|':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'magicvariant|Blade of the Medusa|':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'magicvariant|Glimmering Moonbow|':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'magicvariant|Polymorph Blade|':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'magicvariant|Silvered Ammunition|':
    'It overcomes or ignores a resistance or immunity of its target; it gives the character no defense.',
  'magicvariant|Silvered Weapon|':
    'It overcomes or ignores a resistance or immunity of its target; it gives the character no defense.',
  'magicvariant|Vorpal Sword|':
    'It overcomes or ignores a resistance or immunity of its target; it gives the character no defense.',
  'optionalfeature|Investment of the Chain Master|TCE':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'optionalfeature|Pact of the Blade|PHB':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'optionalfeature|Resistant Armor|TCE':
    'A type chosen again at each rest or when the item is made, outside the character sheet.',
  'optionalfeature|Tomb of Levistus|XGE':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'race|Tauren|WoW':
    'A trait of one version of the species whose text the sheet does not read; the version choice carries no defense row.',
  'race|Troglodyte|DMG':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'race|Worgen|WoW':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'reward|Boon of Immortality|DMG':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'reward|Charm of Cold Resistance|IDRotF':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'reward|Charm of the Snow Walker|IDRotF':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'reward|Charm of the Titan-Forged|WoW':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'reward|Darkspear Tribe Charm|WoW':
    'A match inside another word or spell name (invulnerable, Globe of Invulnerability).',
  'reward|Fragment of Abhorrence|CRCotN':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  "reward|Nylea's Disciple|MOT":
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'reward|Selesnya Charm|GGR':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Abjure Enemy|PHB|Paladin|Vengeance':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'subclassFeature|Among the Dead|SCAG|Warlock|Undying':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'subclassFeature|Ancestral Protectors|XGE|Barbarian|Ancestral Guardian':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'subclassFeature|Arcane Abeyance|EGW|Wizard|Chronurgy':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'subclassFeature|Arcane Ward|XPHB|Wizard|Abjurer':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'subclassFeature|Aspect of the Wyrm|FTD|Monk|Ascendant Dragon':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'subclassFeature|Bestial Soul|TCE|Barbarian|Beast':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'subclassFeature|Channel Divinity: Path to the Grave|XGE|Cleric|Grave':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'subclassFeature|Clockwork Cavalcade|TCE|Sorcerer|Clockwork Soul':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'subclassFeature|Clockwork Cavalcade|XPHB|Sorcerer|Clockwork':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'subclassFeature|Control Undead|DMG|Paladin|Oathbreaker':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'subclassFeature|Cutting Words|PHB|Bard|Lore':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'subclassFeature|Dampen Elements|PHB|Cleric|Nature':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Dispersion|WoW|Cleric|Shadow':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  "subclassFeature|Djinni's Escape|FRHoF|Paladin|Noble Genies":
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Draconic Presence|PHB|Sorcerer|Draconic':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'subclassFeature|Durable Summons|AU|Wizard|Conjurer':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'subclassFeature|Eldritch Cannon|TCE|Artificer|Artillerist':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'subclassFeature|Eldritch Strike|PHB|Fighter|Eldritch Knight':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'subclassFeature|Elemental Affinity|PHB|Sorcerer|Draconic':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Elemental Mastery|UATheMysticClass|Mystic|Wu Jen':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Envenom Weapons|XPHB|Rogue|Assassin':
    'It overcomes or ignores a resistance or immunity of its target; it gives the character no defense.',
  'subclassFeature|Exalted Champion|SCAG|Paladin|Crown':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Exceptional Training|PHB|Ranger|Beast Master':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'subclassFeature|Expansive Bond|TCE|Cleric|Peace':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  "subclassFeature|Genie's Vessel|TCE|Warlock|Genie":
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'subclassFeature|Grave Power|AU|Wizard|Necromancer':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'subclassFeature|Grave Touched|RHW|Warlock|Undead':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  "subclassFeature|Hunter's Lore|XPHB|Ranger|Hunter":
    'It tells the character what a creature resists or is immune to; it gives none.',
  "subclassFeature|Hunter's Sense|XGE|Ranger|Monster Slayer":
    'It overcomes or ignores a resistance or immunity of its target; it gives the character no defense.',
  'subclassFeature|Inescapable Destruction|DMG|Cleric|Death':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'subclassFeature|Instinctive Charm|PHB|Wizard|Enchantment':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'subclassFeature|Invincible Conqueror|XGE|Paladin|Conquest':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Know Your Enemy|XPHB|Fighter|Battle Master':
    'It tells the character what a creature resists or is immune to; it gives none.',
  'subclassFeature|Luminous Barrier|WoW|Cleric|Discipline':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Lunar Empowerment|DSotDQ|Sorcerer|Lunar':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Lunar Phenomenon|DSotDQ|Sorcerer|Lunar':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Magic Arrow|XGE|Fighter|Arcane Archer':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'subclassFeature|Manifest Echo|EGW|Fighter|Echo Knight':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'subclassFeature|Mighty Summoner|XGE|Druid|Shepherd':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'subclassFeature|Mote of Potential|TCE|Bard|Creation':
    'A match inside another word or spell name (invulnerable, Globe of Invulnerability).',
  'subclassFeature|Mystic Brew|WoW|Monk|Mystic Brews':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  "subclassFeature|Nature's Sanctuary|PHB|Druid|Land":
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'subclassFeature|One with the Blade|XGE|Monk|Kensei':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'subclassFeature|Perfected Bond|FTD|Ranger|Drakewarden':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Primal Strike|PHB|Druid|Moon':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'subclassFeature|Projected Ward|XPHB|Wizard|Abjurer':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  "subclassFeature|Pyromancer's Fury|PSK|Sorcerer|Pyromancer (PSK)":
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'subclassFeature|Rage of the Wilds|XPHB|Barbarian|Wild Heart':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Runeforging|WoW|Death Knight|Ebon Blade':
    'It overcomes or ignores a resistance or immunity of the target; it gives the character no defense.',
  'subclassFeature|Spectral Defense|XGE|Ranger|Horizon Walker':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Spirit Projection|VRGR|Warlock|Undead':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  "subclassFeature|Superior Hunter's Defense|XPHB|Ranger|Hunter":
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Swarming Dispersal|TCE|Ranger|Swarmkeeper':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  "subclassFeature|Transmuter's Stone|AU|Wizard|Transmuter":
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  "subclassFeature|Transmuter's Stone|PHB|Wizard|Transmutation":
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Umbral Form|RHW|Sorcerer|Shadow':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Umbral Form|XGE|Sorcerer|Shadow':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Undying Nature|SCAG|Warlock|Undying':
    'An immunity to one effect (a spell, a save result, a curse), not a damage or condition immunity the sheet shows.',
  'subclassFeature|Vestige Power|AU|Warlock|Vestige':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Warding Flare|PHB|Cleric|Light':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'subclassFeature|Warding Flare|PSA|Cleric|Ambition (PSA)':
    "The defense is a target's, an ally's, a summon's or an aura member's, not the character's own.",
  'subclassFeature|Wild Magic Surge|PHB|Sorcerer|Wild':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subclassFeature|Wild Magic Surge|XPHB|Sorcerer|Wild Magic':
    'Held only after an action, a bonus action or a reaction, for a limited time or while something is spent or consumed: not standing.',
  'subrace|undefined|PHB|Dragonborn':
    "The base Dragonborn entry only; its damage type is the base species' own pick.",
}
