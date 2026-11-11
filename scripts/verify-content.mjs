// Browser check of the content loader: the parts unit tests cannot reach because
// jsdom has no IndexedDB, no canvas and no network.
//
// Drives a real browser against a running dev or preview server and checks that
//   - a first visit shows the books quickly, with cover thumbnails made in the browser;
//   - opening a book shows the page numbers of its contents, read from its text;
//   - the content ends up stored in IndexedDB, and the thumbnails are small images;
//   - a second visit is answered from storage without asking the source for data;
//   - with the source blocked, a first visit still works on the free rules, and a
//     returning visit works on what is stored.
//
// Usage:  pnpm dev            (in another terminal)
//         pnpm verify:content
//
// Env:    CC_URL   the app's address (default http://localhost:5173/)
//
// This talks to the real content source, so it needs network access and is not
// part of `pnpm validate`. Exit code 1 when a check fails.

import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const APP_URL = process.env.CC_URL ?? 'http://localhost:5173/'
const OUT = '.local/screenshots'
const SOURCE_HOSTS =
  /^https:\/\/(cdn\.jsdelivr\.net|raw\.githubusercontent\.com|api\.github\.com)\//
const DATA_REQUEST = /\/data\/.+\.json$/
mkdirSync(OUT, { recursive: true })

let failed = 0
function check(name, pass, detail = '') {
  if (!pass) failed++
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

/** Read everything the content library stored, from inside the page. */
function readStorage(page) {
  return page.evaluate(async () => {
    function open(name) {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(name)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    }
    async function all(name, method, key) {
      const database = await open(name)
      if (!database.objectStoreNames.contains('entries'))
        return method === 'get' ? null : []
      return new Promise((resolve, reject) => {
        const store = database.transaction('entries').objectStore('entries')
        const request = method === 'get' ? store.get(key) : store.getAllKeys()
        request.onsuccess = () => resolve(request.result ?? null)
        request.onerror = () => reject(request.error)
      })
    }
    const record = await all('cc-content-meta', 'get', 'library')
    const files = await all('cc-content-files', 'keys')
    const covers = await all('cc-content-covers', 'keys')
    let thumb = null
    if (covers.length > 0) {
      const blob = await all('cc-content-covers', 'get', covers[0])
      const bitmap = await createImageBitmap(blob)
      thumb = {
        type: blob.type,
        size: blob.size,
        width: bitmap.width,
        height: bitmap.height,
      }
    }
    return { record, files, covers, thumb }
  })
}

async function openBooks(page) {
  const started = Date.now()
  await page.goto(APP_URL)
  await page.getByRole('button', { name: '+ New Character' }).click()
  const books = page.getByRole('table', { name: 'Available books' })
  await books.waitFor({ timeout: 30_000 })
  return { books, listedMs: Date.now() - started }
}

function watch(page) {
  const requests = []
  const errors = []
  page.on('request', (request) => requests.push(request.url()))
  page.on('pageerror', (error) => errors.push(error.message))
  return {
    errors,
    source: () => requests.filter((url) => SOURCE_HOSTS.test(url)),
    sourceData: () =>
      requests.filter((url) => SOURCE_HOSTS.test(url) && DATA_REQUEST.test(url)),
    reset: () => (requests.length = 0),
  }
}

const browser = await chromium.launch()

// --- A first visit, then a second one in the same browser profile -----------
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const seen = watch(page)

  const { books, listedMs } = await openBooks(page)
  check(
    'first visit: the books are listed',
    (await books.getByRole('row').count()) > 20,
    `${listedMs} ms after opening the page`,
  )
  check(
    'first visit: the full content answered',
    seen.sourceData().some((url) => url.endsWith('/data/books.json')),
  )

  // A cover is a spinner or an image, never an empty cell.
  const coverCell = books.getByRole('row').nth(1).getByRole('cell').nth(1)
  const early = await coverCell.innerHTML()
  check('first visit: a cover cell is never blank', /spinner-border|<img/.test(early))

  const started = Date.now()
  await books.locator('img[src^="blob:"]').first().waitFor({ timeout: 30_000 })
  check(
    'first visit: cover thumbnails appear',
    true,
    `${Date.now() - started} ms after the list`,
  )
  await page.screenshot({ path: `${OUT}/content-first-visit.png` })

  // A book's contents gain their page numbers from the book's text, read when its
  // details are opened.
  const pagesStarted = Date.now()
  await books
    .getByText(/Player.s Handbook/)
    .first()
    .click()
  const paged = await page
    .getByText(/^p\. \d+$/)
    .first()
    .waitFor({ timeout: 30_000 })
    .then(
      () => true,
      () => false,
    )
  check(
    'first visit: a book shows the page numbers of its contents',
    paged,
    `${Date.now() - pagesStarted} ms after opening the book`,
  )
  await page.screenshot({ path: `${OUT}/content-book-pages.png` })

  // Let the background download finish: first the data, then the thumbnails.
  const fillStarted = Date.now()
  let stored = await readStorage(page)
  let settled = 0
  while (Date.now() - fillStarted < 300_000 && settled < 3) {
    await page.waitForTimeout(2000)
    const next = await readStorage(page)
    const unchanged =
      next.record?.complete === true &&
      next.files.length === stored.files.length &&
      next.covers.length === stored.covers.length
    settled = unchanged ? settled + 1 : 0
    stored = next
  }
  console.log(
    `      background download settled after about ${Math.round((Date.now() - fillStarted) / 1000)} s`,
  )

  check('storage: the content is marked complete', stored.record?.complete === true)
  check(
    'storage: the version is known',
    /^[0-9a-f]{40}$/.test(stored.record?.commit ?? ''),
    stored.record?.commit,
  )
  check(
    'storage: data files are stored',
    stored.files.length > 100,
    `${stored.files.length} files`,
  )
  check(
    'storage: cover thumbnails are stored',
    stored.covers.length > 40,
    `${stored.covers.length} thumbnails`,
  )
  check(
    'storage: a thumbnail is a small image',
    stored.thumb !== null &&
      stored.thumb.type.startsWith('image/') &&
      stored.thumb.width <= 96 &&
      stored.thumb.size < 20_000,
    stored.thumb
      ? `${stored.thumb.type} ${stored.thumb.width}x${stored.thumb.height}, ${stored.thumb.size} bytes`
      : 'none',
  )
  check('first visit: no page errors', seen.errors.length === 0, seen.errors.join(' | '))

  // Second visit.
  seen.reset()
  const again = await openBooks(page)
  await again.books.locator('img[src^="blob:"]').first().waitFor({ timeout: 10_000 })
  check(
    'second visit: the books are listed from storage',
    true,
    `${again.listedMs} ms after opening the page`,
  )
  check(
    'second visit: no data is asked of the source',
    seen.sourceData().length === 0,
    `${seen.sourceData().length} requests`,
  )
  check(
    'second visit: no version check within the interval',
    seen.source().filter((url) => url.includes('api.github.com')).length === 0,
  )

  // Returning visit with the source gone: stored content still answers.
  await context.route(SOURCE_HOSTS, (route) => route.abort())
  seen.reset()
  const offline = await openBooks(page)
  await offline.books.locator('img[src^="blob:"]').first().waitFor({ timeout: 10_000 })
  check(
    'source gone, returning visit: books and covers come from storage',
    (await offline.books.getByRole('row').count()) > 20,
  )

  await context.close()
}

// --- A first visit with the source blocked: the free rules answer ------------
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.route(SOURCE_HOSTS, (route) => route.abort())
  const page = await context.newPage()
  const seen = watch(page)

  const { books, listedMs } = await openBooks(page)
  check(
    'source gone, first visit: the free rules list their books',
    (await books.getByRole('row').count()) > 1,
    `${listedMs} ms after opening the page`,
  )
  check(
    'source gone, first visit: no page errors',
    seen.errors.length === 0,
    seen.errors.join(' | '),
  )
  await page.screenshot({ path: `${OUT}/content-free-rules.png` })
  await context.close()
}

await browser.close()
console.log(
  failed === 0 ? '\nAll content checks passed.' : `\n${failed} content check(s) failed.`,
)
process.exit(failed === 0 ? 0 : 1)
