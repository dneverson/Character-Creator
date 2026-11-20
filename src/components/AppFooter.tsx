import Container from 'react-bootstrap/Container'
import { appConfig } from '../config/app'
import { legalLinks } from '../config/legal'

// Footer with the author's credit and the Matrix Dice idea credit, and a link to the repository.
export function AppFooter() {
  return (
    <footer className="mt-5 mb-3">
      <Container>
        <small className="text-body-secondary d-block text-center">
          {appConfig.fullName}. Author: {appConfig.author}. Matrix Dice idea:{' '}
          {appConfig.matrixDiceIdea}. Contact/Issues:{' '}
          <a href={appConfig.repository.url} target="_blank" rel="noreferrer">
            {appConfig.repository.label}
          </a>
          {legalLinks.map((link) => (
            <span key={link.id}>
              {'. '}
              <a href={`#/${link.id}`}>{link.label}</a>
            </span>
          ))}
        </small>
      </Container>
    </footer>
  )
}
