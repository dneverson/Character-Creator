import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// jsdom does no layout, so the stacked phone layout is pinned at its source: a column
// flex item whose flex-basis is zero collapses to its border, hiding a tapped row's detail.
const css = readFileSync('src/index.css', 'utf8')

describe('stacked detail pane on a phone', () => {
  it('sizes the pane from its content instead of a zero flex basis', () => {
    const phone = css.slice(css.indexOf('@media (max-width: 767.98px)'))
    const rule = /\.data-table-split__detail\s*\{([^}]*)\}/.exec(phone)
    expect(rule?.[1]).toMatch(/flex:\s*0 0 auto/)
  })
})

describe('table text size', () => {
  it('sets the data table grid, cells and headers, to 14px', () => {
    const rule = /\n\.data-table-grid\s*\{([^}]*)\}/.exec(css)
    expect(rule?.[1]).toMatch(/font-size:\s*0\.875rem/)
  })
})
