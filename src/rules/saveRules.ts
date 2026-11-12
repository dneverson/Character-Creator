// What changes a saving throw that the data gives in text only: the saving throw
// proficiencies a class feature grants (Diamond Soul, Slippery Mind) and the bonus an aura
// adds to every save (Aura of Protection). The saving throws a class starts with and a feat
// such as Resilient grants are data and are read from it. Each row names its holder, so the
// audit in saveRules.test.ts can tell a feature that is covered from one a book added.

import type { AbilityKey } from '../dice/dice'
import type { Holder } from './holder'

export type SaveEffect =
  /** Proficiency in the saving throws of these abilities. */
  | { kind: 'proficiency'; abilities: readonly AbilityKey[] }
  /** The modifier of an ability added to every saving throw, at least `min`. */
  | { kind: 'abilityMod'; ability: AbilityKey; min: number }

export interface SaveRule {
  holder: Holder
  label: string
  text: string
  effect: SaveEffect
}

const classFeature = (className: string, source: string, name: string): Holder => ({
  classFeature: { className, source, name },
})

const ALL: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export const SAVE_RULES: readonly SaveRule[] = [
  {
    holder: classFeature('Monk', 'PHB', 'Diamond Soul'),
    label: 'Diamond Soul',
    text: 'Diamond Soul: you gain proficiency in all saving throws.',
    effect: { kind: 'proficiency', abilities: ALL },
  },
  {
    holder: classFeature('Monk', 'XPHB', 'Disciplined Survivor'),
    label: 'Disciplined Survivor',
    text: 'Disciplined Survivor: you gain proficiency in all saving throws.',
    effect: { kind: 'proficiency', abilities: ALL },
  },
  {
    holder: classFeature('Rogue', 'PHB', 'Slippery Mind'),
    label: 'Slippery Mind',
    text: 'Slippery Mind: you gain proficiency in Wisdom saving throws.',
    effect: { kind: 'proficiency', abilities: ['wis'] },
  },
  {
    holder: classFeature('Rogue', 'XPHB', 'Slippery Mind'),
    label: 'Slippery Mind',
    text: 'Slippery Mind: you gain proficiency in Wisdom and Charisma saving throws.',
    effect: { kind: 'proficiency', abilities: ['wis', 'cha'] },
  },
  {
    holder: classFeature('Paladin', 'PHB', 'Aura of Protection'),
    label: 'Aura of Protection',
    text: 'Aura of Protection: you add your Charisma modifier (minimum +1) to every saving throw you make.',
    effect: { kind: 'abilityMod', ability: 'cha', min: 1 },
  },
  {
    holder: classFeature('Paladin', 'XPHB', 'Aura of Protection'),
    label: 'Aura of Protection',
    text: 'Aura of Protection: you add your Charisma modifier (minimum +1) to every saving throw you make.',
    effect: { kind: 'abilityMod', ability: 'cha', min: 1 },
  },
]
