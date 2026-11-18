// The worker that reads documents for the search index: see `docReader`.

import { readStoredOnly } from '../data/dataClient'
import { answer, transferOf, type DocRequest } from './docReader'

readStoredOnly()

addEventListener('message', async (event: MessageEvent<DocRequest>) => {
  const reply = await answer(event.data)
  postMessage(reply, { transfer: transferOf(reply) })
})
