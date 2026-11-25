import { useEffect, useId } from 'react'
import Modal from 'react-bootstrap/Modal'
import { useAccountStore, type Account } from '../../cloud/account'
import { SignInCard } from './SignInCard'
import { useSignInModal } from './signInModalState'

/** The sign-in window, opened from any "Sign in" button; the user stays where they are. */
export function SignInModal({ account }: { account: Account }) {
  const open = useSignInModal((state) => state.open)
  const close = useSignInModal((state) => state.closeSignIn)
  const signedIn = useAccountStore((state) => state.session !== null)
  const titleId = useId()
  // Signing in is what the window was for: it goes when the user is in.
  useEffect(() => {
    if (signedIn && open) close()
  }, [signedIn, open, close])
  return (
    <Modal show={open && !signedIn} onHide={close} centered aria-labelledby={titleId}>
      <Modal.Header closeButton className="border-0 pb-0" />
      <Modal.Body className="pt-0 pb-4">
        <SignInCard
          account={account}
          headingLevel={2}
          titleId={titleId}
          onNavigate={close}
        />
      </Modal.Body>
    </Modal>
  )
}
