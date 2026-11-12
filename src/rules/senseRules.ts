// The senses that something the character holds gives and the data states in text only.
// The senses of a species and of a feat are data and are read from it.

import type { Holder } from './holder'

export interface SenseRule {
  holder: Holder
  label: string
  text: string
  sense: 'darkvision' | 'blindsight' | 'truesight' | 'tremorsense'
  range: number
}

export const SENSE_RULES: readonly SenseRule[] = [
  {
    holder: { option: 'Blind Fighting|TCE' },
    label: 'Blind Fighting',
    text: 'Blind Fighting: you have blindsight with a range of 10 feet.',
    sense: 'blindsight',
    range: 10,
  },
]
