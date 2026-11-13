import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CharacterList } from './CharacterList'
import { useCharacterStore } from '../character/store'
import { createCharacter } from '../character/model'
import { downloadCharacter, parseImportedCharacter } from '../character/io'

vi.mock('../character/io', () => ({
  downloadCharacter: vi.fn(),
  parseImportedCharacter: vi.fn(),
}))
const mockDownload = vi.mocked(downloadCharacter)
const mockParse = vi.mocked(parseImportedCharacter)

function seed(...names: string[]) {
  const characters: Record<string, ReturnType<typeof createCharacter>> = {}
  const order: string[] = []
  for (const name of names) {
    const c = createCharacter(name)
    characters[c.id] = c
    order.push(c.id)
  }
  useCharacterStore.setState({ characters, order, activeId: null, view: 'list' })
  return order
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CharacterList', () => {
  it('shows an empty-state card when there are no characters', () => {
    render(<CharacterList />)
    expect(screen.getByText(/No characters yet/i)).toBeInTheDocument()
  })

  it('shows a small thumbnail of the portrait, and nothing for a character without one', () => {
    const [withPicture, without] = seed('Tordek', 'Mialee')
    const { characters } = useCharacterStore.getState()
    const portrait = 'data:image/webp;base64,QUJD'
    useCharacterStore.setState({
      characters: {
        ...characters,
        [withPicture]: { ...characters[withPicture]!, portrait },
      },
    })
    const { container } = render(<CharacterList />)
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('src', portrait)
    expect(images[0]?.closest('.card')).toHaveTextContent('Tordek')
    expect(characters[without]).toBeDefined()
  })

  it('says a build is in progress, or what class a finished one is', () => {
    const [draft, finished] = seed('Tordek', 'Mialee')
    const { characters } = useCharacterStore.getState()
    useCharacterStore.setState({
      characters: {
        ...characters,
        [finished]: {
          ...characters[finished],
          completedAt: 1,
          classes: [{ name: 'Wizard', source: 'PHB', level: 3 }],
        },
      },
    })
    render(<CharacterList />)
    expect(screen.getAllByText('In progress')).toHaveLength(1)
    expect(screen.getByText('Wizard 3')).toBeInTheDocument()
    expect(draft).not.toBe(finished)
  })

  it('creates a new character from the header button', async () => {
    const user = userEvent.setup()
    render(<CharacterList />)
    await user.click(screen.getByRole('button', { name: /New Character/i }))
    expect(useCharacterStore.getState().view).toBe('editor')
  })

  it('opens, duplicates, and exports a listed character', async () => {
    const user = userEvent.setup()
    const [id] = seed('Tordek')
    render(<CharacterList />)

    // Export and Open act on the single listed card before it is duplicated.
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect(mockDownload).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Open' }))
    const state = useCharacterStore.getState()
    expect(state.view).toBe('editor')
    expect(state.activeId).toBe(id)

    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(useCharacterStore.getState().order).toHaveLength(2)
  })

  it('deletes only when the confirm dialog is accepted', async () => {
    const user = userEvent.setup()
    seed('Doomed')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<CharacterList />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(useCharacterStore.getState().order).toHaveLength(1)

    confirmSpy.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(useCharacterStore.getState().order).toHaveLength(0)
  })

  it('imports a valid file and alerts on a bad one', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<CharacterList />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    const imported = createCharacter('Imported')
    mockParse.mockReturnValueOnce(imported)
    fireEvent.change(input, {
      target: { files: [new File(['{}'], 'hero.json', { type: 'application/json' })] },
    })
    await waitFor(() =>
      expect(useCharacterStore.getState().characters[imported.id]).toBeDefined(),
    )

    mockParse.mockImplementationOnce(() => {
      throw new Error('bad json')
    })
    fireEvent.change(input, {
      target: { files: [new File(['nope'], 'bad.json', { type: 'application/json' })] },
    })
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Import failed: bad json'))
  })

  it('ignores a file dialog dismissed with no selection', () => {
    render(<CharacterList />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    // No file chosen -> the handler returns before parsing.
    fireEvent.change(input, { target: { files: [] } })
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('stringifies a non-Error thrown during import', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<CharacterList />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    mockParse.mockImplementationOnce(() => {
      throw 'plain string failure'
    })
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'x.json', { type: 'application/json' })] },
    })
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Import failed: plain string failure'),
    )
  })
})
