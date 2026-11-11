/**
 * Start content work that carries on by itself (a download, a retry). Its
 * progress and its outcome show through the content status, so nothing waits on
 * it here and a failure needs no handling of its own.
 */
export function inBackground(work: Promise<unknown>): void {
  work.catch(() => undefined)
}
