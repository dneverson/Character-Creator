import { useEffect } from 'react'
import Button from 'react-bootstrap/Button'
import { AppFooter } from './components/AppFooter'
import { AccountPanel } from './components/account/AccountPanel'
import { SignInModal } from './components/account/SignInModal'
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
import { SharedView } from './components/share/SharedView'
import { ShareModal } from './components/share/ShareModal'
import { SheetView } from './components/sheet/SheetView'
import { StorageNotice } from './components/StorageNotice'
import { ToastHost } from './components/ToastHost'
import { useCharacterStore } from './character/store'
import { account } from './cloud'
import { appConfig } from './config/app'
import { useLegalStore } from './legal/state'
import { useSharedStore } from './share/state'

export default function App() {
  const view = useCharacterStore((s) => s.view)
  const legal = useLegalStore((s) => s.page)
  const shared = useSharedStore((s) => s.token)
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
        {shared && !legal && <SharedView key={shared} account={account} token={shared} />}
        {legal === 'account' && <AccountPanel account={account} />}
        {legal && legal !== 'account' && <LegalPage page={legal} />}
        {!legal && !shared && view === 'editor' && <CharacterEditor />}
        {!legal && !shared && view === 'sheet' && <SheetView />}
        {!legal && !shared && view === 'levelUp' && <LevelUpView />}
        {!legal && !shared && view === 'list' && <CharacterList />}
      </ErrorBoundary>
      <BooksView />
      <LookupView />
      <AppFooter />
      <SignInModal account={account} />
      <ShareModal account={account} />
      <ToastHost />
    </>
  )
}
