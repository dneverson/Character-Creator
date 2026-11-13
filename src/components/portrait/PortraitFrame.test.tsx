import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCharacter } from '../../character/model'
import {
  PORTRAIT_MAX_FILE_BYTES,
  PORTRAIT_NOT_AN_IMAGE,
  PORTRAIT_NOT_SAVED,
  PORTRAIT_TOO_BIG,
} from '../../character/portrait'
import { useCharacterStore } from '../../character/store'
import { decodeImage, decodeImageUrl, type PortraitImage } from '../../portrait/imageFile'
import { settle } from '../../test/settle'
import { PortraitFrame } from './PortraitFrame'

vi.mock('../../portrait/imageFile', () => ({
  decodeImage: vi.fn(),
  decodeImageUrl: vi.fn(),
}))

const STORED = 'data:image/webp;base64,QUJD'
const CROPPED = 'data:image/webp;base64,REVG'

function fakeImage(width = 1600, height = 600) {
  return {
    width,
    height,
    paint: vi.fn(),
    encode: vi.fn(() => CROPPED),
    close: vi.fn(),
  } satisfies PortraitImage
}

function seed(portrait?: string) {
  const c = createCharacter('Tordek')
  if (portrait) c.portrait = portrait
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'sheet',
  })
  return c.id
}

const stored = (id: string) => useCharacterStore.getState().characters[id]
const user = () => userEvent.setup({ applyAccept: false })
const png = (name = 'wide.png') => new File(['x'], name, { type: 'image/png' })
const picker = () => screen.getByLabelText('Choose a portrait image')

beforeEach(() => {
  vi.mocked(decodeImage).mockReset()
  vi.mocked(decodeImageUrl).mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('PortraitFrame with no portrait', () => {
  it('is a framed button reading Add portrait that opens the file picker', async () => {
    seed()
    const click = vi.spyOn(HTMLInputElement.prototype, 'click')
    render(<PortraitFrame />)
    const frame = screen.getByRole('button', { name: 'Add portrait' })
    expect(frame).toHaveTextContent('Add portrait')
    await user().click(frame)
    expect(click).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(picker()).toHaveAttribute('accept', expect.stringContaining('image/webp'))
  })

  it('opens the edit window on a chosen picture and stores the cropped square on Save', async () => {
    const id = seed()
    const image = fakeImage()
    vi.mocked(decodeImage).mockResolvedValue(image)
    render(<PortraitFrame />)
    await user().upload(picker(), png())
    const dialog = await screen.findByRole('dialog', { name: 'Edit portrait' })
    expect(within(dialog).queryByRole('button', { name: 'Remove portrait' })).toBeNull()
    expect(
      within(dialog).getByRole('button', { name: 'Choose another image' }),
    ).toBeInTheDocument()
    // The picture is drawn as the middle square of a wide image.
    expect(image.paint).toHaveBeenLastCalledWith(expect.anything(), {
      x: 500,
      y: 0,
      side: 600,
    })
    await user().click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(image.encode).toHaveBeenCalledWith({ x: 500, y: 0, side: 600 })
    expect(stored(id)?.portrait).toBe(CROPPED)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(image.close).toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Edit portrait' }).querySelector('img'),
    ).toHaveAttribute('src', CROPPED)
  })

  it('says so plainly and keeps nothing when the file is over 20 MB', async () => {
    const id = seed()
    render(<PortraitFrame />)
    const big = png('huge.png')
    Object.defineProperty(big, 'size', { value: PORTRAIT_MAX_FILE_BYTES + 1 })
    await user().upload(picker(), big)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('alert')).toHaveTextContent(PORTRAIT_TOO_BIG)
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(decodeImage).not.toHaveBeenCalled()
    await user().click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(stored(id)?.portrait).toBeUndefined()
  })

  it('says so plainly when the file is not a picture the browser can read', async () => {
    seed()
    vi.mocked(decodeImage).mockRejectedValue(new Error('bad'))
    render(<PortraitFrame />)
    await user().upload(picker(), png('notes.png'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('alert')).toHaveTextContent(PORTRAIT_NOT_AN_IMAGE)
    expect(
      within(dialog).getByRole('button', { name: 'Choose an image' }),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('does nothing when the file picker is dismissed', async () => {
    seed()
    render(<PortraitFrame />)
    fireEvent.change(picker(), { target: { files: [] } })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the old picture and shows a message when a later file cannot be read', async () => {
    seed()
    const first = fakeImage()
    vi.mocked(decodeImage).mockResolvedValueOnce(first)
    render(<PortraitFrame />)
    await user().upload(picker(), png())
    const dialog = await screen.findByRole('dialog')
    vi.mocked(decodeImage).mockRejectedValueOnce(new Error('bad'))
    await user().click(
      within(dialog).getByRole('button', { name: 'Choose another image' }),
    )
    await user().upload(picker(), png('two.png'))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      PORTRAIT_NOT_AN_IMAGE,
    )
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('tells the user when the picture cannot be encoded', async () => {
    const id = seed()
    const image = fakeImage()
    image.encode.mockImplementation(() => {
      throw new Error('no canvas')
    })
    vi.mocked(decodeImage).mockResolvedValue(image)
    render(<PortraitFrame />)
    await user().upload(picker(), png())
    await user().click(await screen.findByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(PORTRAIT_NOT_SAVED)
    expect(stored(id)?.portrait).toBeUndefined()
  })

  it('refuses an encoded result that is not a portrait', async () => {
    const id = seed()
    const image = fakeImage()
    image.encode.mockReturnValue('data:text/html;base64,QUJD')
    vi.mocked(decodeImage).mockResolvedValue(image)
    render(<PortraitFrame />)
    await user().upload(picker(), png())
    await user().click(await screen.findByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(PORTRAIT_NOT_SAVED)
    expect(stored(id)?.portrait).toBeUndefined()
  })
})

describe('the crop frame', () => {
  async function openCrop(image = fakeImage()) {
    seed()
    vi.mocked(decodeImage).mockResolvedValue(image)
    render(<PortraitFrame />)
    await user().upload(picker(), png())
    const frame = await screen.findByLabelText(/^Portrait frame/)
    return { image, frame }
  }
  const lastRect = (image: ReturnType<typeof fakeImage>) => image.paint.mock.lastCall?.[1]

  it('moves with the arrow keys and never leaves the picture', async () => {
    const { image, frame } = await openCrop()
    frame.focus()
    // An arrow moves the picture that way, so the frame goes the other way over it.
    await user().keyboard('{ArrowLeft}')
    expect(lastRect(image)?.x).toBeCloseTo(500 + 8 * (600 / 256))
    await user().keyboard('{ArrowUp}{ArrowDown}{ArrowRight}')
    expect(lastRect(image)?.x).toBeCloseTo(500)
    for (let i = 0; i < 100; i++) fireEvent.keyDown(frame, { key: 'ArrowRight' })
    expect(lastRect(image)).toEqual({ x: 0, y: 0, side: 600 })
  })

  it('zooms with the slider, the plus and minus buttons and the + and - keys', async () => {
    const { image, frame } = await openCrop()
    const zoom = screen.getByRole('slider', { name: 'Zoom' })
    expect(zoom).toHaveValue('1')
    await user().click(screen.getByRole('button', { name: 'Zoom in' }))
    await settle()
    expect(zoom).toHaveValue('1.25')
    expect(lastRect(image)?.side).toBeCloseTo(480)
    await user().click(screen.getByRole('button', { name: 'Zoom out' }))
    await user().click(screen.getByRole('button', { name: 'Zoom out' }))
    await settle()
    expect(zoom).toHaveValue('1')
    fireEvent.change(zoom, { target: { value: '2' } })
    expect(lastRect(image)?.side).toBe(300)
    act(() => frame.focus())
    await user().keyboard('-')
    expect(zoom).toHaveValue('1.75')
    await user().keyboard('+')
    await user().keyboard('=')
    expect(zoom).toHaveValue('2.25')
    fireEvent.keyDown(frame, { key: 'q' })
    expect(zoom).toHaveValue('2.25')
    await settle()
  })

  it('moves by dragging, and a drag ends when the pointer is let go', async () => {
    const { image, frame } = await openCrop()
    const send = (type: string, clientX: number, clientY: number) =>
      fireEvent(frame, new MouseEvent(type, { bubbles: true, clientX, clientY }))
    send('pointermove', 5, 5) // not dragging: ignored
    expect(lastRect(image)?.x).toBe(500)
    send('pointerdown', 100, 100)
    send('pointermove', 60, 100)
    expect(lastRect(image)?.x).toBeCloseTo(500 + 40 * (600 / 256))
    send('pointerup', 60, 100)
    send('pointermove', 10, 100) // let go: ignored
    expect(lastRect(image)?.x).toBeCloseTo(500 + 40 * (600 / 256))
    send('pointerdown', 0, 0)
    send('pointercancel', 0, 0)
    send('pointermove', 50, 0)
    expect(lastRect(image)?.x).toBeCloseTo(500 + 40 * (600 / 256))
  })

  it('starts a newly chosen picture from its middle', async () => {
    const { image, frame } = await openCrop()
    fireEvent.keyDown(frame, { key: 'ArrowLeft' })
    expect(lastRect(image)?.x).not.toBe(500)
    const next = fakeImage(1000, 1000)
    vi.mocked(decodeImage).mockResolvedValue(next)
    await user().upload(picker(), png('square.png'))
    await waitFor(() => expect(next.paint).toHaveBeenCalled())
    expect(next.paint).toHaveBeenLastCalledWith(expect.anything(), {
      x: 0,
      y: 0,
      side: 1000,
    })
  })
})

describe('PortraitFrame with a portrait', () => {
  it('shows the picture, opens it for editing and can choose another or remove it', async () => {
    const id = seed(STORED)
    const image = fakeImage(256, 256)
    vi.mocked(decodeImageUrl).mockResolvedValue(image)
    const click = vi.spyOn(HTMLInputElement.prototype, 'click')
    render(<PortraitFrame />)
    const frame = screen.getByRole('button', { name: 'Edit portrait' })
    expect(frame.querySelector('img')).toHaveAttribute('src', STORED)
    expect(frame).not.toHaveTextContent('Add portrait')
    await user().click(frame)
    const dialog = await screen.findByRole('dialog', { name: 'Edit portrait' })
    expect(decodeImageUrl).toHaveBeenCalledWith(STORED)
    await waitFor(() => expect(image.paint).toHaveBeenCalled())
    await user().click(
      within(dialog).getByRole('button', { name: 'Choose another image' }),
    )
    expect(click).toHaveBeenCalled()
    await user().click(within(dialog).getByRole('button', { name: 'Remove portrait' }))
    expect(stored(id)?.portrait).toBeUndefined()
    expect('portrait' in (stored(id) ?? {})).toBe(true)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Add portrait' })).toBeInTheDocument()
  })

  it('does not change the portrait on Cancel', async () => {
    const id = seed(STORED)
    vi.mocked(decodeImageUrl).mockResolvedValue(fakeImage(256, 256))
    render(<PortraitFrame />)
    await user().click(screen.getByRole('button', { name: 'Edit portrait' }))
    await user().click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(stored(id)?.portrait).toBe(STORED)
  })

  it('offers another image when the stored portrait cannot be read', async () => {
    seed(STORED)
    vi.mocked(decodeImageUrl).mockRejectedValue(new Error('bad'))
    render(<PortraitFrame />)
    await user().click(screen.getByRole('button', { name: 'Edit portrait' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(PORTRAIT_NOT_SAVED)
    expect(screen.getByRole('button', { name: 'Remove portrait' })).toBeInTheDocument()
  })
})

describe('PortraitFrame with no open character', () => {
  it('renders nothing', () => {
    useCharacterStore.setState({
      characters: {},
      order: [],
      activeId: null,
      view: 'list',
    })
    const { container } = render(<PortraitFrame />)
    expect(container).toBeEmptyDOMElement()
  })
})
