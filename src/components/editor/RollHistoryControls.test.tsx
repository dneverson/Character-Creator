import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RollHistoryControls } from './RollHistoryControls'
import type { RollRecord } from '../../character/model'

let seq = 0
function statRecord(scores: number[]): RollRecord {
  return {
    id: `s${seq++}`,
    stream: 'ability',
    at: 1000 + seq,
    kind: 'stat-pool',
    config: { dice: 4, rerolls: 0 },
    scores,
  }
}

const summary = (r: RollRecord) => (r.kind === 'stat-pool' ? r.scores.join('-') : '')

function renderControls(records: RollRecord[], activeId: string | null) {
  const onSelect = vi.fn()
  render(
    <RollHistoryControls
      records={records}
      activeId={activeId}
      onSelect={onSelect}
      renderSummary={summary}
      title="Roll history"
    />,
  )
  return { onSelect }
}

describe('RollHistoryControls', () => {
  it('renders nothing when there are no records', () => {
    const { container } = render(
      <RollHistoryControls
        records={[]}
        activeId={null}
        onSelect={vi.fn()}
        renderSummary={summary}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the record count on the history opener', () => {
    renderControls([statRecord([10]), statRecord([12])], null)
    expect(screen.getByLabelText('Roll history (2)')).toHaveTextContent('2')
  })

  it('steps back to the previous roll and forward again', async () => {
    const user = userEvent.setup()
    const a = statRecord([10])
    const b = statRecord([12])
    // Cursor on the newest (b): back goes to a, forward is disabled.
    const { onSelect } = renderControls([a, b], b.id)

    const back = screen.getByLabelText('Previous roll')
    const forward = screen.getByLabelText('Next roll')
    expect(forward).toBeDisabled()

    await user.click(back)
    expect(onSelect).toHaveBeenCalledWith(a)
  })

  it('with the cursor on the oldest roll, back is disabled and forward works', async () => {
    const user = userEvent.setup()
    const a = statRecord([10])
    const b = statRecord([12])
    const { onSelect } = renderControls([a, b], a.id)

    expect(screen.getByLabelText('Previous roll')).toBeDisabled()
    await user.click(screen.getByLabelText('Next roll'))
    expect(onSelect).toHaveBeenCalledWith(b)
  })

  it('opens the modal and selects a past roll, newest first', async () => {
    const user = userEvent.setup()
    const a = statRecord([10, 11])
    const b = statRecord([12, 13])
    const { onSelect } = renderControls([a, b], b.id)

    await user.click(screen.getByLabelText('Roll history (2)'))
    const dialog = screen.getByRole('dialog')
    const newest = within(dialog).getByText('12-13')
    const oldest = within(dialog).getByText('10-11')
    // Newest (b) is listed first (before oldest in document order).
    expect(newest.compareDocumentPosition(oldest)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    await user.click(oldest)
    expect(onSelect).toHaveBeenCalledWith(a)
  })
})
