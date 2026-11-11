// Who can hold a rule of the hand-written tables: the data identity of the feat, race,
// class or subclass feature, option or item that carries the rule in its text. Every
// table row names its holder, so a row is found in the data by the same address.

export type Holder =
  | { feat: string }
  | { race: { baseName: string; source: string; subraceName?: string } }
  | { classFeature: { className: string; source: string; name: string } }
  | {
      subclassFeature: {
        className: string
        shortName: string
        /** The subclass's book. */
        source: string
        /** The feature's own name; its book is the subclass's. */
        name: string
      }
    }
  /** A 2014 optional feature the player picked (a fighting style), by "Name|Source". */
  | { option: string }
  /** An item of the catalog, by its key "Name|Source". */
  | { item: string }

/** The data identity of a holder: collection, name and source, as the data audit finds it. */
export function holderId(holder: Holder): string {
  if ('feat' in holder) {
    const [name, source] = holder.feat.split('|')
    return `feat|${name}|${source}`
  }
  if ('race' in holder) {
    const r = holder.race
    return r.subraceName
      ? `subrace|${r.subraceName}|${r.source}`
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
  return `item|${holder.item}`
}
