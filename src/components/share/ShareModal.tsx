// The Share window: turn read-only sharing of one character on or off, and copy its link.
// Only a signed-in user can share (a link shows the cloud copy); a visitor is offered the
// sign-in first, and the window carries on to the switch once they are in.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import Spinner from 'react-bootstrap/Spinner'
import { CharacterNotInCloudError, CloudOfflineError } from '../../cloud/backend'
import { useAccountStore, type Account } from '../../cloud/account'
import { useCharacterStore } from '../../character/store'
import { shareLink } from '../../share/link'
import { showToast } from '../../ui/toasts'
import { SignInCard } from '../account/SignInCard'
import { useShareModal } from './shareModalState'

/** A plain sentence for why sharing could not be read or changed. */
function reason(error: unknown): string {
  if (error instanceof CloudOfflineError) {
    return 'The cloud could not be reached. Check your connection and try again.'
  }
  if (error instanceof CharacterNotInCloudError) {
    return 'This character is not in your cloud copy yet. Wait a moment for it to finish saving, then try again.'
  }
  return 'Sharing could not be changed. Try again.'
}

type Known =
  { state: 'loading' } | { state: 'failed' } | { state: 'ready'; token: string | null }

function ShareControls({
  account,
  characterId,
}: {
  account: Account
  characterId: string
}) {
  const [known, setKnown] = useState<Known>({ state: 'loading' })
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const field = useRef<HTMLInputElement>(null)
  const switchId = useId()
  const linkId = useId()

  useEffect(() => {
    let current = true
    account.getShare(characterId).then(
      (token) => current && setKnown({ state: 'ready', token }),
      (failure: unknown) => {
        if (!current) return
        setError(reason(failure))
        setKnown({ state: 'failed' })
      },
    )
    return () => {
      current = false
    }
  }, [account, characterId, attempt])

  const retry = () => {
    setError(null)
    setKnown({ state: 'loading' })
    setAttempt((count) => count + 1)
  }

  const change = useCallback(
    async (on: boolean) => {
      setWorking(true)
      setError(null)
      try {
        if (on) {
          const token = await account.createShare(characterId)
          setKnown({ state: 'ready', token })
        } else {
          await account.stopShare(characterId)
          setKnown({ state: 'ready', token: null })
          showToast('Sharing stopped')
        }
      } catch (failure) {
        setError(reason(failure))
      } finally {
        setWorking(false)
      }
    },
    [account, characterId],
  )

  const token = known.state === 'ready' ? known.token : null
  const link = token
    ? shareLink(window.location.origin, import.meta.env.BASE_URL, token)
    : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setError(null)
      showToast('Link copied')
    } catch {
      field.current?.select()
      setError('The link could not be copied. It is selected: copy it yourself.')
    }
  }

  return (
    <>
      <div aria-live="polite">
        {known.state === 'loading' && (
          <div role="status" className="text-body-secondary mb-3">
            <Spinner as="span" size="sm" className="me-2" aria-hidden="true" />
            Checking whether this character is shared...
          </div>
        )}
        {error && (
          <div role="alert" className="text-danger small mb-3">
            {error}
            {known.state === 'failed' && (
              <>
                {' '}
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 align-baseline"
                  onClick={retry}
                >
                  Try again
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      {known.state === 'ready' && (
        <>
          <Form.Check
            type="switch"
            role="switch"
            id={switchId}
            label="Anyone with the link can view"
            checked={token !== null}
            disabled={working}
            onChange={(event) => void change(event.target.checked)}
            className="mb-3"
          />
          {working && (
            <div role="status" className="text-body-secondary small mb-3">
              <Spinner as="span" size="sm" className="me-2" aria-hidden="true" />
              {token === null ? 'Making the link...' : 'Stopping...'}
            </div>
          )}
          {token !== null && (
            <div className="mb-3">
              <Form.Label htmlFor={linkId} className="small mb-1">
                Link
              </Form.Label>
              <div className="d-flex gap-2 flex-wrap">
                <Form.Control
                  ref={field}
                  id={linkId}
                  readOnly
                  value={link}
                  onFocus={(event) => event.currentTarget.select()}
                  className="flex-grow-1"
                  style={{ minWidth: '12rem', width: 'auto' }}
                />
                <Button variant="primary" onClick={() => void copy()}>
                  Copy link
                </Button>
                <Button
                  variant="secondary"
                  disabled={working}
                  onClick={() => void change(false)}
                >
                  Stop sharing
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      <p className="text-body-secondary small mb-0">
        People with the link see this character's sheet as it is in your cloud copy, and
        can save their own copy. They cannot change yours.
      </p>
    </>
  )
}

/** The Share window, opened from any "Share" button. */
export function ShareModal({ account }: { account: Account }) {
  const characterId = useShareModal((state) => state.characterId)
  const close = useShareModal((state) => state.closeShare)
  const name = useCharacterStore((state) =>
    characterId ? state.characters[characterId]?.name : undefined,
  )
  const signedIn = useAccountStore((state) => state.session !== null)
  const titleId = useId()
  const open = characterId !== null && name !== undefined
  return (
    <Modal show={open} onHide={close} centered aria-labelledby={titleId}>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5 text-break" id={titleId}>
          Share {name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {characterId !== null &&
          (signedIn ? (
            <ShareControls account={account} characterId={characterId} />
          ) : (
            <>
              <p>
                Sharing needs an account, because a link shows the copy of this character
                that is kept in the cloud. Sign in to share it.
              </p>
              <SignInCard account={account} headingLevel={2} onNavigate={close} />
            </>
          ))}
      </Modal.Body>
    </Modal>
  )
}
