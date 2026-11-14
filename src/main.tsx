import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './index.css'
import App from './App.tsx'
import { connectCharacterStorage } from './character/persistence.ts'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { appConfig } from './config/app.ts'
import { contentLibrary } from './content/index.ts'
import { characterStorage } from './storage/index.ts'
import { connectLocation } from './app/location.ts'
import { ThemeProvider } from './theme/ThemeProvider.tsx'

// Bring the book content stored in this browser up to date, in the background.
// Started here rather than in a component so it runs once per page load. If it
// fails the app carries on with the content it already has.
contentLibrary.start().catch(() => undefined)

// Read the stored characters before the first render, so the list never shows as
// empty and then fills. Reading takes a few milliseconds; a browser whose storage
// does not answer is not waited for, and its characters appear once it does.
const loaded = connectCharacterStorage(characterStorage)
await Promise.race([
  loaded,
  new Promise((resolve) => setTimeout(resolve, appConfig.characterLoadWaitMs)),
])

// The address bar follows the app and the app follows the address bar (reload, Back),
// from when the stored characters are in, so the address can name one of them.
connectLocation(loaded)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {/* Last line of defence: anything the inner boundaries do not contain. */}
      <ErrorBoundary title={appConfig.name} page>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
)
