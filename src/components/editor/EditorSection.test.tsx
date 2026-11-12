import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChecklistContext } from './checklistContext'
import { EditorSection } from './EditorSection'
import { SectionCollapseContext } from './sectionCollapse'
import type { Checklist } from '../../derived/checklist'
import { SubSection } from './SubSection'
import { navbarHeight, TRAIL_ATTRIBUTE, trailAt } from './sectionTrail'

afterEach(() => {
  document.documentElement.style.removeProperty('--app-navbar-height')
  vi.restoreAllMocks()
})

const box = (top: number, bottom: number) =>
  ({ top, bottom, height: bottom - top }) as DOMRect

function mockBox(element: Element, top: number, bottom: number) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(box(top, bottom))
}

describe('EditorSection', () => {
  it('collapses from a real button with its state and target', async () => {
    const user = userEvent.setup()
    render(
      <EditorSection title="Skills" subtitle="Pick some">
        <p>Body text</p>
      </EditorSection>,
    )
    const toggle = screen.getByRole('button', { name: 'Collapse Skills' })
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).toBe(
      screen.getByText('Body text').parentElement,
    )
    await user.click(toggle)
    expect(screen.queryByText('Body text')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand Skills' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('toggles from the bar around the text, but not from the text or the actions', async () => {
    const user = userEvent.setup()
    render(
      <EditorSection title="Skills" subtitle="Pick some" actions={<button>Extra</button>}>
        <p>Body text</p>
      </EditorSection>,
    )
    await user.click(screen.getByText('Extra'))
    expect(screen.getByText('Body text')).toBeInTheDocument()
    // The words are selectable text, not a click target.
    await user.click(screen.getByText('Pick some'))
    await user.click(screen.getByRole('heading', { name: 'Skills' }))
    expect(screen.getByText('Body text')).toBeInTheDocument()
    // The bar around them toggles.
    await user.click(document.querySelector('.editor-section__header') as HTMLElement)
    expect(screen.queryByText('Body text')).not.toBeInTheDocument()
  })

  it('leaves the section alone when the click ends a text selection', () => {
    render(
      <EditorSection title="Skills">
        <p>Body text</p>
      </EditorSection>,
    )
    const title = screen.getByRole('heading', { name: 'Skills' })
    const range = document.createRange()
    range.selectNodeContents(title)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    // A real drag-select ends in a click event while the selection is still held.
    fireEvent.click(document.querySelector('.editor-section__header') as HTMLElement)
    expect(screen.getByText('Body text')).toBeInTheDocument()
    window.getSelection()?.removeAllRanges()
  })

  it('brings its header back under the navbar when collapsed from far down', async () => {
    const user = userEvent.setup()
    document.documentElement.style.setProperty('--app-navbar-height', '56px')
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    const { container } = render(
      <EditorSection title="Skills">
        <p>Body text</p>
      </EditorSection>,
    )
    const card = container.firstElementChild as HTMLElement
    mockBox(card, -400, 300)
    await user.click(screen.getByRole('button', { name: 'Collapse Skills' }))
    expect(scrollBy).toHaveBeenCalledWith(0, -456)
  })

  it('does not scroll when the section top is already in view', async () => {
    const user = userEvent.setup()
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    render(
      <EditorSection title="Skills">
        <p>Body text</p>
      </EditorSection>,
    )
    await user.click(screen.getByRole('button', { name: 'Collapse Skills' }))
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('names the part under the pinned header while scrolling', () => {
    document.documentElement.style.setProperty('--app-navbar-height', '56px')
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb)
      return frames.length
    })
    const { container } = render(
      <EditorSection title="Class & level">
        <SubSection title="Class Features">
          <div {...{ [TRAIL_ATTRIBUTE]: 'Druid 5' }}>cards</div>
        </SubSection>
      </EditorSection>,
    )
    const card = container.firstElementChild as HTMLElement
    const header = card.querySelector('.editor-section__header') as HTMLElement
    mockBox(card, -300, 900)
    mockBox(header, 56, 100)
    mockBox(card.querySelector('section') as Element, -200, 600)
    mockBox(card.querySelector(`[${TRAIL_ATTRIBUTE}="Druid 5"]`) as Element, 0, 400)
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    act(() => frames.splice(0).forEach((cb) => cb(0)))
    expect(
      screen.getByText('- Class Features: Druid 5', { exact: false }),
    ).toBeInTheDocument()

    // Scrolled back to the top: the header is not pinned, so no trail.
    mockBox(card, 60, 900)
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    act(() => frames.splice(0).forEach((cb) => cb(0)))
    expect(screen.queryByText('Druid 5', { exact: false })).not.toBeInTheDocument()
  })
})

describe('trailAt', () => {
  it('is empty when the line is outside the card', () => {
    const card = document.createElement('div')
    mockBox(card, 500, 900)
    expect(trailAt(card, 100)).toEqual([])
    mockBox(card, -500, 50)
    expect(trailAt(card, 100)).toEqual([])
  })
})

describe('navbarHeight', () => {
  it('reads the published variable, and is zero when there is none', () => {
    expect(navbarHeight()).toBe(0)
    document.documentElement.style.setProperty('--app-navbar-height', '48px')
    expect(navbarHeight()).toBe(48)
  })

  describe('the build checklist mark', () => {
    const checklist: Checklist = {
      items: [
        { id: 'a', section: 'skills', count: 1, label: '1 skill choice to make' },
        { id: 'b', section: 'skills', count: 2, label: '2 expertise to choose' },
      ],
      status: { skills: 'open', race: 'done' },
    }
    const inChecklist = (id: 'skills' | 'race' | 'spells') =>
      render(
        <ChecklistContext.Provider value={checklist}>
          <EditorSection id={id} title="Section">
            <p>Body</p>
          </EditorSection>
        </ChecklistContext.Provider>,
      )

    it('shows caution that says what is open', () => {
      inChecklist('skills')
      expect(
        screen.getByRole('img', {
          name: 'Still open: 1 skill choice to make; 2 expertise to choose',
        }),
      ).toHaveClass('text-warning')
    })

    it('shows a check on a complete section, and nothing on one it cannot judge', () => {
      const { unmount } = inChecklist('race')
      expect(
        screen.getByRole('img', { name: 'Complete: nothing left to choose here' }),
      ).toHaveClass('text-success')
      unmount()
      inChecklist('spells')
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('shows nothing outside the editor, where there is no checklist', () => {
      render(
        <EditorSection id="skills" title="Section">
          <p>Body</p>
        </EditorSection>,
      )
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('opens only the section a command is for', () => {
      const both = (command: { open: boolean; nonce: number; only?: string }) => (
        <SectionCollapseContext.Provider value={command}>
          <EditorSection id="skills" title="Skills">
            <p>Skills body</p>
          </EditorSection>
          <EditorSection id="race" title="Race">
            <p>Race body</p>
          </EditorSection>
        </SectionCollapseContext.Provider>
      )
      const { rerender } = render(both({ open: true, nonce: 1 }))
      rerender(both({ open: false, nonce: 2 }))
      expect(screen.queryByText('Skills body')).not.toBeInTheDocument()
      rerender(both({ open: true, nonce: 3, only: 'race' }))
      expect(screen.getByText('Race body')).toBeInTheDocument()
      expect(screen.queryByText('Skills body')).not.toBeInTheDocument()
    })
  })
})
