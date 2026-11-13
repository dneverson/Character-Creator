import { useEffect, type ReactNode } from 'react'
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
  const vars = tokensToCssVars(tokens[resolved])
  const pageBg = vars['--sheet-page-bg']
  // The page colour also fills the page below the sheet (the footer's margin), and only
  // while the sheet is open.
  useEffect(() => {
    document.body.classList.add('sheet-page')
    document.body.style.setProperty('--sheet-page-bg', pageBg)
    return () => {
      document.body.classList.remove('sheet-page')
      document.body.style.removeProperty('--sheet-page-bg')
    }
  }, [pageBg])
  return (
    <div className="sheet-root" data-sheet-template={id} style={vars}>
      {children}
    </div>
  )
}
