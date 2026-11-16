import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EffectLines } from './EffectLines'

const source = {
  kind: 'option' as const,
  tag: 'option:Lifedrinker|PHB',
  label: 'Lifedrinker',
}

describe('the lines of what a feature does to the sheet', () => {
  it('shows each amount and where it goes, and a flag with its reason', () => {
    render(
      <EffectLines
        lines={[
          {
            id: 'a',
            label: 'Lifedrinker',
            source,
            op: 'add',
            amount: 4,
            status: 'applied',
            how: 'On Longsword',
          },
          {
            id: 'b',
            label: 'Pact of the Blade',
            source: { ...source, label: 'Pact Boon' },
            op: 'note',
            status: 'flag',
            why: 'No pact weapon picked.',
          },
        ]}
      />,
    )
    expect(screen.getByText(/\+4 On Longsword/)).toBeInTheDocument()
    expect(screen.getByText('(Pact Boon)')).toBeInTheDocument()
    expect(screen.getByText('No pact weapon picked.').closest('li')).toHaveClass(
      'text-warning-emphasis',
    )
  })
})
