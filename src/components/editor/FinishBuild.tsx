// The Done button of the editor. With nothing open it finishes the build and shows the
// sheet. With choices open it lists them, each a link to the section that has it, and
// lets the player finish anyway: Done never blocks, the sheet works either way.

import { useState } from 'react'
import Button from 'react-bootstrap/Button'
import Modal from 'react-bootstrap/Modal'
import { useCharacterStore } from '../../character/store'
import {
  SECTION_TITLES,
  type Checklist,
  type ChecklistTarget,
} from '../../derived/checklist'

const targetTitle = (target: ChecklistTarget) =>
  target === 'name' ? 'Name' : SECTION_TITLES[target]

interface Props {
  /** What the build still needs; absent while the data it is worked out from loads. */
  checklist: Checklist | undefined
  /** Takes the editor to the section (or the name) an open item is in. */
  onJump: (target: ChecklistTarget) => void
}

export function FinishBuild({ checklist, onJump }: Props) {
  const completeBuild = useCharacterStore((s) => s.completeBuild)
  const [asking, setAsking] = useState(false)
  // The link chosen: followed once the window has gone, so it does not take the focus back.
  const [chosen, setChosen] = useState<ChecklistTarget | null>(null)
  const items = checklist?.items ?? []

  function finish() {
    setAsking(false)
    completeBuild()
  }

  return (
    <>
      <Button
        variant="primary"
        disabled={!checklist}
        onClick={() => (items.length === 0 ? finish() : setAsking(true))}
      >
        Done
      </Button>
      <Modal
        show={asking}
        onHide={() => setAsking(false)}
        onExited={() => {
          if (chosen) onJump(chosen)
          setChosen(null)
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5">
            Finish the build
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            These choices are still open. Pick one to go and make it, or finish anyway:
            the sheet works either way, and Edit brings you back here.
          </p>
          <ul className="list-unstyled mb-0">
            {items.map((item) => (
              <li key={item.id}>
                <Button
                  variant="link"
                  className="p-0 text-start"
                  onClick={() => {
                    setChosen(item.section)
                    setAsking(false)
                  }}
                >
                  {targetTitle(item.section)}: {item.label}
                </Button>
              </li>
            ))}
          </ul>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setAsking(false)}>
            Keep building
          </Button>
          <Button variant="primary" onClick={finish}>
            Finish anyway
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
