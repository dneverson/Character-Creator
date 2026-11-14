// The portrait at the top left of the sheet: a framed button that shows the picture, or
// reads "Add portrait" while there is none. Either opens the file picker (none yet) or the
// edit window (a portrait). Choosing a file decodes it here; saving stores only the
// cropped square on the character.

import { useRef, useState, type ChangeEvent } from 'react'
import { useCharacter, useUpdateCharacter } from '../../character/useCharacterDoc'
import {
  PORTRAIT_NOT_AN_IMAGE,
  PORTRAIT_NOT_SAVED,
  isPortrait,
  portraitFileProblem,
} from '../../character/portrait'
import { decodeImage, decodeImageUrl, type PortraitImage } from '../../portrait/imageFile'
import { PortraitEditor } from './PortraitEditor'

/** The picture types offered in the file picker; the browser decides which it can decode. */
const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif'

export function PortraitFrame() {
  const character = useCharacter()
  const updateActive = useUpdateCharacter()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [image, setImage] = useState<PortraitImage | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!character) return null
  const { portrait } = character

  function show(next: PortraitImage | null) {
    image?.close()
    setImage(next)
  }

  function close() {
    show(null)
    setError(null)
    setOpen(false)
  }

  async function edit() {
    if (!portrait) return input.current?.click()
    setError(null)
    setOpen(true)
    try {
      show(await decodeImageUrl(portrait))
    } catch {
      setError(PORTRAIT_NOT_SAVED)
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // allow choosing the same file again
    if (!file) return
    const problem = portraitFileProblem(file.size)
    if (problem) {
      setError(problem)
      return setOpen(true)
    }
    try {
      show(await decodeImage(file))
      setError(null)
    } catch {
      setError(PORTRAIT_NOT_AN_IMAGE)
    }
    setOpen(true)
  }

  function save(url: string) {
    if (!isPortrait(url)) return setError(PORTRAIT_NOT_SAVED)
    updateActive({ portrait: url })
    close()
  }

  return (
    <>
      <button
        type="button"
        className="sheet-portrait"
        aria-label={portrait ? 'Edit portrait' : 'Add portrait'}
        onClick={edit}
      >
        {portrait ? (
          <img src={portrait} alt="" className="sheet-portrait__image" />
        ) : (
          <span className="sheet-portrait__empty">Add portrait</span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="d-none"
        aria-label="Choose a portrait image"
        tabIndex={-1}
        onChange={onFile}
      />
      {open && (
        <PortraitEditor
          image={image}
          error={error}
          hasPortrait={portrait !== undefined}
          onChoose={() => input.current?.click()}
          onSave={save}
          onRemove={() => {
            updateActive({ portrait: undefined })
            close()
          }}
          onCancel={close}
        />
      )}
    </>
  )
}
