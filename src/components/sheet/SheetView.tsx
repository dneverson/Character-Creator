import Alert from 'react-bootstrap/Alert'
import Container from 'react-bootstrap/Container'
import Spinner from 'react-bootstrap/Spinner'
import { useActiveCharacter } from '../../character/store'
import { ABILITIES, ABILITY_NAMES, formatMod, abilityMod } from '../../dice/dice'
import { editionYear } from '../../data/labels'
import type { Quantity } from '../../derived/types'
import { useContentNames } from '../../hooks/useContentNames'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useDerivedSheet } from '../editor/useDerivedSheet'
import { CharacterHeader } from './CharacterHeader'
import { SheetDetailProvider } from './SheetDetail'
import { NO_VALUE } from '../table/facts'
import { StatBox } from './FixedPanel'
import { HpBox } from './HpBox'
import { PlayStrip } from './PlayStrip'
import { SheetRoot } from './SheetRoot'
import { SheetTabs } from './SheetTabs'
import { ProficienciesPanel, SavesPanel, SensesPanel, SkillsPanel } from './SidePanels'
import { TemplateMenu } from './TemplateMenu'
import { useSheetTemplate } from '../../sheet/useSheetTemplate'
import '../../sheet/sheet.css'

/**
 * Under the speed: the other ways of moving in force ("fly 30 ft."), or the unit when there
 * are none. One that holds only after an action (a potion of flying) is in the breakdown.
 */
const speedSub = (speed: Quantity) =>
  speed.lines
    .filter((l) => l.op === 'note' && l.status === 'applied')
    .map((l) => l.label.toLowerCase())
    .join(', ') || 'feet'

/** Below this width the left column becomes two tabs (Bootstrap's md breakpoint). */
const PHONE = '(max-width: 767.98px)'

/**
 * The finished character: the details that never move across the top, the saves, skills,
 * senses and proficiencies down the left, and one box whose tabs switch what it shows.
 * Every number is read from the derived sheet.
 */
export function SheetView() {
  const character = useActiveCharacter()
  const { sheet, loading, error } = useDerivedSheet()
  const phone = useMediaQuery(PHONE)
  const [template, setTemplate] = useSheetTemplate()
  useContentNames()
  if (!character) return null

  return (
    <SheetRoot template={template}>
      <SheetDetailProvider>
        <Container as="main" fluid className="sheet py-3">
          <CharacterHeader
            mode="sheet"
            ruleset={sheet ? `${editionYear(sheet.edition)} rules` : undefined}
            actions={<TemplateMenu value={template} onChange={setTemplate} />}
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
          {sheet && !error && (
            <>
              <div className="sheet-top">
                <div className="sheet-abilities">
                  {ABILITIES.map((key) => (
                    <StatBox
                      key={key}
                      label={ABILITY_NAMES[key]}
                      value={formatMod(abilityMod(sheet.totals[key]))}
                      sub={sheet.totals[key]}
                      breakdown={{
                        id: `ability:${key}`,
                        label: ABILITY_NAMES[key],
                        quantity: sheet.abilities[key],
                        amountHeader: 'Score',
                        totalLabel: `${ABILITY_NAMES[key]} score`,
                        title: `${ABILITY_NAMES[key]} ${sheet.totals[key]} (${formatMod(abilityMod(sheet.totals[key]))})`,
                      }}
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
                    value={sheet.speed.value > 0 ? sheet.speed.value : NO_VALUE}
                    sub={speedSub(sheet.speed)}
                    breakdown={{
                      id: 'speed',
                      label: 'Speed',
                      quantity: sheet.speed,
                      format: (n) => `${n} ft.`,
                      amountHeader: 'Feet',
                      totalLabel: 'Walking speed',
                    }}
                  />
                  <StatBox
                    label="Initiative"
                    value={formatMod(sheet.combat.initiative.value)}
                    breakdown={{
                      id: 'initiative',
                      label: 'Initiative',
                      quantity: sheet.combat.initiative,
                      format: formatMod,
                    }}
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
                  <div className="sheet-side">
                    <SavesPanel sheet={sheet} />
                    <SkillsPanel sheet={sheet} />
                    <SensesPanel sheet={sheet} />
                    <ProficienciesPanel sheet={sheet} />
                  </div>
                )}
                <SheetTabs sheet={sheet} phone={phone} />
              </div>
            </>
          )}
        </Container>
      </SheetDetailProvider>
    </SheetRoot>
  )
}
