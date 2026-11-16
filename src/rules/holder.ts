// Who can hold a rule of the hand-written tables: the data identity of the feat, race,
// class or subclass feature, option or item that carries the rule in its text. Every
// table row names its holder, so a row is found in the data by the same address.

export type Holder =
  | { feat: string }
  | { race: { baseName: string; source: string; subraceName?: string; trait?: string } }
  | { classFeature: { className: string; source: string; name: string } }
  | {
      subclassFeature: {
        className: string
        shortName: string
        /** The feature's book: the subclass's, but for an optional feature of another. */
        source: string
        /** The feature's own name; its book is the subclass's. */
        name: string
      }
    }
  /** A 2014 optional feature the player picked (a fighting style), by "Name|Source". */
  | { option: string }
  /** An item of the catalog, by its key "Name|Source". */
  | { item: string }
  /** Any item made from a generic variant (Holy Avenger), by the variant's name. */
  | { variant: string }
  /** A supernatural gift of the rewards file (a blessing, a boon), by "Name|Source". */
  | { reward: string }

/** The data identity of a holder: collection, name and source, as the data audit finds it. */
export function holderId(holder: Holder): string {
  if ('feat' in holder) {
    const [name, source] = holder.feat.split('|')
    return `feat|${name}|${source}`
  }
  if ('race' in holder) {
    const r = holder.race
    return r.subraceName
      ? `subrace|${r.subraceName}|${r.source}|${r.baseName}`
      : `race|${r.baseName}|${r.source}`
  }
  if ('classFeature' in holder) {
    const c = holder.classFeature
    return `classFeature|${c.name}|${c.source}|${c.className}`
  }
  if ('subclassFeature' in holder) {
    const s = holder.subclassFeature
    return `subclassFeature|${s.name}|${s.source}|${s.className}|${s.shortName}`
  }
  if ('option' in holder) return `optionalfeature|${holder.option}`
  if ('reward' in holder) return `reward|${holder.reward}`
  if ('variant' in holder) return `magicvariant|${holder.variant}|`
  return `item|${holder.item}`
}

/** The name of the feature, option, gift, item or feat a holder is, as the sheet shows it. */
export function holderName(holder: Holder): string {
  if ('feat' in holder) return holder.feat.split('|')[0]
  if ('race' in holder) return holder.race.subraceName ?? holder.race.baseName
  if ('classFeature' in holder) return holder.classFeature.name
  if ('subclassFeature' in holder) return holder.subclassFeature.name
  if ('option' in holder) return holder.option.split('|')[0]
  if ('reward' in holder) return holder.reward.split('|')[0]
  if ('variant' in holder) return holder.variant
  return holder.item.split('|')[0]
}
