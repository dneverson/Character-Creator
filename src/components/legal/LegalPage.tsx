// A legal page (privacy or terms): its text comes from src/config/legal.ts, drawn with the
// app's own typography. Each section carries a label saying whether it describes the app
// today or the account feature that is coming. The Account page has its own layout
// (src/components/account/AccountPage.tsx) and reuses the sections.

import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/Container'
import { legalConfig, type LegalPageId } from '../../config/legal'
import { useLegalStore } from '../../legal/state'
import { AbbrText } from '../Abbr'
import { Icon } from '../Icon'
import { LegalSections } from './LegalSections'

export function LegalPage({ page }: { page: LegalPageId }) {
  const closeLegal = useLegalStore((s) => s.closeLegal)
  const { title, intro, sections } = legalConfig.pages[page]
  return (
    <Container as="main" className="py-4" style={{ maxWidth: '50rem' }}>
      <Button variant="secondary" size="sm" className="mb-3" onClick={closeLegal}>
        <Icon name="back" /> Back
      </Button>
      <h1 className="h3">{title}</h1>
      <p className="text-body-secondary">Last updated: {legalConfig.lastUpdated}</p>
      <p>
        <AbbrText text={intro} />
      </p>
      <LegalSections sections={sections} />
    </Container>
  )
}
