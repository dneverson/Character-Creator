import { useEffect } from 'react'
import Button from 'react-bootstrap/Button'
import { AppFooter } from './components/AppFooter'
import { AppNavbar } from './components/AppNavbar'
import { CharacterList } from './components/CharacterList'
import { ContentNotice } from './components/content/ContentNotice'
import { ContentPrompt } from './components/content/ContentPrompt'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CharacterEditor } from './components/editor/CharacterEditor'
import { LevelUpView } from './components/levelup/LevelUpView'
import { BooksView } from './components/books/BooksView'
import { LegalPage } from './components/legal/LegalPage'
import { LookupView } from './components/lookup/LookupView'
import { SheetView } from './components/sheet/SheetView'
import { StorageNotice } from './components/StorageNotice'
import { useCharacterStore } from './character/store'
import { appConfig } from './config/app'
import { useLegalStore } from './legal/state'

export default function App() {
  const view = useCharacterStore((s) => s.view)
  const legal = useLegalStore((s) => s.page)
  const backToList = useCharacterStore((s) => s.backToList)
  // Keep the document title in sync with the configured app name.
  useEffect(() => {
    document.title = appConfig.name
  }, [])
  return (
    <>
      <AppNavbar />
      <StorageNotice />
      <ContentNotice />
      <ContentPrompt />
      {/* A failure in one view keeps the navbar and footer; the key clears it on leaving
          the view. A broken editor cannot offer its own way back, so the notice does. */}
      <ErrorBoundary
        key={view}
        title="This page"
        page
        actions={
          view !== 'list' && (
            <Button variant="secondary" onClick={backToList}>
              Back to characters
            </Button>
          )
        }
      >
        {legal && <LegalPage page={legal} />}
        {!legal && view === 'editor' && <CharacterEditor />}
        {!legal && view === 'sheet' && <SheetView />}
        {!legal && view === 'levelUp' && <LevelUpView />}
        {!legal && view === 'list' && <CharacterList />}
      </ErrorBoundary>
      <BooksView />
      <LookupView />
      <AppFooter />
    </>
  )
}
