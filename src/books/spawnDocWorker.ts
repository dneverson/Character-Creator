// Starts the worker that reads documents for the search index, or says there is none.
// A thin wrapper over a browser feature jsdom does not have.

import type { WorkerPort } from './docReader'

export function spawnDocWorker(): WorkerPort | undefined {
  return typeof Worker === 'undefined'
    ? undefined
    : new Worker(new URL('./docTokens.worker.ts', import.meta.url), { type: 'module' })
}
