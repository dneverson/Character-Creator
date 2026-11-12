import { useCallback, useState } from 'react'
import { appConfig } from '../config/app'
import { deviceSettings } from '../storage/deviceSettings'
import {
  DEFAULT_SHEET_TEMPLATE,
  isSheetTemplateId,
  type SheetTemplateId,
} from './templates'

const KEY = appConfig.storageKeys.sheetTemplate

function readStored(): SheetTemplateId {
  const stored = deviceSettings.getItem(KEY)
  return isSheetTemplateId(stored) ? stored : DEFAULT_SHEET_TEMPLATE
}

/** The sheet's look, remembered on this device. An unknown stored id gives the default. */
export function useSheetTemplate(): [SheetTemplateId, (id: SheetTemplateId) => void] {
  const [id, setId] = useState<SheetTemplateId>(readStored)
  const choose = useCallback((next: SheetTemplateId) => {
    setId(next)
    if (next === DEFAULT_SHEET_TEMPLATE) deviceSettings.removeItem(KEY)
    else deviceSettings.setItem(KEY, next)
  }, [])
  return [id, choose]
}
