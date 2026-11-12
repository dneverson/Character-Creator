// The tabs of the sheet's switching box, as data: add or reorder a tab here and nothing
// else changes. A tab whose content would be empty is not shown.

import type { ComponentType } from 'react'
import type { DerivedSheet } from '../derived'
import {
  ActionsPanel,
  CorePanel,
  NotBuiltPanel,
  SkillsTabPanel,
  type SheetPanelProps,
} from '../components/sheet/SheetPanels'

export interface SheetTab {
  id: string
  label: string
  /** True for the tabs that take the left column's place on a phone. */
  phoneOnly?: boolean
  shows: (sheet: DerivedSheet) => boolean
  Panel: ComponentType<SheetPanelProps>
}

export const SHEET_TABS: readonly SheetTab[] = [
  { id: 'core', label: 'Core', phoneOnly: true, shows: () => true, Panel: CorePanel },
  {
    id: 'skills',
    label: 'Skills',
    phoneOnly: true,
    shows: () => true,
    Panel: SkillsTabPanel,
  },
  { id: 'actions', label: 'Actions', shows: () => true, Panel: ActionsPanel },
  {
    id: 'spells',
    label: 'Spells',
    shows: (sheet) => sheet.spellStats.length > 0,
    Panel: NotBuiltPanel,
  },
  { id: 'inventory', label: 'Inventory', shows: () => true, Panel: NotBuiltPanel },
  {
    id: 'features',
    label: 'Features & Traits',
    shows: () => true,
    Panel: NotBuiltPanel,
  },
  { id: 'story', label: 'Story', shows: () => true, Panel: NotBuiltPanel },
  { id: 'notes', label: 'Notes', shows: () => true, Panel: NotBuiltPanel },
  { id: 'extras', label: 'Extras', shows: () => true, Panel: NotBuiltPanel },
]

/** The tabs to offer: the phone-only ones only on a phone, the empty ones never. */
export function visibleTabs(sheet: DerivedSheet, phone: boolean): SheetTab[] {
  return SHEET_TABS.filter((tab) => (phone || !tab.phoneOnly) && tab.shows(sheet))
}
