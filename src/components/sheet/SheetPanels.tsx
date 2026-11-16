// What each tab of the sheet's switching box shows.

import type { DerivedSheet } from '../../derived'
import { sideClass } from './sideClass'
import { FavoritesBlock } from './FavoritesBlock'
import { SheetAttacks } from './SheetAttacks'
import { NotesPanel } from './NotesPanel'
import { RulesExceptions } from './RulesExceptions'
import { SheetUses } from './SheetUses'
import {
  DefensesPanel,
  ProficienciesPanel,
  SavesPanel,
  SensesPanel,
  SkillsPanel,
} from './SidePanels'

export interface SheetPanelProps {
  sheet: DerivedSheet
}

export function ActionsPanel({ sheet }: SheetPanelProps) {
  return (
    <>
      <FavoritesBlock sheet={sheet} />
      <SheetAttacks attacks={sheet.attacks} />
      <SheetUses sheet={sheet} />
    </>
  )
}

/** On a phone the left column is two tabs; this is the first, the skills the second. */
export function CorePanel({ sheet }: SheetPanelProps) {
  return (
    <div className={sideClass(sheet)}>
      <SavesPanel sheet={sheet} />
      <SensesPanel sheet={sheet} />
      <DefensesPanel sheet={sheet} />
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

/** The Notes tab: where the build departs from the standard rules, then the player's notes. */
export function NotesTabPanel({ sheet }: SheetPanelProps) {
  return (
    <>
      <RulesExceptions sheet={sheet} />
      <NotesPanel />
    </>
  )
}
