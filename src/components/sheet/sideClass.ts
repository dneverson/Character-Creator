import type { DerivedSheet } from '../../derived'

/** The side column's class: it makes room for the Defenses box below the Senses when there is one. */
export const sideClass = (sheet: DerivedSheet) =>
  sheet.defenses.length > 0 ? 'sheet-side sheet-side--defenses' : 'sheet-side'
