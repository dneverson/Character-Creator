import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contentConfig, freeRulesLicense } from '../../config/content'
import { useContentStatus } from '../../content/library'
import { useContentSettings } from '../../content/settings'
import { fakeLibrary } from '../../test/fakeLibrary'
import { formatTimestamp } from '../../ui/date'
import { ContentSettings } from './ContentSettings'

vi.mock('../../content', async () => ({
  contentLibrary: (await import('../../test/fakeLibrary')).fakeLibrary,
}))

const idle = {
  epoch: 0,
  activity: 'idle',
  done: 0,
  total: 0,
  stored: 0,
  complete: false,
  commit: null,
  origin: 'download',
  checkedAt: 0,
  unreachable: false,
} as const

const confirmed = vi.fn(() => true)

function folderPicking(supported: boolean) {
  if (supported) {
    Object.defineProperty(HTMLInputElement.prototype, 'webkitdirectory', {
      configurable: true,
      value: false,
    })
  } else {
    Reflect.deleteProperty(HTMLInputElement.prototype, 'webkitdirectory')
  }
}

function open() {
  const onHide = vi.fn()
  render(<ContentSettings show onHide={onHide} />)
  return onHide
}

beforeEach(() => {
  vi.clearAllMocks()
  confirmed.mockReturnValue(true)
  vi.stubGlobal('confirm', confirmed)
  folderPicking(true)
  useContentStatus.setState({ ...idle })
  useContentSettings.setState({ source: { ...contentConfig.source } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  folderPicking(false)
})

describe('ContentSettings on the free rules', () => {
  it('says so and offers the full content', async () => {
    const user = userEvent.setup()
    open()

    expect(screen.getByRole('heading', { name: 'Free rules' })).toBeInTheDocument()
    expect(screen.getByText('0 files')).toBeInTheDocument()
    expect(screen.getByText('Not known yet')).toBeInTheDocument()
    expect(screen.getByText('Never')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check for updates' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove downloaded content' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Download the full content' }))
    expect(fakeLibrary.enable).toHaveBeenCalledTimes(1)
  })

  it('tells the visitor what the site hosts and what downloading means', () => {
    open()
    expect(screen.getByText(/hosts only the free rules/)).toBeInTheDocument()
    expect(screen.getByText(/you confirm that you own the books/)).toBeInTheDocument()
  })

  it('carries the license of the free rules', async () => {
    const user = userEvent.setup()
    open()
    const header = screen.getByRole('button', { name: 'License of the free rules' })
    expect(header).toHaveAttribute('aria-expanded', 'false')
    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    for (const document of freeRulesLicense.documents) {
      expect(screen.getByText(document.attribution)).toBeInTheDocument()
    }
  })

  it('closes from its header', async () => {
    const user = userEvent.setup()
    const onHide = open()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onHide).toHaveBeenCalled()
  })
})

describe('ContentSettings with the full content in use', () => {
  const checkedAt = new Date(2026, 10, 9, 20, 30).getTime()

  beforeEach(() => {
    useContentSettings.setState({ fullContent: true })
    useContentStatus.setState({
      stored: 167,
      complete: true,
      commit: '32ef600fab87a585a61dd1a22e9b02dfc58c728a',
      checkedAt,
    })
  })

  it('shows what is stored, its version and when it was last checked', () => {
    open()
    expect(screen.getByRole('heading', { name: 'Full content' })).toBeInTheDocument()
    expect(screen.getByText('167 files')).toBeInTheDocument()
    expect(screen.getByText('32ef600')).toBeInTheDocument()
    expect(screen.getByText(formatTimestamp(checkedAt))).toBeInTheDocument()
    expect(screen.getByText('2026/11/09 08:30 PM')).toBeInTheDocument()
  })

  it('checks for updates and says how it went', async () => {
    const user = userEvent.setup()
    open()

    await user.click(screen.getByRole('button', { name: 'Check for updates' }))
    expect(fakeLibrary.checkForUpdate).toHaveBeenCalledWith(true)
    expect(await screen.findByRole('status')).toHaveTextContent(/^Checked\./)

    fakeLibrary.checkForUpdate.mockResolvedValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'Check for updates' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/could not be checked/),
    )

    // A failure of the check itself reads the same as no answer.
    fakeLibrary.checkForUpdate.mockResolvedValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'Check for updates' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/^Checked\./),
    )
    fakeLibrary.checkForUpdate.mockRejectedValueOnce(new Error('storage failed'))
    await user.click(screen.getByRole('button', { name: 'Check for updates' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/could not be checked/),
    )
  })

  it('switches back to the free rules', async () => {
    const user = userEvent.setup()
    open()
    await user.click(screen.getByRole('button', { name: 'Use the free rules only' }))
    expect(fakeLibrary.disable).toHaveBeenCalledTimes(1)
  })

  it('removes the downloaded content only once the visitor confirms', async () => {
    const user = userEvent.setup()
    open()
    const remove = screen.getByRole('button', { name: 'Remove downloaded content' })

    confirmed.mockReturnValue(false)
    await user.click(remove)
    expect(fakeLibrary.remove).not.toHaveBeenCalled()

    confirmed.mockReturnValue(true)
    await user.click(remove)
    expect(confirmed).toHaveBeenLastCalledWith(
      expect.stringMatching(/characters are kept/),
    )
    expect(fakeLibrary.remove).toHaveBeenCalledTimes(1)
  })

  it('counts a single stored file in the singular', () => {
    useContentStatus.setState({ stored: 1 })
    open()
    expect(screen.getByText('1 file')).toBeInTheDocument()
  })

  it('shows the progress of a background download and holds the update check', () => {
    useContentStatus.setState({ activity: 'downloading', done: 40, total: 160 })
    open()
    expect(
      screen.getByRole('heading', { name: 'Downloading 40/160' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Download progress' }),
    ).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByRole('button', { name: 'Check for updates' })).toBeDisabled()
  })

  it('offers to try again when the source cannot be reached', async () => {
    const user = userEvent.setup()
    useContentStatus.setState({ unreachable: true })
    open()

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be reached/)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(fakeLibrary.retry).toHaveBeenCalledTimes(1)
  })
})

describe('ContentSettings importing a copy from this device', () => {
  const picked = [
    new File(['{}'], 'feats.json', { type: 'application/json' }),
    new File(['{}'], 'races.json', { type: 'application/json' }),
  ]

  it('stores the picked files and says how many', async () => {
    const user = userEvent.setup()
    open()
    expect(screen.getByRole('button', { name: 'Import from this device' })).toBeEnabled()
    expect(screen.getByText(/Nothing is uploaded/)).toBeInTheDocument()

    await user.upload(screen.getByLabelText('Folder to import'), picked)
    expect(fakeLibrary.importFiles).toHaveBeenCalledWith(picked)
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Stored 2 files from this device.',
    )

    fakeLibrary.importFiles.mockResolvedValueOnce(1)
    await user.upload(screen.getByLabelText('Folder to import'), picked[0])
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Stored 1 file from this device.',
      ),
    )
  })

  it('says when the folder held nothing usable, or could not be read', async () => {
    const user = userEvent.setup()
    open()

    fakeLibrary.importFiles.mockResolvedValueOnce(0)
    await user.upload(screen.getByLabelText('Folder to import'), picked)
    expect(await screen.findByRole('status')).toHaveTextContent(
      'No book content was found in that folder.',
    )

    fakeLibrary.importFiles.mockRejectedValueOnce(new Error('unreadable'))
    await user.upload(screen.getByLabelText('Folder to import'), picked)
    await waitFor(() => expect(fakeLibrary.importFiles).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('status')).toHaveTextContent(
      'No book content was found in that folder.',
    )
  })

  it('opens the folder picker from the button, and ignores an empty pick', async () => {
    const user = userEvent.setup()
    open()
    const input = screen.getByLabelText('Folder to import')
    const clicked = vi.fn()
    input.addEventListener('click', clicked)

    await user.click(screen.getByRole('button', { name: 'Import from this device' }))
    expect(clicked).toHaveBeenCalledTimes(1)

    await user.upload(input, [])
    expect(fakeLibrary.importFiles).not.toHaveBeenCalled()
  })

  it('holds its buttons while an import is running', () => {
    useContentStatus.setState({ activity: 'importing' })
    open()
    expect(screen.getByRole('heading', { name: 'Importing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import from this device' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Download the full content' }),
    ).toBeDisabled()
  })

  it('explains what an update check does to the visitor’s own copy', () => {
    useContentSettings.setState({ fullContent: true })
    useContentStatus.setState({ origin: 'import', stored: 12 })
    open()
    expect(screen.getByText('Your own copy')).toBeInTheDocument()
    expect(screen.getByText(/Your own copy is in use/)).toBeInTheDocument()
  })

  it('is not offered by a browser that cannot pick a folder', () => {
    folderPicking(false)
    open()
    expect(screen.queryByRole('button', { name: 'Import from this device' })).toBeNull()
    expect(screen.getByText(/cannot pick a folder/)).toBeInTheDocument()
  })
})

describe('ContentSettings content source', () => {
  it('starts from the source in use, which is the default', () => {
    open()
    expect(screen.getByLabelText('Data repository')).toHaveValue(
      contentConfig.source.dataRepository,
    )
    expect(screen.getByLabelText('Image repository')).toHaveValue(
      contentConfig.source.imageRepository,
    )
    expect(screen.getByLabelText('Branch or tag')).toHaveValue(contentConfig.source.ref)
    expect(screen.getByRole('button', { name: 'Use this source' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Back to the default source' }),
    ).toBeDisabled()
  })

  it('switches to another source once the visitor confirms', async () => {
    const user = userEvent.setup()
    open()
    const data = screen.getByLabelText('Data repository')
    const use = screen.getByRole('button', { name: 'Use this source' })

    await user.clear(data)
    expect(use).toBeDisabled()
    await user.type(data, 'someone/other-data')
    expect(use).toBeEnabled()

    confirmed.mockReturnValue(false)
    await user.click(use)
    expect(fakeLibrary.useSource).not.toHaveBeenCalled()

    confirmed.mockReturnValue(true)
    await user.click(use)
    expect(fakeLibrary.useSource).toHaveBeenCalledWith({
      ...contentConfig.source,
      dataRepository: 'someone/other-data',
    })
  })

  it('refuses a repository or branch that cannot be right', async () => {
    const user = userEvent.setup()
    open()
    const use = screen.getByRole('button', { name: 'Use this source' })

    await user.clear(screen.getByLabelText('Image repository'))
    await user.type(screen.getByLabelText('Image repository'), 'not a repository')
    expect(use).toBeDisabled()
    // Pressing Enter in a field does not get round the check.
    await user.type(screen.getByLabelText('Image repository'), '{Enter}')
    expect(fakeLibrary.useSource).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('Image repository'))
    await user.type(screen.getByLabelText('Image repository'), 'someone/images')
    expect(use).toBeEnabled()
    await user.clear(screen.getByLabelText('Branch or tag'))
    expect(use).toBeDisabled()
  })

  it('goes back to the default source in one step', async () => {
    const user = userEvent.setup()
    useContentSettings.setState({
      source: { ...contentConfig.source, ref: 'next' },
    })
    open()
    expect(screen.getByLabelText('Branch or tag')).toHaveValue('next')

    await user.click(screen.getByRole('button', { name: 'Back to the default source' }))
    expect(fakeLibrary.useSource).toHaveBeenCalledWith(contentConfig.source)
    expect(screen.getByLabelText('Branch or tag')).toHaveValue(contentConfig.source.ref)
  })
})
