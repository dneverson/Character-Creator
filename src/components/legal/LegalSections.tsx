// The sections of a legal page: each with its heading, the label saying whether it
// describes the app today or the account feature, its paragraphs, bullets and link. Drawn
// by the Privacy and Terms pages and, inside "How your account and data are handled", by
// the Account page.

import Badge from 'react-bootstrap/Badge'
import { legalScopeLabel, type LegalSection } from '../../config/legal'
import { AbbrText } from '../Abbr'

/** The colour of each scope's label. */
const SCOPE_BADGE = { today: 'secondary', account: 'primary', coming: 'warning' } as const

export function LegalSections({
  sections,
  headingAs = 'h2',
}: {
  sections: readonly LegalSection[]
  /** The heading level of each section, one below the heading it sits under. */
  headingAs?: 'h2' | 'h3'
}) {
  const Heading = headingAs
  return (
    <>
      {sections.map((section) => (
        <section key={section.id} id={section.id} className="mt-4">
          <Heading className="h5 d-flex flex-wrap align-items-center gap-2">
            {section.heading}
            {section.scope && (
              <Badge
                bg={SCOPE_BADGE[section.scope]}
                text={section.scope === 'coming' ? 'dark' : undefined}
              >
                {legalScopeLabel[section.scope]}
              </Badge>
            )}
          </Heading>
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
    </>
  )
}
