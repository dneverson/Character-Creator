import Button from 'react-bootstrap/Button'
import { openBook } from '../../books/state'
import { useTheme } from '../../theme/theme-context'

/** The navbar's button for the book reader, opened on its shelf. */
export function BooksButton() {
  const { resolved } = useTheme()
  return (
    <Button
      variant={resolved === 'dark' ? 'light' : 'secondary'}
      size="sm"
      title="Read the books and search their text"
      onClick={() => openBook(null)}
    >
      Books
    </Button>
  )
}
