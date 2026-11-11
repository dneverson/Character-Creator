// The app's one content library and its cover library, backed by this browser's
// storage.

import { contentConfig } from '../config/content'
import { openStore } from '../storage/keyValue'
import { createCoverLibrary } from './covers'
import { createContentLibrary } from './library'
import { shrinkImage } from './thumbnail'

export const coverLibrary = createCoverLibrary({
  thumbs: openStore(contentConfig.stores.covers),
  shrink: shrinkImage,
})

export const contentLibrary = createContentLibrary({
  files: openStore(contentConfig.stores.files),
  record: openStore(contentConfig.stores.meta),
  covers: coverLibrary,
})
