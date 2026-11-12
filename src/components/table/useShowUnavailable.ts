// Whether a table lists the choices that are not available (greyed non-standard
// rows). On by default, and remembered per table on this device like the table's
// columns.

import { useState } from 'react'
import { deviceSettings } from '../../storage/deviceSettings'

const keyOf = (tableId: string) => `charcreator.table:${tableId}:show-unavailable`

export function useShowUnavailable(tableId: string): [boolean, (show: boolean) => void] {
  const [show, setShow] = useState(() => deviceSettings.getItem(keyOf(tableId)) !== 'off')
  return [
    show,
    (next) => {
      setShow(next)
      deviceSettings.setItem(keyOf(tableId), next ? 'on' : 'off')
    },
  ]
}
