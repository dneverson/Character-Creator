// How a detail pane is drawn: the plain table of facts, or laid out like a book entry
// (on the page, or on a parchment panel). One setting for every detail pane, kept on
// the device and applied as `data-detail-style` on the document root; the look itself
// is the `--detail-*` variables in index.css, so a later template can supply the same
// variables without touching a component.

export type DetailStyle = 'standard' | 'book' | 'parchment'

export const DETAIL_STYLES: { style: DetailStyle; label: string }[] = [
  { style: 'standard', label: 'Standard' },
  { style: 'book', label: 'Book' },
  { style: 'parchment', label: 'Parchment' },
]

export const isDetailStyle = (value: string | null): value is DetailStyle =>
  value === 'book' || value === 'parchment' || value === 'standard'

/**
 * The colours of the book styles, in light and dark: the title, and the ink on its
 * ground. Mirrored in index.css (a test keeps the two in step and checks the
 * contrast). The plain book style sits on the page, so its ground and ink are
 * Bootstrap's own.
 */
export const DETAIL_PALETTE = {
  light: {
    title: '#7a1f1f',
    book: { ground: '#ffffff', ink: '#212529' },
    parchment: { ground: '#fdf1dc', ink: '#2b2118', border: '#dcc9a3' },
  },
  dark: {
    title: '#e0c080',
    book: { ground: '#212529', ink: '#dee2e6' },
    parchment: { ground: '#2b2722', ink: '#eadfc8', border: '#4a4237' },
  },
} as const
