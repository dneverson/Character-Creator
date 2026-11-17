import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TaggedText } from './TaggedText'

describe('TaggedText labels', () => {
  it('sets an attack and a save label in italic, as the printed books do', () => {
    const { container } = render(
      <TaggedText text="{@atk mw,rw} {@hit 4} to hit. {@h}7 damage. {@actSave con} DC 12" />,
    )
    expect(container.textContent).toBe(
      'Melee or Ranged Weapon Attack: +4 to hit. Hit: 7 damage. Constitution Saving Throw: DC 12',
    )
    expect([...container.querySelectorAll('em')].map((e) => e.textContent)).toEqual([
      'Melee or Ranged Weapon Attack:',
      'Hit:',
      'Constitution Saving Throw:',
    ])
  })

  it('sets text with tags of its own inside the style', () => {
    const { container } = render(<TaggedText text="{@b {@i both}} done" />)
    expect(container.querySelector('strong em')?.textContent).toBe('both')
  })
})
