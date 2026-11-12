import type { ReactNode } from 'react'
import {
  sheetTemplate,
  tokensToCssVars,
  type SheetTemplateId,
} from '../../sheet/templates'
import { useTheme } from '../../theme/theme-context'

/** Wraps the sheet in its template: the id as an attribute, the tokens as variables. */
export function SheetRoot({
  template,
  children,
}: {
  template: SheetTemplateId
  children: ReactNode
}) {
  const { resolved } = useTheme()
  const { id, tokens } = sheetTemplate(template)
  return (
    <div
      className="sheet-root"
      data-sheet-template={id}
      style={tokensToCssVars(tokens[resolved])}
    >
      {children}
    </div>
  )
}
