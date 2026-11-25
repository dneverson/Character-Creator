// Signing in, in two steps: the email address, then the 6-digit code that was emailed to
// it. Drawn in the sign-in window and, centred in a card, on the Account page.

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Spinner from 'react-bootstrap/Spinner'
import { useAccountStore, type Account } from '../../cloud/account'
import { appConfig } from '../../config/app'
import { legalConfig } from '../../config/legal'
import { CodeInput } from './CodeInput'

interface Props {
  account: Account
  /** The heading level: 1 where the card is the page, 2 inside a window. */
  headingLevel: 1 | 2
  /** The id the heading takes, for a window that is named by it. */
  titleId?: string
  /** Told when a link inside the card leaves for another page. */
  onNavigate?: () => void
}

/** Seconds left before another code may be asked for; 0 once the wait is over. */
function useWait(startedAt: number | null, seconds: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt === null) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])
  if (startedAt === null) return 0
  // A clock read before the code was sent (a new code was just asked for) counts as the
  // start of the wait until the next tick.
  return Math.min(
    seconds,
    Math.max(0, Math.ceil((startedAt + seconds * 1000 - now) / 1000)),
  )
}

function Heading({
  level,
  id,
  children,
}: {
  level: 1 | 2
  id?: string
  children: string
}) {
  const Tag = level === 1 ? 'h1' : 'h2'
  return (
    <Tag id={id} className="h4 mb-2">
      {children}
    </Tag>
  )
}

function EmailStep({ account, headingLevel, titleId, onNavigate }: Props) {
  const { step, sentTo, error } = useAccountStore()
  const [email, setEmail] = useState(sentTo)
  const [invalid, setInvalid] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)
  const problemId = useId()
  const sending = step === 'sending'
  const problem = invalid ?? error

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const address = email.trim()
    if (address === '' || field.current?.checkValidity() === false) {
      setInvalid(
        address === ''
          ? 'Enter your email address.'
          : 'Enter a valid email address, like name@example.com.',
      )
      field.current?.focus()
      return
    }
    setInvalid(null)
    void account.sendLink(address)
  }

  return (
    <Form onSubmit={submit} noValidate>
      <Heading level={headingLevel} id={titleId}>
        Sign in
      </Heading>
      <p className="text-body-secondary">
        Keep your characters in the cloud and use them on any device. Optional - the app
        works fully without an account.
      </p>
      <Form.Group controlId={`${problemId}-email`} className="mb-3">
        <Form.Label>Email address</Form.Label>
        <Form.Control
          ref={field}
          type="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          isInvalid={problem !== null}
          aria-invalid={problem !== null}
          aria-describedby={problem ? problemId : undefined}
          onChange={(event) => {
            setEmail(event.target.value)
            setInvalid(null)
          }}
        />
        {problem && (
          <Form.Control.Feedback type="invalid" id={problemId} role="alert">
            {problem}
          </Form.Control.Feedback>
        )}
      </Form.Group>
      <Button type="submit" variant="primary" className="w-100" disabled={sending}>
        {sending && <Spinner as="span" size="sm" className="me-2" aria-hidden="true" />}
        {sending ? 'Sending...' : 'Email me a sign-in code'}
      </Button>
      <p className="text-body-secondary small mt-3 mb-0">
        By signing in you accept the{' '}
        <a href="#/terms" onClick={onNavigate}>
          Terms
        </a>{' '}
        and the{' '}
        <a href="#/privacy" onClick={onNavigate}>
          Privacy policy
        </a>
        . You must be {legalConfig.minimumAge} or older.
      </p>
    </Form>
  )
}

function CodeStep({ account, headingLevel, titleId }: Props) {
  const { step, sentTo, sentAt, error } = useAccountStore()
  const { codeLength, resendSeconds } = appConfig.cloud
  const labelId = useId()
  const errorId = useId()
  const remaining = useWait(sentAt, resendSeconds)
  const [resent, setResent] = useState(false)
  // A wrong code clears the boxes and puts the cursor back in the first: the boxes start
  // over under a new key.
  const [attempt, setAttempt] = useState(0)
  const verifying = step === 'verifying'
  const sending = step === 'sending'
  const wrong = step === 'sent' && error !== null

  const [wasWrong, setWasWrong] = useState(wrong)
  if (wrong !== wasWrong) {
    setWasWrong(wrong)
    if (wrong) setAttempt((count) => count + 1)
  }

  return (
    <>
      <Heading level={headingLevel} id={titleId}>
        Check your email
      </Heading>
      <p>
        We sent a {codeLength}-digit code to{' '}
        <strong className="text-break">{sentTo}</strong>.
      </p>
      <p id={labelId} className="small fw-semibold mb-2">
        {codeLength}-digit code
      </p>
      <CodeInput
        key={attempt}
        length={codeLength}
        labelledBy={labelId}
        describedBy={wrong ? errorId : undefined}
        invalid={wrong}
        disabled={verifying}
        onComplete={(code) => {
          setResent(false)
          void account.verifyCode(code)
        }}
      />
      <div aria-live="polite">
        {wrong && (
          <div id={errorId} role="alert" className="mt-2 text-danger small">
            {error}
          </div>
        )}
        {verifying && (
          <div role="status" className="mt-2 text-body-secondary small">
            <Spinner as="span" size="sm" className="me-2" aria-hidden="true" />
            Checking your code...
          </div>
        )}
        {!wrong && !verifying && resent && !sending && step !== 'failed' && (
          <div role="status" className="mt-2 text-body-secondary small">
            We sent a new code.
          </div>
        )}
        {step === 'failed' && error && (
          <div role="alert" className="mt-2 text-danger small">
            {error}
          </div>
        )}
      </div>
      <p className="text-body-secondary small mt-2">
        Or open the link in the email on this device.
      </p>
      <div className="d-flex flex-wrap justify-content-between gap-2 small">
        <Button
          variant="link"
          size="sm"
          className="p-0"
          disabled={remaining > 0 || sending || verifying}
          onClick={() => {
            setResent(true)
            void account.sendLink(sentTo)
          }}
        >
          {sending
            ? 'Sending...'
            : remaining > 0
              ? `Send a new code in ${remaining} s`
              : 'Send a new code'}
        </Button>
        <Button
          variant="link"
          size="sm"
          className="p-0"
          disabled={verifying}
          onClick={() => account.backToEmail()}
        >
          Use a different email
        </Button>
      </div>
    </>
  )
}

export function SignInCard(props: Props) {
  const codeSent = useAccountStore((state) => state.codeSent)
  return codeSent ? <CodeStep {...props} /> : <EmailStep {...props} />
}
