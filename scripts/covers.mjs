#!/usr/bin/env node
// Pull book cover images from the 5etools image mirror and generate small WebP
// thumbnails for table rows. Imported by pull-data.mjs (so CI produces covers
// alongside the JSON) and usable standalone against an existing books.json.
//
//   Full cover → .local/data/covers/<X>.webp        (detail-pane hero image)
//   Thumbnail  → .local/data/covers/<X>.thumb.webp  (static table-row thumbnail)
//
// The thumbnail is the speed win: a table of covers ships a few KB per row
// instead of the full ~380 KB image, so the grid stays fast even at hundreds of
// rows. The full cover loads only in the detail pane, one row at a time.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

// Covers live in a separate image repo from the data repo, on its own `main`.
const IMG_REPO = '5etools-mirror-3/5etools-img'
// Table rows show a cover ~40px tall; a 96px-wide WebP stays crisp at 2x while
// weighing only a few KB.
const THUMB_WIDTH = 96
const CONCURRENCY = 6
// jsDelivr rate-limits bursts with 403/429, so those are retryable.
const RETRYABLE = new Set([403, 408, 425, 429, 500, 502, 503, 504])

const jsdelivr = (ref, path) => `https://cdn.jsdelivr.net/gh/${IMG_REPO}@${ref}/${path}`
const raw = (ref, path) => `https://raw.githubusercontent.com/${IMG_REPO}/${ref}/${path}`

// Try the CDN first, then the raw host. jsDelivr mirrors most covers but not all
// (some 403/404 there while present on raw), so the fallback is required, not a
// nicety - the same two-host pattern the data pull uses.
async function fetchCover(ref, path, tries = 4) {
  let lastErr
  for (const url of [jsdelivr(ref, path), raw(ref, path)]) {
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(url)
        if (res.ok) return res
        if (!RETRYABLE.has(res.status)) {
          lastErr = new Error(`HTTP ${res.status} for ${url}`)
          break // non-retryable on this host; fall through to the next host
        }
        lastErr = new Error(`HTTP ${res.status} for ${url}`)
      } catch (err) {
        lastErr = err
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** i))
    }
  }
  throw lastErr
}

/** The thumbnail sibling path for a cover path (`covers/PHB.webp` → `covers/PHB.thumb.webp`). */
export function thumbPath(coverPath) {
  return coverPath.replace(/\.webp$/i, '.thumb.webp')
}

// Fetch one cover and write both the full image and its generated thumbnail.
async function pullOne(coverPath, outDir, ref) {
  const res = await fetchCover(ref, coverPath)
  const buf = Buffer.from(await res.arrayBuffer())
  const full = join(outDir, coverPath)
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, buf)
  const thumb = await sharp(buf)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer()
  await writeFile(join(outDir, thumbPath(coverPath)), thumb)
  return buf.length + thumb.length
}

/**
 * Pull every distinct internal cover referenced by `books` into `<outDir>/covers/`,
 * generating a thumbnail beside each. Missing covers are skipped (logged), never fatal.
 */
export async function pullCovers({ books, outDir, ref = 'main', log = () => {} }) {
  const paths = [
    ...new Set(
      books
        .filter((b) => b?.cover?.type === 'internal' && b.cover.path)
        .map((b) => b.cover.path),
    ),
  ]
  log(`  ${paths.length} book covers to fetch (via jsDelivr, from ${IMG_REPO})`)
  // A shared cursor is safe (each worker reads-then-increments synchronously),
  // but the totals must NOT be shared counters: `+=` across an await is a
  // lost-update race under concurrency. Each worker sums its own slice; we fold
  // the per-worker results after they all finish.
  let next = 0
  async function pump() {
    let bytes = 0
    let failed = 0
    while (next < paths.length) {
      const p = paths[next++]
      try {
        bytes += await pullOne(p, outDir, ref)
      } catch (err) {
        failed++
        log(`    ! skipped ${p}: ${err.message}`)
      }
    }
    return { bytes, failed }
  }
  const results = await Promise.all(Array.from({ length: CONCURRENCY }, pump))
  const bytes = results.reduce((sum, r) => sum + r.bytes, 0)
  const failed = results.reduce((sum, r) => sum + r.failed, 0)
  log(
    `  covers: ${paths.length - failed}/${paths.length} ok, ${failed} failed, ${(
      bytes /
      1024 /
      1024
    ).toFixed(2)} MB`,
  )
  return { count: paths.length, failed, bytes }
}
