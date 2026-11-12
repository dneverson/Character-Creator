// What each tab of the sheet's switching box shows.

import type { DerivedSheet } from '../../derived'
import { SheetAttacks } from './SheetAttacks'
import { ProficienciesPanel, SavesPanel, SensesPanel, SkillsPanel } from './SidePanels'

export interface SheetPanelProps {
  sheet: DerivedSheet
}

export function ActionsPanel({ sheet }: SheetPanelProps) {
  return <SheetAttacks attacks={sheet.attacks} />
}

/** On a phone the left column is two tabs; this is the first, the skills the second. */
export function CorePanel({ sheet }: SheetPanelProps) {
  return (
    <div className="sheet-side">
      <SavesPanel sheet={sheet} />
      <SensesPanel sheet={sheet} />
      <ProficienciesPanel sheet={sheet} />
    </div>
  )
}

export function SkillsTabPanel({ sheet }: SheetPanelProps) {
  return (
    <div className="sheet-side">
      <SkillsPanel sheet={sheet} />
    </div>
  )
}
