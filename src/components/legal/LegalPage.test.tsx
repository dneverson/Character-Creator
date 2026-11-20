import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { appConfig } from '../../config/app'
import { legalConfig, legalLinks, legalScopeLabel } from '../../config/legal'
import { useLegalStore } from '../../legal/state'
import { LegalPage } from './LegalPage'

beforeEach(() => useLegalStore.setState({ page: 'privacy' }))

describe('the legal pages', () => {
  it('show the date, every section, and which part is today and which is coming', () => {
    render(<LegalPage page="privacy" />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Privacy policy' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(`Last updated: ${legalConfig.lastUpdated}`),
    ).toBeInTheDocument()
    for (const section of legalConfig.pages.privacy.sections) {
      expect(
        screen.getByRole('heading', { level: 2, name: new RegExp(section.heading) }),
      ).toBeInTheDocument()
    }
    const onDevice = screen.getByRole('heading', { name: /stored on your device/ })
    expect(within(onDevice).getByText(legalScopeLabel.today)).toBeInTheDocument()
    const processor = screen.getByRole('heading', { name: /Who handles your data/ })
    expect(within(processor).getByText(legalScopeLabel.account)).toBeInTheDocument()
  })

  it('states the truth about trackers, the host, the children rule and the contact', () => {
    render(<LegalPage page="privacy" />)
    expect(screen.getAllByText(/no analytics, no advertising/)).toHaveLength(2)
    expect(screen.getByText(/Supabase, a hosted database service/)).toHaveTextContent(
      'US East (N. Virginia)',
    )
    expect(screen.getByText(/not directed at children under 13/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open an issue on GitHub' })).toHaveAttribute(
      'href',
      `${appConfig.repository.url}/issues`,
    )
  })

  it('has terms that name the license, the trademark and the user content', () => {
    render(<LegalPage page="terms" />)
    expect(
      screen.getByText(/not a product of, and is not affiliated with/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Creative Commons Attribution 4.0/)).toBeInTheDocument()
    expect(screen.getByText(/is your responsibility/)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Moderation and removal/ }),
    ).toBeInTheDocument()
  })

  it('has an account page that says what deleting an account removes and keeps', () => {
    render(<LegalPage page="account" />)
    expect(screen.getByText(/Accounts are coming/)).toBeInTheDocument()
    expect(screen.getByText(/"Delete account" button/)).toBeInTheDocument()
    expect(
      screen.getByText(/Every copy of your characters in the cloud/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/stored on your own device are not touched/),
    ).toBeInTheDocument()
  })

  it('goes back by closing the page', async () => {
    render(<LegalPage page="terms" />)
    await userEvent.click(screen.getByRole('button', { name: /Back/ }))
    expect(useLegalStore.getState().page).toBeNull()
  })

  it('is linked from the footer for every page', () => {
    expect(legalLinks.map((link) => link.id)).toEqual(['privacy', 'terms', 'account'])
  })
})
