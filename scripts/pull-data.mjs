#!/usr/bin/env node
// Pull the 5etools data into `.local/data/` (git-ignored, local-only). It is the
// input of `pnpm build-base`, which reduces it to the free rules the site hosts
// under `public/data`. The full data is never committed or deployed: a visitor's
// browser downloads it straight from the source (see src/content).
//
// Source: https://github.com/5etools-mirror-3/5etools-src (data/ directory)
// Enumerated once via the GitHub tree API, downloaded via the jsDelivr CDN.
//
// Usage:  node scripts/pull-data.mjs           (ref = env DATA_REF or "main")
//         DATA_REF=main node scripts/pull-data.mjs
//
// Env:    DATA_REF       git ref/tag/branch to pull (default "main")
//         GITHUB_TOKEN   optional; raises the GitHub API rate limit in CI

import { mkdir, writeFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = '5etools-mirror-3/5etools-src'
const REF = process.env.DATA_REF || 'main'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, '.local', 'data')
const CATALOG_MD = join(ROOT, 'docs', 'DATA_CATALOG.md')
const CONCURRENCY = 8

// Everything under data/ is pulled EXCEPT these - prose-only or other-tool artifacts
// the character creator does not use. Keep this list small; trim more later if wanted.
const EXCLUDE_DIRS = ['data/adventure/', 'data/book/']
const EXCLUDE_FILE_RE =
  /(^|\/)(foundry-|roll20|makebrew-|makecards|converter|renderdemo|changelog|msbcr)/

const jsdelivr = (path) => `https://cdn.jsdelivr.net/gh/${REPO}@${REF}/${path}`
const rawGithub = (path) => `https://raw.githubusercontent.com/${REPO}/${REF}/${path}`

function ghHeaders() {
  const h = { 'User-Agent': 'character-creator-pull-data' }
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  return h
}

// jsDelivr rate-limits bursts with 403/429, so those are retryable here.
const RETRYABLE = new Set([403, 408, 425, 429, 500, 502, 503, 504])

async function fetchWithRetry(url, opts = {}, tries = 5) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, opts)
      if (res.ok) return res
      if (!RETRYABLE.has(res.status)) throw new Error(`HTTP ${res.status} for ${url}`)
      lastErr = new Error(`HTTP ${res.status} for ${url}`)
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** i))
  }
  throw lastErr
}

// Download one path, preferring the jsDelivr CDN and falling back to raw.githubusercontent.
async function fetchFile(path) {
  try {
    return await fetchWithRetry(jsdelivr(path))
  } catch {
    return await fetchWithRetry(rawGithub(path), { headers: ghHeaders() })
  }
}

async function listDataFiles() {
  const url = `https://api.github.com/repos/${REPO}/git/trees/${REF}?recursive=1`
  const res = await fetchWithRetry(url, { headers: ghHeaders() })
  const { tree, truncated } = await res.json()
  if (truncated) {
    throw new Error('GitHub tree response was truncated - cannot enumerate reliably.')
  }
  return tree
    .filter((n) => n.type === 'blob' && n.path.startsWith('data/'))
    .filter((n) => !EXCLUDE_DIRS.some((d) => n.path.startsWith(d)))
    .filter((n) => !EXCLUDE_FILE_RE.test(n.path))
    .map((n) => ({ path: n.path, size: n.size ?? 0 }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

async function downloadOne({ path }) {
  const res = await fetchFile(path)
  const buf = Buffer.from(await res.arrayBuffer())
  // Strip the leading "data/" so files land at `.local/data/<...>`.
  const rel = path.replace(/^data\//, '')
  const dest = join(OUT_DIR, rel)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, buf)
  return buf.length
}

async function runPool(items, worker) {
  const results = new Array(items.length)
  let next = 0
  let done = 0
  async function pump() {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i])
      done++
      if (done % 25 === 0 || done === items.length) {
        process.stdout.write(`  ${done}/${items.length} files\r`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, pump))
  process.stdout.write('\n')
  return results
}

function categoryOf(path) {
  const rel = path.replace(/^data\//, '')
  const slash = rel.indexOf('/')
  return slash === -1 ? '(root)' : rel.slice(0, slash)
}

async function writeCatalog(files, bytesByPath) {
  const byCat = new Map()
  for (const f of files) {
    const cat = categoryOf(f.path)
    const entry = byCat.get(cat) ?? { count: 0, bytes: 0 }
    entry.count++
    entry.bytes += bytesByPath.get(f.path) ?? f.size
    byCat.set(cat, entry)
  }
  const cats = [...byCat.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const totalBytes = [...bytesByPath.values()].reduce((a, b) => a + b, 0)
  const mb = (n) => (n / 1024 / 1024).toFixed(2)

  const lines = [
    '# 5etools Data Catalog',
    '',
    '> Auto-generated by `scripts/pull-data.mjs`. Do not edit by hand.',
    `> Source: \`${REPO}\` @ \`${REF}\` · pulled ${new Date().toISOString()}`,
    '',
    'The data itself lives in `.local/data/` (git-ignored, local-only). `pnpm build-base`',
    'reduces it to the free rules the site hosts under `public/data`; the rest reaches a',
    "visitor's browser straight from the source. This file is the committed index of",
    '**what data is available** for building features.',
    '',
    `**Totals:** ${files.length} files · ${mb(totalBytes)} MB`,
    '',
    '| Category | Files | Size (MB) |',
    '| --- | ---: | ---: |',
    ...cats.map(([c, e]) => `| \`${c}\` | ${e.count} | ${mb(e.bytes)} |`),
    '',
    '## Excluded (not pulled)',
    '',
    '- `data/adventure/`, `data/book/` - long-form prose, unused by the creator.',
    "  (The app reads a book's text in the browser, when the book is opened, to",
    '  work out its contents page numbers.)',
    '- `foundry-*`, `roll20*`, `makebrew-*`, `makecards`, `converter`, `renderdemo`,',
    '  `changelog`, `msbcr` - other-tool / meta artifacts.',
    '',
    'Adjust `EXCLUDE_DIRS` / `EXCLUDE_FILE_RE` in `scripts/pull-data.mjs` to change this.',
    '',
  ]
  await mkdir(dirname(CATALOG_MD), { recursive: true })
  await writeFile(CATALOG_MD, lines.join('\n'))
}

async function main() {
  console.log(`Pulling 5etools data from ${REPO}@${REF} …`)
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })

  const files = await listDataFiles()
  console.log(`  ${files.length} data files to download (via jsDelivr CDN)`)

  const sizes = await runPool(files, downloadOne)
  const bytesByPath = new Map(files.map((f, i) => [f.path, sizes[i]]))
  const totalBytes = sizes.reduce((a, b) => a + b, 0)

  const manifest = {
    repo: REPO,
    ref: REF,
    pulledAt: new Date().toISOString(),
    fileCount: files.length,
    totalBytes,
    files: files.map((f) => f.path.replace(/^data\//, '')),
  }
  await writeFile(join(OUT_DIR, '_manifest.json'), JSON.stringify(manifest, null, 2))
  await writeCatalog(files, bytesByPath)

  // The files are kept exactly as the source has them. What the app adds on top
  // (contents page numbers, cover thumbnails) is worked out in the browser, from
  // the same source: see src/data/bookPages.ts and src/content/covers.ts.

  console.log(
    `Done. ${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MB → .local/data/`,
  )
  console.log('Catalog written to docs/DATA_CATALOG.md')
}

main().catch((err) => {
  console.error('\npull-data failed:', err.message)
  process.exit(1)
})
