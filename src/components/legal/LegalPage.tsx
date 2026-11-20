// A legal page (privacy, terms or account): its text comes from src/config/legal.ts, drawn
// with the app's own typography. Each section carries a label saying whether it describes
// the app today or the account feature that is coming.

import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/Container'
import { legalConfig, legalScopeLabel, type LegalPageId } from '../../config/legal'
import { useLegalStore } from '../../legal/state'
import { AbbrText } from '../Abbr'
import { Icon } from '../Icon'

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
      {sections.map((section) => (
        <section key={section.id} id={section.id} className="mt-4">
          <h2 className="h5 d-flex flex-wrap align-items-center gap-2">
            {section.heading}
            {section.scope && (
              <Badge
                bg={section.scope === 'today' ? 'secondary' : 'warning'}
                text={section.scope === 'today' ? undefined : 'dark'}
              >
                {legalScopeLabel[section.scope]}
              </Badge>
            )}
          </h2>
          {section.paragraphs.map((text) => (
            <p key={text}>
              <AbbrText text={text} />
            </p>
          ))}
          {section.bullets && (
            <ul>
              {section.bullets.map((text) => (
                <li key={text}>
                  <AbbrText text={text} />
                </li>
              ))}
            </ul>
          )}
          {section.link && (
            <p>
              <a href={section.link.href} target="_blank" rel="noreferrer">
                {section.link.label}
              </a>
            </p>
          )}
        </section>
      ))}
    </Container>
  )
}
