// Guards what this site publishes under `public/data`: it must be exactly what
// the SRD rules produce, with the license notice beside it. A file or an entry
// added by hand that the rules would not keep fails here.

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildBase, licenseNotice } from './srd-base.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = join(ROOT, 'public', 'data')

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))

async function list(folder, prefix = '') {
  const paths = []
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      paths.push(...(await list(join(folder, entry.name), `${prefix}${entry.name}/`)))
    } else {
      paths.push(prefix + entry.name)
    }
  }
  return paths.sort((a, b) => a.localeCompare(b))
}

describe('the published free rules', async () => {
  const srd = await readJson(join(ROOT, 'src', 'config', 'srd.json'))
  const flags = srd.documents.map((document) => document.flag)
  const paths = await list(DATA_DIR)
  const published = new Map()
  for (const path of paths.filter((path) => path.endsWith('.json'))) {
    published.set(path, await readJson(join(DATA_DIR, path)))
  }

  it('hold only what the SRD rules keep', () => {
    const { files, report } = buildBase(published, flags)
    expect(report.problems).toEqual([])
    expect(report.removed).toEqual([])
    expect(report.renamed).toEqual([])
    expect([...files.keys()]).toEqual([...published.keys()])
    for (const [path, json] of files) expect(json, path).toEqual(published.get(path))
  })

  it('carry the license notice, and no other kind of file', async () => {
    expect(paths.filter((path) => !path.endsWith('.json'))).toEqual(['LICENSE.md'])
    const notice = await readFile(join(DATA_DIR, 'LICENSE.md'), 'utf8')
    expect(notice).toBe(licenseNotice(srd))
  })

  it('include what the editor loads first', () => {
    for (const path of ['books.json', 'class/index.json', 'spells/index.json']) {
      expect(published.has(path), path).toBe(true)
    }
  })
})
