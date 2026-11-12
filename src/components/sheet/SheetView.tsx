import Alert from 'react-bootstrap/Alert'
import Container from 'react-bootstrap/Container'
import Spinner from 'react-bootstrap/Spinner'
import { useActiveCharacter } from '../../character/store'
import { ABILITIES, ABILITY_NAMES, formatMod, abilityMod } from '../../dice/dice'
import { useContentNames } from '../../hooks/useContentNames'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useDerivedSheet } from '../editor/useDerivedSheet'
import { CharacterHeader } from './CharacterHeader'
import { StatBox } from './FixedPanel'
import { SheetTabs } from './SheetTabs'
import { ProficienciesPanel, SavesPanel, SensesPanel, SkillsPanel } from './SidePanels'
import '../../sheet/sheet.css'

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
  useContentNames()
  if (!character) return null

  return (
    <Container as="main" fluid className="sheet py-3">
      <CharacterHeader mode="sheet" />
      {loading && (
        <div className="text-body-secondary mb-2">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading the sheet...
        </div>
      )}
      {error && <Alert variant="danger">Could not load the data: {error.message}</Alert>}
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
                />
              ))}
            </div>
            <div className="sheet-vitals">
              <StatBox label="Proficiency" value={formatMod(sheet.prof.value)} />
              <StatBox
                label="Initiative"
                value={formatMod(sheet.combat.initiative.value)}
              />
              <StatBox label="Armor class" value={sheet.ac.value} />
              <StatBox label="Hit points" value={sheet.hp.value} sub="maximum" />
            </div>
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
  )
}
