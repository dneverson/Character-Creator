import Button from 'react-bootstrap/Button'
import Dropdown from 'react-bootstrap/Dropdown'
import { useAccountStore, type Account } from '../../cloud/account'
import { useSyncStatus } from '../../cloud/sync'
import { useTheme } from '../../theme/theme-context'
import { useSignInModal } from './signInModalState'
import { useSyncLine } from './syncLine'

/** The signed-in menu: who, how the saving is going, and the account's few actions. */
function AccountMenu({ account, email }: { account: Account; email: string }) {
  const { resolved } = useTheme()
  const line = useSyncLine()
  const syncing = useSyncStatus((status) => status.state === 'syncing')
  const busy = useAccountStore((state) => state.busy)
  const initial = email.trim().charAt(0).toUpperCase() || '?'
  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        variant={resolved === 'dark' ? 'light' : 'secondary'}
        size="sm"
        id="account-menu"
        aria-label={`Account menu, signed in as ${email}`}
      >
        <span
          aria-hidden="true"
          className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary text-white fw-semibold me-1"
          style={{ width: '1.5rem', height: '1.5rem', fontSize: '0.8rem' }}
        >
          {initial}
        </span>
      </Dropdown.Toggle>
      <Dropdown.Menu style={{ minWidth: '16rem', maxWidth: 'min(22rem, 90vw)' }}>
        <Dropdown.ItemText className="text-body-secondary text-break">
          {email}
        </Dropdown.ItemText>
        <Dropdown.ItemText role="status" className="small pt-0">
          {line}
        </Dropdown.ItemText>
        <Dropdown.Divider />
        <Dropdown.Item
          as="button"
          disabled={syncing}
          onClick={() => void account.syncNow()}
        >
          Sync now
        </Dropdown.Item>
        <Dropdown.Item href="#/account">Account settings</Dropdown.Item>
        <Dropdown.Divider />
        <Dropdown.Item as="button" disabled={busy} onClick={() => void account.signOut()}>
          Sign out
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}

/**
 * The navbar's account control: a "Sign in" button that opens the sign-in window, or, once
 * signed in, the account menu.
 */
export function AccountButton({ account }: { account: Account }) {
  const { resolved } = useTheme()
  const email = useAccountStore((state) => state.session?.email)
  const openSignIn = useSignInModal((state) => state.openSignIn)
  if (email === undefined) {
    return (
      <Button
        size="sm"
        variant={resolved === 'dark' ? 'light' : 'secondary'}
        onClick={openSignIn}
      >
        Sign in
      </Button>
    )
  }
  return <AccountMenu account={account} email={email} />
}
