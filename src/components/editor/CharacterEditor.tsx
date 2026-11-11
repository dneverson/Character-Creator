import { useState, type ComponentType } from 'react'
import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/Container'
import Spinner from 'react-bootstrap/Spinner'
import Stack from 'react-bootstrap/Stack'
import { ErrorBoundary } from '../ErrorBoundary'
import { Icon } from '../Icon'
import { downloadCharacter } from '../../character/io'
import { exportCharacterPdf } from '../../pdf/exportPdf'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import { useContentNames } from '../../hooks/useContentNames'
import { SectionCollapseContext, type SectionCommand } from './sectionCollapse'
import { AbilityScoresSection } from './AbilityScoresSection'
import { BackgroundSection } from './BackgroundSection'
import { BookSelection } from './BookSelection'
import { ClassBrowser } from './ClassBrowser'
import { EquipmentSection } from './EquipmentSection'
import { FeatsSection } from './FeatsSection'
import { CombatSection } from './CombatSection'
import { HitPoints } from './HitPoints'
import { RaceSelection } from './RaceSelection'
import { ProficienciesSection } from './ProficienciesSection'
import { SkillsSection } from './SkillsSection'
import { SpellsSection } from './SpellsSection'
import { DraftInput } from './DraftInput'
import { WildShapeSection } from './WildShapeSection'

/**
 * The editor's sections, top to bottom. They follow the natural character-build
 * flow, ordered so every section sits below the ones it depends on (no forward
 * references):
 *   Books gate all data. Class & Level (with its features) comes first.
 *   Race and Background grant ability increases, so they precede Ability Scores.
 *   Feats & Ability Score Improvements follow Ability Scores (they raise scores
 *   and check prerequisites) and precede everything that reads the totals.
 *   Skills show ability modifiers, so they follow Feats.
 *   Hit Points need CON, Spells need the casting ability, Wild Shape the Druid level.
 *   Equipment draws on class and background.
 * To reorder, just move a line - sections are self-contained and take no props.
 * Keep a section below whatever produces the data it reads.
 *
 * `title` names the section in the notice shown if it fails to render, so it
 * matches the heading the section gives itself.
 */
const SECTIONS: { title: string; Section: ComponentType }[] = [
  { title: 'Books', Section: BookSelection },
  { title: 'Class & Level', Section: ClassBrowser },
  { title: 'Race / Species', Section: RaceSelection },
  { title: 'Background', Section: BackgroundSection },
  { title: 'Ability Scores', Section: AbilityScoresSection },
  { title: 'Feats & Ability Score Improvements', Section: FeatsSection },
  { title: 'Skills', Section: SkillsSection },
  { title: 'Proficiencies', Section: ProficienciesSection },
  { title: 'Hit Points', Section: HitPoints },
  { title: 'Combat', Section: CombatSection },
  { title: 'Spells', Section: SpellsSection },
  { title: 'Wild Shape', Section: WildShapeSection },
  { title: 'Equipment', Section: EquipmentSection },
]

export function CharacterEditor() {
  const character = useActiveCharacter()
  const backToList = useCharacterStore((s) => s.backToList)
  const updateActive = useCharacterStore((s) => s.updateActive)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [sectionCommand, setSectionCommand] = useState<SectionCommand | null>(null)
  useContentNames()

  function setAllSections(open: boolean) {
    setSectionCommand((c) => ({ open, nonce: (c?.nonce ?? 0) + 1 }))
  }

  if (!character) return null

  async function exportPdf() {
    if (!character) return
    setPdfBusy(true)
    setPdfError(null)
    try {
      await exportCharacterPdf(character)
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'PDF export failed')
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <Container as="main" className="py-4">
      <Stack direction="horizontal" gap={2} className="mb-4">
        <Button variant="secondary" onClick={backToList}>
          <Icon name="back" className="me-1" />
          Characters
        </Button>
        <DraftInput
          value={character.name}
          onCommit={(name) => updateActive({ name })}
          aria-label="Character name"
          className="fw-semibold"
          style={{ maxWidth: 360 }}
        />
        <Button
          variant="secondary"
          className="ms-auto"
          onClick={() => downloadCharacter(character)}
        >
          Export JSON
        </Button>
        <Button variant="primary" onClick={exportPdf} disabled={pdfBusy}>
          {pdfBusy ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Building…
            </>
          ) : (
            'Export PDF'
          )}
        </Button>
      </Stack>
      {pdfError && (
        <div className="text-danger small mb-3" role="alert">
          {pdfError}
        </div>
      )}

      <div className="d-flex justify-content-end gap-3 mb-3">
        <Button
          variant="link"
          size="sm"
          className="text-decoration-none p-0"
          onClick={() => setAllSections(true)}
        >
          Expand all
        </Button>
        <Button
          variant="link"
          size="sm"
          className="text-decoration-none p-0"
          onClick={() => setAllSections(false)}
        >
          Collapse all
        </Button>
      </div>

      <SectionCollapseContext.Provider value={sectionCommand}>
        {SECTIONS.map(({ title, Section }) => (
          // One section failing to render leaves the others usable. The key ties a
          // caught failure to this character, so opening another one starts clean.
          <ErrorBoundary key={`${character.id}:${title}`} title={title}>
            <Section />
          </ErrorBoundary>
        ))}
      </SectionCollapseContext.Provider>
    </Container>
  )
}
