import { useEffect, useState, type ComponentType } from 'react'
import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/Container'
import Spinner from 'react-bootstrap/Spinner'
import { ErrorBoundary } from '../ErrorBoundary'
import { CharacterHeader } from '../sheet/CharacterHeader'
import { downloadCharacter } from '../../character/io'
import { exportCharacterPdf } from '../../pdf/exportPdf'
import { useCharacter } from '../../character/useCharacterDoc'
import { useContentNames } from '../../hooks/useContentNames'
import {
  SECTION_TITLES,
  type ChecklistTarget,
  type SectionId,
} from '../../derived/checklist'
import { ChecklistContext, sectionDomId } from './checklistContext'
import { FinishBuild } from './FinishBuild'
import { SectionCollapseContext, type SectionCommand } from './sectionCollapse'
import { navbarHeight } from './sectionTrail'
import { useDerivedSheet } from './useDerivedSheet'
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
 * `id` is the key of `SECTION_TITLES`, whose title names the section in the notice shown if it fails to render, so it
 * matches the heading the section gives itself; the build checklist marks the section by `id`.
 */
const SECTIONS: { id: SectionId; Section: ComponentType }[] = [
  { id: 'books', Section: BookSelection },
  { id: 'class', Section: ClassBrowser },
  { id: 'race', Section: RaceSelection },
  { id: 'background', Section: BackgroundSection },
  { id: 'abilities', Section: AbilityScoresSection },
  { id: 'feats', Section: FeatsSection },
  { id: 'skills', Section: SkillsSection },
  { id: 'proficiencies', Section: ProficienciesSection },
  { id: 'hp', Section: HitPoints },
  { id: 'combat', Section: CombatSection },
  { id: 'spells', Section: SpellsSection },
  { id: 'wildshape', Section: WildShapeSection },
  { id: 'equipment', Section: EquipmentSection },
]

export function CharacterEditor() {
  const character = useCharacter()
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [sectionCommand, setSectionCommand] = useState<SectionCommand | null>(null)
  const [jump, setJump] = useState<{ target: ChecklistTarget; nonce: number } | null>(
    null,
  )
  const { sheet, loading } = useDerivedSheet()
  useContentNames()

  // Open the section a link of the Done window points to and bring it under the navbar.
  useEffect(() => {
    if (!jump) return
    const element = document.getElementById(sectionDomId(jump.target))
    if (!element) return
    window.scrollBy({
      top: element.getBoundingClientRect().top - navbarHeight() - 8,
      behavior: 'smooth',
    })
    if (jump.target === 'name') element.focus({ preventScroll: true })
  }, [jump])

  function jumpTo(target: ChecklistTarget) {
    if (target !== 'name') {
      setSectionCommand((c) => ({ open: true, only: target, nonce: (c?.nonce ?? 0) + 1 }))
    }
    setJump((j) => ({ target, nonce: (j?.nonce ?? 0) + 1 }))
  }

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
      <CharacterHeader
        mode="edit"
        actions={
          <>
            <FinishBuild
              checklist={loading ? undefined : sheet?.checklist}
              onJump={jumpTo}
            />
            <Button variant="secondary" onClick={() => downloadCharacter(character)}>
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
          </>
        }
      />
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

      <ChecklistContext.Provider value={loading ? null : (sheet?.checklist ?? null)}>
        <SectionCollapseContext.Provider value={sectionCommand}>
          {SECTIONS.map(({ id, Section }) => (
            // One section failing to render leaves the others usable. The key ties a
            // caught failure to this character, so opening another one starts clean.
            <ErrorBoundary key={`${character.id}:${id}`} title={SECTION_TITLES[id]}>
              <Section />
            </ErrorBoundary>
          ))}
        </SectionCollapseContext.Provider>
      </ChecklistContext.Provider>
    </Container>
  )
}
