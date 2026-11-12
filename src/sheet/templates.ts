// The look of the character sheet, apart from its layout. The layout is the components
// and sheet.css, which read only --sheet-* variables. A template is one entry in
// SHEET_TEMPLATES: its name and its tokens for light and dark. Adding a look is adding
// an entry; nothing else changes. Tokens are concrete values (hex colours, rem lengths)
// so a later PDF can read them too. Detail panes are not a template matter: they have
// their own device setting (src/theme/detailStyle.ts).

export interface LookTokens {
  /** Behind everything on the sheet. */
  pageBg: string
  /** Boxes, the switching box and the stat boxes. */
  panelBg: string
  panelBorder: string
  panelBorderWidth: string
  panelBorderStyle: 'solid' | 'double'
  panelRadius: string
  panelShadow: string
  /** Body text. */
  ink: string
  /** Box labels and small print. */
  mutedInk: string
  /** The line under the open tab. */
  accent: string
  /** The open tab's text: the accent as a colour to read. */
  accentInk: string
  tabActiveBg: string
  /** Box labels in capitals or as written. */
  labelTransform: 'uppercase' | 'none'
  /** Box labels in small capitals or plain. */
  labelVariant: 'normal' | 'small-caps'
  headingFont: string
  bodyFont: string
  numberFont: string
}

export interface SheetTemplate {
  id: string
  label: string
  description: string
  tokens: { light: LookTokens; dark: LookTokens }
}

const SYSTEM_FONTS =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', 'Liberation Sans', Arial, sans-serif"
const BOOK_FONTS = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif"

/** The app's own look: Bootstrap's palette and system fonts, as the sheet first looked. */
const appTemplate = {
  id: 'app',
  label: 'App',
  description: 'The same colours and type as the rest of the app.',
  tokens: {
    light: {
      pageBg: '#ffffff',
      panelBg: '#ffffff',
      panelBorder: '#dee2e6',
      panelBorderWidth: '1px',
      panelBorderStyle: 'solid',
      panelRadius: '0.375rem',
      panelShadow: 'none',
      ink: '#212529',
      mutedInk: '#595c5f',
      accent: '#0d6efd',
      accentInk: '#212529',
      tabActiveBg: '#ffffff',
      labelTransform: 'uppercase',
      labelVariant: 'normal',
      headingFont: SYSTEM_FONTS,
      bodyFont: SYSTEM_FONTS,
      numberFont: SYSTEM_FONTS,
    },
    dark: {
      pageBg: '#212529',
      panelBg: '#212529',
      panelBorder: '#495057',
      panelBorderWidth: '1px',
      panelBorderStyle: 'solid',
      panelRadius: '0.375rem',
      panelShadow: 'none',
      ink: '#dee2e6',
      mutedInk: '#afb3b7',
      accent: '#0d6efd',
      accentInk: '#dee2e6',
      tabActiveBg: '#212529',
      labelTransform: 'uppercase',
      labelVariant: 'normal',
      headingFont: SYSTEM_FONTS,
      bodyFont: SYSTEM_FONTS,
      numberFont: SYSTEM_FONTS,
    },
  },
} as const satisfies SheetTemplate

/** A book page: warm paper, dark ink, rubric red, serif type and double rules. */
const parchmentTemplate = {
  id: 'parchment',
  label: 'Parchment',
  description: 'Warm paper, dark ink and serif type, like a printed sheet.',
  tokens: {
    light: {
      pageBg: '#e9dfc6',
      panelBg: '#f4ecd8',
      panelBorder: '#a08b62',
      panelBorderWidth: '3px',
      panelBorderStyle: 'double',
      panelRadius: '0.125rem',
      panelShadow: '0 1px 2px rgb(43 33 24 / 25%)',
      ink: '#2b2118',
      mutedInk: '#5e4f3d',
      accent: '#7a2e1f',
      accentInk: '#7a2e1f',
      tabActiveBg: '#fbf6e9',
      labelTransform: 'none',
      labelVariant: 'small-caps',
      headingFont: BOOK_FONTS,
      bodyFont: BOOK_FONTS,
      numberFont: BOOK_FONTS,
    },
    dark: {
      pageBg: '#1d1812',
      panelBg: '#2a2219',
      panelBorder: '#7a6747',
      panelBorderWidth: '3px',
      panelBorderStyle: 'double',
      panelRadius: '0.125rem',
      panelShadow: '0 1px 2px rgb(0 0 0 / 50%)',
      ink: '#eadfc8',
      mutedInk: '#bfb199',
      accent: '#e08a6e',
      accentInk: '#e8a58c',
      tabActiveBg: '#352b1f',
      labelTransform: 'none',
      labelVariant: 'small-caps',
      headingFont: BOOK_FONTS,
      bodyFont: BOOK_FONTS,
      numberFont: BOOK_FONTS,
    },
  },
} as const satisfies SheetTemplate

export const SHEET_TEMPLATES = [
  appTemplate,
  parchmentTemplate,
] as const satisfies readonly SheetTemplate[]

export type SheetTemplateId = (typeof SHEET_TEMPLATES)[number]['id']

export const DEFAULT_SHEET_TEMPLATE: SheetTemplateId = SHEET_TEMPLATES[0].id

export const isSheetTemplateId = (value: string | null): value is SheetTemplateId =>
  SHEET_TEMPLATES.some((t) => t.id === value)

/** The template with this id, or the first one when the id is unknown. */
export function sheetTemplate(id: string | null): SheetTemplate {
  return SHEET_TEMPLATES.find((t) => t.id === id) ?? SHEET_TEMPLATES[0]
}

/** pageBg becomes --sheet-page-bg and so on: one variable per token. */
export function tokensToCssVars(tokens: LookTokens): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tokens).map(([name, value]) => [
      `--sheet-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
      value,
    ]),
  )
}
