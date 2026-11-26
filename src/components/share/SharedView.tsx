// A character someone shared by link, at `#/shared/<token>`: their sheet, read-only, with
// a way to keep a copy. It needs no account; the cloud library is loaded when the page is
// opened (and not before), through the account's `readShared`.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/Container'
import Spinner from 'react-bootstrap/Spinner'
import Stack from 'react-bootstrap/Stack'
import { CharacterDocProvider } from '../../character/CharacterDoc'
import { identityLine } from '../../character/identity'
import { ensureCharacterDefaults, type Character } from '../../character/model'
import { useCharacterStore } from '../../character/store'
import type { CharacterDoc } from '../../character/useCharacterDoc'
import type { Account } from '../../cloud/account'
import { editionYear } from '../../data/labels'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { copyOfShared } from '../../share/copy'
import { useSharedStore } from '../../share/state'
import type { SheetTemplateId } from '../../sheet/templates'
import { useSheetTemplate } from '../../sheet/useSheetTemplate'
import { showToast } from '../../ui/toasts'
import { Icon } from '../Icon'
import { PortraitFrame } from '../portrait/PortraitFrame'
import { ReadOnlyContext } from '../sheet/readOnly'
import { SheetDetailProvider } from '../sheet/SheetDetail'
import { SheetRoot } from '../sheet/SheetRoot'
import { SheetBody } from '../sheet/SheetView'
import { usePlayedSheet } from '../sheet/usePlayedSheet'
import { SheetTabContext } from '../sheet/sheetTabContext'
import { TemplateMenu } from '../sheet/TemplateMenu'
import '../../sheet/sheet.css'

const PHONE = '(max-width: 767.98px)'

type Loaded =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'failed' }
  | { state: 'ready'; character: Character }

function SharedSheetBody({
  character,
  template,
  setTemplate,
  phone,
  onSave,
  onLeave,
}: {
  character: Character
  template: SheetTemplateId
  setTemplate: (id: SheetTemplateId) => void
  phone: boolean
  onSave: () => void
  onLeave: () => void
}) {
  const { sheet, loading, error } = usePlayedSheet()
  const line = [
    identityLine(character),
    sheet ? `${editionYear(sheet.edition)} rules` : undefined,
  ]
    .filter(Boolean)
    .join(' - ')
  return (
    <SheetRoot template={template}>
      <SheetDetailProvider>
        <Container as="main" fluid className="sheet py-3">
          <Alert
            variant="info"
            className="d-flex flex-wrap align-items-center gap-2 mb-3"
            role="region"
            aria-label="Shared character"
          >
            <strong className="me-auto">Shared character - view only</strong>
            <Button variant="primary" onClick={onSave}>
              Save a copy to my characters
            </Button>
          </Alert>
          <Stack direction="horizontal" gap={2} className="flex-wrap sheet-header mb-3">
            <Button variant="secondary" onClick={onLeave}>
              <Icon name="back" className="me-1" />
              Characters
            </Button>
            <div className="sheet-header__id">
              <PortraitFrame />
              <div className="sheet-header__who">
                <h1 className="sheet-header__name">{character.name}</h1>
                {line && <div className="sheet-header__line">{line}</div>}
              </div>
            </div>
            <div className="ms-auto d-flex flex-wrap gap-2">
              <TemplateMenu value={template} onChange={setTemplate} />
            </div>
          </Stack>
          {loading && (
            <div role="status" className="text-body-secondary mb-2">
              <Spinner size="sm" animation="border" className="me-2" />
              Loading the sheet...
            </div>
          )}
          {error && (
            <Alert variant="danger">Could not load the data: {error.message}</Alert>
          )}
          {sheet && !error && <SheetBody sheet={sheet} phone={phone} />}
        </Container>
      </SheetDetailProvider>
    </SheetRoot>
  )
}

function SharedSheet({ character }: { character: Character }) {
  const [tab, setTab] = useState<string | null>(null)
  const [template, setTemplate] = useSheetTemplate()
  const phone = useMediaQuery(PHONE)
  const closeShared = useSharedStore((s) => s.closeShared)
  const importCharacter = useCharacterStore((s) => s.importCharacter)
  const openCharacter = useCharacterStore((s) => s.openCharacter)
  // Nothing can change the document: the sheet's controls are left out (see readOnly.ts),
  // and an update that still came would be dropped here.
  const doc = useMemo<CharacterDoc>(
    () => ({ character, update: () => {}, latest: () => character }),
    [character],
  )
  const tabs = useMemo(() => ({ tab, setTab }), [tab])

  const save = () => {
    const copy = copyOfShared(character)
    importCharacter(copy)
    closeShared()
    openCharacter(copy.id)
    showToast('Saved a copy to your characters')
  }

  return (
    <ReadOnlyContext value={true}>
      <CharacterDocProvider value={doc}>
        <SheetTabContext value={tabs}>
          <SharedSheetBody
            character={character}
            template={template}
            setTemplate={setTemplate}
            phone={phone}
            onSave={save}
            onLeave={closeShared}
          />
        </SheetTabContext>
      </CharacterDocProvider>
    </ReadOnlyContext>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <Container as="main" className="py-5" style={{ maxWidth: '40rem' }}>
      {children}
    </Container>
  )
}

export function SharedView({ account, token }: { account: Account; token: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const closeShared = useSharedStore((s) => s.closeShared)

  useEffect(() => {
    let current = true
    account.readShared(token).then(
      (data) => {
        if (!current) return
        setLoaded(
          data
            ? { state: 'ready', character: ensureCharacterDefaults(data) }
            : { state: 'missing' },
        )
      },
      () => current && setLoaded({ state: 'failed' }),
    )
    return () => {
      current = false
    }
  }, [account, token, attempt])

  if (loaded.state === 'ready') return <SharedSheet character={loaded.character} />
  if (loaded.state === 'loading') {
    return (
      <Notice>
        <div role="status" className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading the shared character...
        </div>
      </Notice>
    )
  }
  return (
    <Notice>
      <h1 className="h4">
        {loaded.state === 'missing' ? 'Character not found' : 'Could not load it'}
      </h1>
      <p role="alert">
        {loaded.state === 'missing'
          ? 'This link does not work. It may have been stopped by its owner.'
          : 'The shared character could not be loaded. Check your connection and try again.'}
      </p>
      <div className="d-flex gap-2">
        {loaded.state === 'failed' && (
          <Button
            variant="primary"
            onClick={() => {
              setLoaded({ state: 'loading' })
              setAttempt((count) => count + 1)
            }}
          >
            Try again
          </Button>
        )}
        <Button variant="secondary" onClick={closeShared}>
          Go to my characters
        </Button>
      </div>
    </Notice>
  )
}
