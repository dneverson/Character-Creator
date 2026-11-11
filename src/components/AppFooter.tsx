import Container from 'react-bootstrap/Container'
import { appConfig } from '../config/app'

// Footer with the original authors' credit and a link to the repository.
export function AppFooter() {
  return (
    <footer className="mt-5 mb-3">
      <Container>
        <small className="text-body-secondary d-block text-center">
          {appConfig.fullName}. Authors: {appConfig.authors.join(' & ')}. Contact/Issues:{' '}
          <a href={appConfig.repository.url} target="_blank" rel="noreferrer">
            {appConfig.repository.label}
          </a>
        </small>
      </Container>
    </footer>
  )
}
