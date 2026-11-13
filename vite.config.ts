/// <reference types="vitest/config" />
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
      ],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
      },
    },
  },
}))
