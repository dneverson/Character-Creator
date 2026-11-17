import Button from 'react-bootstrap/Button'
import { appConfig } from '../../config/app'
import { useShortcut } from '../../hooks/useShortcut'
import { useLookupStore } from '../../lookup/state'
import { useTheme } from '../../theme/theme-context'

/** The navbar's button for Quick lookup, with the key that opens it from anywhere. */
export function LookupButton() {
  const { resolved } = useTheme()
  const openLookup = useLookupStore((s) => s.openLookup)
  useShortcut(appConfig.lookup.shortcut, openLookup)
  return (
    <Button
      variant={resolved === 'dark' ? 'light' : 'secondary'}
      size="sm"
      aria-keyshortcuts={appConfig.lookup.shortcut}
      title={`Look up any spell, item, rule or class (${appConfig.lookup.shortcut})`}
      onClick={() => openLookup()}
    >
      Lookup
    </Button>
  )
}
