import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { freeRulesLicense } from '../../config/content'
import { FreeRulesLicense } from './FreeRulesLicense'

describe('FreeRulesLicense', () => {
  it('shows the attribution of every document the free rules come from', () => {
    render(<FreeRulesLicense />)
    expect(freeRulesLicense.documents.length).toBeGreaterThan(0)
    for (const document of freeRulesLicense.documents) {
      expect(screen.getByRole('heading', { name: document.name })).toBeInTheDocument()
      expect(screen.getByText(document.attribution)).toBeInTheDocument()
      expect(document.attribution).toContain('Creative Commons Attribution 4.0')
    }
  })

  it('says that changes were made to the material', () => {
    render(<FreeRulesLicense />)
    expect(screen.getByText(freeRulesLicense.changes)).toBeInTheDocument()
  })
})
