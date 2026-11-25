// The Account page: sign in when signed out; when signed in, the profile, the cloud saving
// and deleting the account. What an account is and how deleting one works (the text the
// owner approved, in src/config/legal.ts) sits below, collapsed.

import { useState, type ReactNode } from 'react'
import Accordion from 'react-bootstrap/Accordion'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Card from 'react-bootstrap/Card'
import Container from 'react-bootstrap/Container'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import Spinner from 'react-bootstrap/Spinner'
import { useAccountStore, type Account } from '../../cloud/account'
import { useSyncStatus } from '../../cloud/sync'
import { legalConfig } from '../../config/legal'
import { useLegalStore } from '../../legal/state'
import { formatLongDate, formatMediumDateTime } from '../../ui/date'
import { AbbrText } from '../Abbr'
import { Icon } from '../Icon'
import { LegalSections } from '../legal/LegalSections'
import { DeleteAccountModal } from './DeleteAccountModal'
import { SignInCard } from './SignInCard'
import { useSyncLine } from './syncLine'

function Profile({ account, email }: { account: Account; email: string }) {
  const busy = useAccountStore((state) => state.busy)
  const createdAt = useAccountStore((state) => state.session?.createdAt)
  return (
    <Card className="mb-3">
      <Card.Body>
        <Card.Title as="h2" className="h5 mb-3">
          Profile
        </Card.Title>
        <dl className="row mb-3">
          <dt className="col-sm-4">Email</dt>
          <dd className="col-sm-8 text-break">{email}</dd>
          {createdAt !== undefined && (
            <>
              <dt className="col-sm-4">Member since</dt>
              <dd className="col-sm-8 mb-0">{formatLongDate(createdAt)}</dd>
            </>
          )}
        </dl>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void account.signOut()}
        >
          Sign out
        </Button>
      </Card.Body>
    </Card>
  )
}

function CloudSaving({ account }: { account: Account }) {
  const state = useSyncStatus((status) => status.state)
  const lastSyncedAt = useSyncStatus((status) => status.lastSyncedAt)
  const busy = useAccountStore((state) => state.busy)
  const line = useSyncLine()
  const syncing = state === 'syncing'
  const icon: ReactNode = {
    idle: <Icon name="check" className="text-success" />,
    syncing: <Spinner as="span" size="sm" aria-hidden="true" />,
    offline: <Icon name="info" />,
    error: <Icon name="warning" className="text-danger" />,
  }[state]
  return (
    <Card className="mb-3">
      <Card.Body>
        <Card.Title as="h2" className="h5 mb-3">
          Cloud saving
        </Card.Title>
        <div role="status" className="d-flex align-items-center gap-2 mb-3">
          {icon}
          {lastSyncedAt === null ? (
            <span>{line}</span>
          ) : (
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip>Last synced {formatMediumDateTime(lastSyncedAt)}</Tooltip>
              }
            >
              <span tabIndex={0}>{line}</span>
            </OverlayTrigger>
          )}
        </div>
        <Button
          variant="secondary"
          disabled={busy || syncing}
          onClick={() => void account.syncNow()}
        >
          {syncing && <Spinner as="span" size="sm" className="me-2" aria-hidden="true" />}
          Sync now
        </Button>
      </Card.Body>
    </Card>
  )
}

function DeleteCard({
  account,
  email,
  confirming,
  setConfirming,
}: {
  account: Account
  email: string
  confirming: boolean
  setConfirming: (confirming: boolean) => void
}) {
  return (
    <>
      <Card border="danger" className="mb-3">
        <Card.Body>
          <Card.Title as="h2" className="h5 text-danger-emphasis">
            Delete account
          </Card.Title>
          <p>
            Permanently delete your account and every copy of your characters in the
            cloud. The characters on this device are not touched.
          </p>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Delete account
          </Button>
        </Card.Body>
      </Card>
      <DeleteAccountModal
        account={account}
        email={email}
        show={confirming}
        onHide={() => setConfirming(false)}
      />
    </>
  )
}

/** What an account is and how deleting one works, collapsed until asked for. */
function HowItIsHandled() {
  const { intro, sections } = legalConfig.pages.account
  return (
    <Accordion className="mt-4">
      <Accordion.Item eventKey="handled">
        <Accordion.Header>How your account and data are handled</Accordion.Header>
        <Accordion.Body>
          <p>
            <AbbrText text={intro} />
          </p>
          <LegalSections sections={sections} headingAs="h3" />
          <p className="mb-0 mt-4">
            <a href="#/privacy">Privacy policy</a>
          </p>
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  )
}

export function AccountPanel({ account }: { account: Account }) {
  const closeLegal = useLegalStore((state) => state.closeLegal)
  const session = useAccountStore((state) => state.session)
  const error = useAccountStore((state) => state.error)
  const [confirming, setConfirming] = useState(false)
  return (
    <Container as="main" className="py-4" style={{ maxWidth: '40rem' }}>
      <Button variant="secondary" size="sm" className="mb-3" onClick={closeLegal}>
        <Icon name="back" /> Back
      </Button>
      {session ? (
        <>
          <h1 className="h3 mb-3">Account</h1>
          {error && !confirming && <Alert variant="danger">{error}</Alert>}
          <Profile account={account} email={session.email} />
          <CloudSaving account={account} />
          <DeleteCard
            account={account}
            email={session.email}
            confirming={confirming}
            setConfirming={setConfirming}
          />
        </>
      ) : (
        <Card className="mx-auto" style={{ maxWidth: '28rem' }}>
          <Card.Body className="p-4">
            <SignInCard account={account} headingLevel={1} />
          </Card.Body>
        </Card>
      )}
      <HowItIsHandled />
    </Container>
  )
}
