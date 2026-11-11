import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import { appConfig } from '../config/app'

// What the child throws on its next render; `null` lets it render normally.
let failure: unknown = null

function Child() {
  if (failure !== null) throw failure
  return <p>Section content</p>
}

beforeEach(() => {
  failure = null
  // React reports every caught render error to the console; that report is expected here.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('renders its children when nothing fails', () => {
    render(
      <ErrorBoundary title="Spells">
        <Child />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Section content')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('replaces a failing part with a notice and leaves its siblings alone', () => {
    failure = new Error('spell list is not iterable')
    render(
      <>
        <p>Sibling content</p>
        <ErrorBoundary title="Spells">
          <Child />
        </ErrorBoundary>
      </>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Spells could not be displayed' }),
    ).toBeInTheDocument()
    expect(screen.getByText('spell list is not iterable')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: appConfig.repository.label }),
    ).toHaveAttribute('href', appConfig.repository.url)
    expect(screen.getByText('Sibling content')).toBeInTheDocument()
    expect(screen.queryByText('Section content')).not.toBeInTheDocument()
  })

  it('shows the content again after "Try again" once the cause is gone', async () => {
    const user = userEvent.setup()
    failure = new Error('boom')
    render(
      <ErrorBoundary title="Spells">
        <Child />
      </ErrorBoundary>,
    )
    failure = null
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Section content')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the notice when the failure repeats on "Try again"', async () => {
    const user = userEvent.setup()
    failure = new Error('boom')
    render(
      <ErrorBoundary title="Spells">
        <Child />
      </ErrorBoundary>,
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('describes a thrown value that is not an Error', () => {
    failure = 'plain string failure'
    render(
      <ErrorBoundary title="Spells">
        <Child />
      </ErrorBoundary>,
    )
    expect(screen.getByText('plain string failure')).toBeInTheDocument()
  })

  it('lays the notice out as a page when asked', () => {
    failure = new Error('boom')
    render(
      <ErrorBoundary title="This page" page>
        <Child />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('alert'))
  })

  it('clears a caught failure when its key changes', () => {
    failure = new Error('boom')
    const { rerender } = render(
      <ErrorBoundary key="first" title="Spells">
        <Child />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    failure = null
    rerender(
      <ErrorBoundary key="second" title="Spells">
        <Child />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Section content')).toBeInTheDocument()
  })
})
