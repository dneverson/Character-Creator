import Dropdown from 'react-bootstrap/Dropdown'
import { DETAIL_STYLES } from '../theme/detailStyle'
import { useTheme } from '../theme/theme-context'
import type { ThemeMode } from '../theme/theme-context'
import { Icon, type IconName } from './Icon'

const OPTIONS: { mode: ThemeMode; label: string; icon: IconName }[] = [
  { mode: 'light', label: 'Light', icon: 'themeLight' },
  { mode: 'dark', label: 'Dark', icon: 'themeDark' },
  { mode: 'auto', label: 'System', icon: 'themeSystem' },
]

/** Theme switcher: Light / Dark / System, persisted per browser. */
export function ThemeToggle() {
  const { mode, resolved, setMode, detailStyle, setDetailStyle } = useTheme()
  const current = OPTIONS.find((o) => o.mode === mode) ?? OPTIONS[2]

  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        variant={resolved === 'dark' ? 'light' : 'secondary'}
        size="sm"
        id="theme-toggle"
        aria-label={`Theme: ${current.label}`}
      >
        <Icon name={current.icon} />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {OPTIONS.map((o) => (
          <Dropdown.Item
            key={o.mode}
            active={o.mode === mode}
            onClick={() => setMode(o.mode)}
          >
            <Icon name={o.icon} className="me-2" />
            {o.label}
          </Dropdown.Item>
        ))}
        <Dropdown.Divider />
        <Dropdown.Header>Detail pane style</Dropdown.Header>
        {DETAIL_STYLES.map((o) => (
          <Dropdown.Item
            key={o.style}
            active={o.style === detailStyle}
            onClick={() => setDetailStyle(o.style)}
          >
            {o.label}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  )
}
