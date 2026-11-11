// A stand-in for the app's content library in component tests: every action is a
// spy that succeeds at once. Use it as the mock of `src/content`:
//
//   vi.mock('../../content', async () => ({
//     contentLibrary: (await import('../../test/fakeLibrary')).fakeLibrary,
//   }))

import { vi } from 'vitest'
import type { ContentSource } from '../config/content'

export const fakeLibrary = {
  enable: vi.fn(() => Promise.resolve()),
  disable: vi.fn(),
  remove: vi.fn(() => Promise.resolve()),
  retry: vi.fn(() => Promise.resolve()),
  useSource: vi.fn((source: ContentSource) =>
    Promise.resolve(source).then(() => undefined),
  ),
  checkForUpdate: vi.fn((force?: boolean) => Promise.resolve(force === true)),
  importFiles: vi.fn((picked: File[]) => Promise.resolve(picked.length)),
}
