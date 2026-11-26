// The rules exceptions of the build: each place it departs from the standard rules (allowed
// with the DM's approval), read from the derived sheet. A line names the rule and links to
// the Edit section where it is set.

import Button from 'react-bootstrap/Button'
import { useCharacterStore } from '../../character/store'
import type { DerivedSheet } from '../../derived'
import { SECTION_TITLES } from '../../derived/checklist'
import { Icon } from '../Icon'
import { useReadOnly } from './readOnly'

export function RulesExceptions({ sheet }: { sheet: DerivedSheet }) {
  const openEditorAt = useCharacterStore((s) => s.openEditorAt)
  const readOnly = useReadOnly()
  const { exceptions } = sheet
  return (
    <section className="sheet-panel mb-3" aria-label="Rules exceptions">
      <h2 className="sheet-panel__title">Rules exceptions</h2>
      {exceptions.length === 0 ? (
        <p className="small mb-0">This build follows the standard rules.</p>
      ) : (
        <ul className="sheet-rows">
          {exceptions.map((e) => (
            <li key={e.id} className="sheet-row flex-wrap">
              <Icon name="warning" />
              <span>
                <strong>{e.rule}.</strong> {e.detail}
              </span>
              {!readOnly && (
                <Button
                  variant="link"
                  size="sm"
                  className="ms-auto py-0"
                  onClick={() => openEditorAt(e.section)}
                >
                  Open in Edit:{' '}
                  {e.section === 'name' ? 'Name' : SECTION_TITLES[e.section]}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
