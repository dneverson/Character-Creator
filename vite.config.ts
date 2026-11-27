/// <reference types="vitest/config" />
import { availableParallelism } from 'node:os'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The free rules the site hosts are plain files under `public/data` (built by
// `pnpm build-base`), so Vite serves and ships them like any other public file.

// GitHub Pages project site is served from /<repo>/ - only in production builds.
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Character-Creator/' : '/',
  plugins: [react()],
  server: {
    watch: {
      // Don't reload on writes to generated/output dirs: the coverage HTML
      // reporter (`pnpm validate`) alone rewrites hundreds of files and would
      // otherwise storm HMR with page reloads. `.local` holds pulled data and
      // Playwright screenshots; `dist` is the build output.
      ignored: ['**/coverage/**', '**/.local/**', '**/dist/**'],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Vitest's default is one worker per logical core minus one. Each worker boots a jsdom
    // and re-imports the app's module graph per file, which is disk- and memory-bound, so
    // on a many-thread machine that many workers just starve each other: measured on 22
    // threads, 21 workers took 159 s and timed tests out, 11 took 99 s and none did.
    maxWorkers: Math.max(2, Math.floor(availableParallelism() / 2)),
    // `.local` holds the pulled data, screenshots and the deploy worktree: its copy of the
    // tests belongs to another branch and is not this checkout's.
    exclude: ['**/node_modules/**', '**/dist/**', '.local/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Only measure app source; exclude tests, type-only files, and the two
      // untestable entrypoints (DOM bootstrap + Vite/vitest config).
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/test/**',
        'src/main.tsx',
        // Type-only module (interfaces only) - no executable code to cover.
        'src/data/types.ts',
        // Thin wrappers over browser features jsdom does not have (IndexedDB;
        // image decoding and a canvas). They are exercised in a real browser instead
        // (`pnpm verify:content` for the first two; the portrait editor by hand).
        'src/storage/idb.ts',
        'src/content/thumbnail.ts',
        'src/portrait/imageFile.ts',
        // The one real cloud backend (it needs the network and an account, so it is not run
        // in unit tests; its parsing and error handling are in backend.ts, which is) and the
        // wiring of the app's own account (it reads the address bar and loads the backend).
        'src/cloud/supabaseBackend.ts',
        'src/cloud/index.ts',
        // Start the book search's worker, and its three-line entry: a worker is a browser
        // feature jsdom does not have. The logic they call is tested (`docReader`).
        'src/books/spawnDocWorker.ts',
        'src/books/docTokens.worker.ts',
      ],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
      },
    },
  },
}))
