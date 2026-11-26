import { sideClass } from './sideClass'
import { memo, useMemo } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/Container'
import Spinner from 'react-bootstrap/Spinner'
import { selectCanUndoLevelUp, useCharacterStore } from '../../character/store'
import type { Character } from '../../character/model'
import { useCharacterPart } from '../../character/useCharacterDoc'
import {
  ABILITIES,
  ABILITY_NAMES,
  formatMod,
  abilityMod,
  type AbilityKey,
} from '../../dice/dice'
import { editionYear } from '../../data/labels'
import type { DerivedSheet } from '../../derived'
import type { SpeedRow } from '../../derived/speed'
import { useContentNames } from '../../hooks/useContentNames'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import type { BreakdownSpec } from '../derived/DerivedNumber'
import { CharacterHeader } from './CharacterHeader'
import { SheetDetailProvider } from './SheetDetail'
import { NO_VALUE } from '../table/facts'
import { StatBox } from './FixedPanel'
import { HpBox } from './HpBox'
import { PlayStrip } from './PlayStrip'
import { RollerProvider } from './Roller'
import { testRoll } from './rollSpec'
import { SheetRoot } from './SheetRoot'
import { usePlayedSheet } from './usePlayedSheet'
import { SheetTabs } from './SheetTabs'
import {
  DefensesPanel,
  ProficienciesPanel,
  SavesPanel,
  SensesPanel,
  SkillsPanel,
} from './SidePanels'
import { TemplateMenu } from './TemplateMenu'
import { useSheetTemplate } from '../../sheet/useSheetTemplate'
import { useShareModal } from '../share/shareModalState'
import '../../sheet/sheet.css'

/**
 * Under the speed: the other ways of moving in force ("fly 30 ft."), or the unit when there
 * are none. One that holds only after an action (a potion of flying) is in the breakdown.
 */
const speedSub = (speeds: readonly SpeedRow[]) =>
  speeds
    .filter((row) => row.speed.value > 0)
    .map((row) => `${row.mode} ${feet(row.speed.value)}${row.hover ? ' (hover)' : ''}`)
    .join(', ') || 'feet'

const feet = (n: number) => `${n} ft.`

/** How an ability score adds up: the box's info icon opens it, the roll window shows it. */
const abilityBreakdown = (sheet: DerivedSheet, key: AbilityKey): BreakdownSpec => ({
  id: `ability:${key}`,
  label: ABILITY_NAMES[key],
  quantity: sheet.abilities[key],
  amountHeader: 'Score',
  totalLabel: `${ABILITY_NAMES[key]} score`,
  title: `${ABILITY_NAMES[key]} ${sheet.totals[key]} (${formatMod(abilityMod(sheet.totals[key]))})`,
})

/** The check of an ability: its modifier, with the score's lines as how it adds up. */
const abilityRoll = (sheet: DerivedSheet, key: AbilityKey) => ({
  ...testRoll(`${ABILITY_NAMES[key]} check`, abilityBreakdown(sheet, key)),
  modifier: abilityMod(sheet.totals[key]),
  parts: [
    { label: `${ABILITY_NAMES[key]} modifier`, amount: abilityMod(sheet.totals[key]) },
  ],
})

const initiativeBreakdown = (sheet: DerivedSheet): BreakdownSpec => ({
  id: 'initiative',
  label: 'Initiative',
  quantity: sheet.combat.initiative,
  format: formatMod,
})

const selectId = (character: Character) => character.id

/** Below this width the left column becomes two tabs (Bootstrap's md breakpoint). */
const PHONE = '(max-width: 767.98px)'

/**
 * The finished character: the details that never move across the top, the saves, skills,
 * senses and proficiencies down the left, and one box whose tabs switch what it shows.
 * Every number is read from the derived sheet, with what exhaustion and the conditions do.
 */
export function SheetView() {
  const id = useCharacterPart(selectId)
  const { sheet, loading, error } = usePlayedSheet()
  const phone = useMediaQuery(PHONE)
  const [template, setTemplate] = useSheetTemplate()
  const canUndoLevelUp = useCharacterStore(selectCanUndoLevelUp)
  const undoLevelUp = useCharacterStore((s) => s.undoLevelUp)
  const openShare = useShareModal((s) => s.openShare)
  useContentNames()
  const actions = useMemo(
    () => (
      <>
        <Button variant="secondary" onClick={() => id && openShare(id)}>
          Share
        </Button>
        {canUndoLevelUp && (
          <Button variant="secondary" onClick={undoLevelUp}>
            Undo level up
          </Button>
        )}
        <TemplateMenu value={template} onChange={setTemplate} />
      </>
    ),
    [id, openShare, canUndoLevelUp, undoLevelUp, template, setTemplate],
  )
  if (id === undefined) return null

  return (
    <SheetRoot template={template}>
      <SheetDetailProvider>
        <RollerProvider>
          <Container as="main" fluid className="sheet py-3">
            <CharacterHeader
              mode="sheet"
              edition={sheet?.edition}
              ruleset={sheet ? `${editionYear(sheet.edition)} rules` : undefined}
              actions={actions}
            />
            {loading && (
              <div className="text-body-secondary mb-2">
                <Spinner size="sm" animation="border" className="me-2" />
                Loading the sheet...
              </div>
            )}
            {error && (
              <Alert variant="danger">Could not load the data: {error.message}</Alert>
            )}
            {sheet && !error && <SheetBody sheet={sheet} phone={phone} />}
          </Container>
        </RollerProvider>
      </SheetDetailProvider>
    </SheetRoot>
  )
}

/**
 * Everything under the header, drawn from the sheet alone: it draws again only when the
 * sheet changes (the build, the exhaustion, the conditions), and a part that shows the
 * play state (a counter, the hit points) draws again by itself when that changes.
 */
export const SheetBody = memo(function SheetBody({
  sheet,
  phone,
}: {
  sheet: DerivedSheet
  phone: boolean
}) {
  return (
    <>
      <div className="sheet-top">
        <div className="sheet-abilities">
          {ABILITIES.map((key) => (
            <StatBox
              key={key}
              label={ABILITY_NAMES[key]}
              value={formatMod(abilityMod(sheet.totals[key]))}
              sub={sheet.totals[key]}
              roll={abilityRoll(sheet, key)}
              breakdown={abilityBreakdown(sheet, key)}
            />
          ))}
        </div>
        <div className="sheet-vitals">
          <StatBox
            label="Proficiency"
            value={formatMod(sheet.prof.value)}
            breakdown={{
              id: 'prof',
              label: 'Proficiency bonus',
              quantity: sheet.prof,
              format: formatMod,
            }}
          />
          <StatBox
            label="Speed"
            // A speed of 0 is a speed (grappled, exhausted); only no species has no value.
            value={sheet.speed.lines.length > 0 ? sheet.speed.value : NO_VALUE}
            sub={speedSub(sheet.speeds)}
            breakdown={{
              id: 'speed',
              label: 'Speed',
              quantity: sheet.speed,
              format: feet,
              amountHeader: 'Feet',
              totalLabel: 'Walking speed',
              also: sheet.speeds.map((row) => ({
                label: `${row.label} speed`,
                quantity: row.speed,
                format: feet,
                amountHeader: 'Feet',
              })),
            }}
          />
          <StatBox
            label="Initiative"
            value={formatMod(sheet.combat.initiative.value)}
            roll={testRoll('Initiative', initiativeBreakdown(sheet))}
            breakdown={initiativeBreakdown(sheet)}
          />
          <StatBox
            label="Armor class"
            value={sheet.ac.value}
            breakdown={{ id: 'ac', label: 'Armor class', quantity: sheet.ac }}
          />
        </div>
        <PlayStrip sheet={sheet} />
        <HpBox sheet={sheet} />
      </div>
      <div className="sheet-main">
        {!phone && (
          <div className={sideClass(sheet)}>
            <SavesPanel sheet={sheet} />
            <SkillsPanel sheet={sheet} />
            <SensesPanel sheet={sheet} />
            <DefensesPanel sheet={sheet} />
            <ProficienciesPanel sheet={sheet} />
          </div>
        )}
        <SheetTabs sheet={sheet} phone={phone} />
      </div>
    </>
  )
})
