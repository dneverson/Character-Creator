import { Component, type ReactNode } from 'react'
import Button from 'react-bootstrap/Button'
import Card from 'react-bootstrap/Card'
import Container from 'react-bootstrap/Container'
import { Icon } from './Icon'
import { appConfig } from '../config/app'

interface Props {
  /** What this boundary protects, as the user knows it, e.g. "Spells". */
  title: string
  /** Lay the notice out as a whole page (inside a centred container) instead of a card in the flow. */
  page?: boolean
  /** Extra ways out, shown beside "Try again" (e.g. a button back to a safe view). */
  actions?: ReactNode
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Contains a rendering failure to the part of the page it wraps, so one broken
 * section shows a notice in place while everything around it stays usable.
 *
 * A caught failure clears on "Try again". To clear it when the subject changes
 * (another character, another view), give the boundary a `key` tied to that subject.
 * React itself reports the caught error to the console, so nothing is logged here.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(thrown: unknown): State {
    return { error: thrown instanceof Error ? thrown : new Error(String(thrown)) }
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const notice = (
      <Card className="mb-4" border="danger" role="alert">
        <Card.Header className="d-flex align-items-center gap-2">
          <Icon name="warning" className="text-danger" />
          <h2 className="h5 mb-0">{this.props.title} could not be displayed</h2>
        </Card.Header>
        <Card.Body>
          <p>
            Something went wrong while showing this part of the page. Characters already
            saved in this browser are not affected.
          </p>
          <div className="d-flex flex-wrap gap-2">
            <Button variant="primary" onClick={this.reset}>
              Try again
            </Button>
            {this.props.actions}
          </div>
          <p className="small text-body-secondary mt-3 mb-1">
            If it keeps happening, please report it at{' '}
            <a href={appConfig.repository.url} target="_blank" rel="noreferrer">
              {appConfig.repository.label}
            </a>{' '}
            and include the technical details below.
          </p>
          <details className="small">
            <summary>Technical details</summary>
            <code>{error.message}</code>
          </details>
        </Card.Body>
      </Card>
    )

    return this.props.page ? (
      <Container as="main" className="py-4">
        {notice}
      </Container>
    ) : (
      notice
    )
  }
}
