import CloseButton from 'react-bootstrap/CloseButton'
import Toast from 'react-bootstrap/Toast'
import ToastContainer from 'react-bootstrap/ToastContainer'
import { appConfig } from '../config/app'
import { dismissToast, useToasts } from '../ui/toasts'
import { Icon } from './Icon'

/** The corner where toasts appear, above everything including open windows. */
export function ToastHost() {
  const toasts = useToasts((state) => state.toasts)
  return (
    <ToastContainer className="toast-host p-3">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          autohide
          delay={appConfig.toastMs}
          onClose={() => dismissToast(toast.id)}
          className="text-bg-success border-0"
        >
          <Toast.Body className="d-flex align-items-center gap-2">
            <Icon name="check" />
            <span className="me-auto">{toast.message}</span>
            <CloseButton
              variant="white"
              aria-label="Dismiss"
              onClick={() => dismissToast(toast.id)}
            />
          </Toast.Body>
        </Toast>
      ))}
    </ToastContainer>
  )
}
