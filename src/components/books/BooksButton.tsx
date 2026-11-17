import Button from 'react-bootstrap/Button'
import { appConfig } from '../../config/app'
import { useShortcut } from '../../hooks/useShortcut'
import { openBook, useBookStore } from '../../books/state'
import { useTheme } from '../../theme/theme-context'

/** Opens the shelf from the key, unless the reader is already open. */
function openShelf(): void {
  if (!useBookStore.getState().open) openBook(null)
}

/** The navbar's button for the book reader, opened on its shelf, and the key that opens it. */
export function BooksButton() {
  const { resolved } = useTheme()
  useShortcut(appConfig.books.shortcut, openShelf)
  return (
    <Button
      variant={resolved === 'dark' ? 'light' : 'secondary'}
      size="sm"
      aria-keyshortcuts={appConfig.books.shortcut}
      title={`Read the books and search their text (${appConfig.books.shortcut})`}
      onClick={() => openBook(null)}
    >
      Books
    </Button>
  )
}
