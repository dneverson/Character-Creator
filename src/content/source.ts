// Network access to a content source: downloading one file, and the two small
// requests behind the version check. Nothing here stores anything.

import { contentConfig } from '../config/content'

/** A file could not be downloaded from any host of the source. */
export class SourceError extends Error {
  /** True when every host answered "not found": the file does not exist there. */
  readonly missing: boolean

  constructor(path: string, missing: boolean) {
    super(
      missing
        ? `"${path}" does not exist at the content source`
        : `"${path}" could not be downloaded from the content source`,
    )
    this.name = 'SourceError'
    this.missing = missing
  }
}

/**
 * Download one file of a repository, trying each configured host in order.
 * `priority` is a hint to the browser: 'high' for something the user is waiting
 * on, 'low' for background work.
 */
export async function fetchFromSource(
  repository: string,
  ref: string,
  path: string,
  priority: RequestPriority,
): Promise<Response> {
  let missing = true
  for (const host of contentConfig.hosts) {
    try {
      const response = await fetch(host(repository, ref, path), { priority })
      if (response.ok) return response
      if (response.status !== 404) missing = false
    } catch {
      missing = false
    }
  }
  throw new SourceError(path, missing)
}

const COMMIT_ID = /^[0-9a-f]{40}$/

/**
 * The id of the latest commit on a branch, or `null` when it cannot be read
 * (offline, rate limited, repository gone). A 40-byte answer: the whole cost of
 * the version check when nothing has changed.
 */
export async function latestCommit(
  repository: string,
  ref: string,
): Promise<string | null> {
  try {
    const response = await fetch(contentConfig.api.commit(repository, ref), {
      headers: { Accept: 'application/vnd.github.sha' },
      priority: 'low',
    })
    if (!response.ok) return null
    const id = (await response.text()).trim()
    return COMMIT_ID.test(id) ? id : null
  } catch {
    return null
  }
}

interface TreeResponse {
  truncated?: boolean
  tree?: { path?: string; type?: string; sha?: string }[]
}

/**
 * The content id of every data file in a commit, keyed by its path inside the
 * data folder, or `null` when the listing cannot be read in full.
 */
export async function commitFiles(
  repository: string,
  commit: string,
): Promise<Map<string, string> | null> {
  try {
    const response = await fetch(contentConfig.api.tree(repository, commit), {
      priority: 'low',
    })
    if (!response.ok) return null
    const listing = (await response.json()) as TreeResponse
    if (listing.truncated || !Array.isArray(listing.tree)) return null
    const prefix = `${contentConfig.dataFolder}/`
    const files = new Map<string, string>()
    for (const node of listing.tree) {
      if (node.type === 'blob' && node.sha && node.path?.startsWith(prefix)) {
        files.set(node.path.slice(prefix.length), node.sha)
      }
    }
    return files
  } catch {
    return null
  }
}

/**
 * The content id git gives a file with these bytes (the SHA-1 of a `blob` header
 * plus the bytes). Computing it locally lets a stored file be compared with a
 * commit's file list without downloading the file again.
 */
export async function contentId(body: Uint8Array): Promise<string> {
  const header = new TextEncoder().encode(`blob ${body.length}\0`)
  const bytes = new Uint8Array(header.length + body.length)
  bytes.set(header)
  bytes.set(body, header.length)
  const digest = await crypto.subtle.digest('SHA-1', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
