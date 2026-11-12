// The tabs of the sheet's switching box, as data: add or reorder a tab here and nothing
// else changes. A tab whose content would be empty is not shown.

import type { ComponentType } from 'react'
import type { DerivedSheet } from '../derived'
import { ExtrasPanel } from '../components/sheet/ExtrasPanel'
import { FeaturesPanel } from '../components/sheet/FeaturesPanel'
import { InventoryPanel } from '../components/sheet/InventoryPanel'
import { NotesPanel } from '../components/sheet/NotesPanel'
import { SpellsPanel } from '../components/sheet/SpellsPanel'
import { StoryPanel } from '../components/sheet/StoryPanel'
import {
  ActionsPanel,
  CorePanel,
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
    Panel: SpellsPanel,
  },
  { id: 'inventory', label: 'Inventory', shows: () => true, Panel: InventoryPanel },
  {
    id: 'features',
    label: 'Features & Traits',
    shows: () => true,
    Panel: FeaturesPanel,
  },
  { id: 'story', label: 'Story', shows: () => true, Panel: StoryPanel },
  { id: 'notes', label: 'Notes', shows: () => true, Panel: NotesPanel },
  {
    id: 'extras',
    label: 'Extras',
    shows: (sheet) => sheet.wildShapes.length > 0,
    Panel: ExtrasPanel,
  },
]

/** The tabs to offer: the phone-only ones only on a phone, the empty ones never. */
export function visibleTabs(sheet: DerivedSheet, phone: boolean): SheetTab[] {
  return SHEET_TABS.filter((tab) => (phone || !tab.phoneOnly) && tab.shows(sheet))
}
