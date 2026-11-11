#!/usr/bin/env node
// Build the free rules this site hosts.
//
// Reads the full data from `.local/data` (fetch it first with `pnpm pull-data`),
// reduces it to the System Reference Document content (see `srd-base.mjs` for the
// rules) and writes the result to `public/data`, which is committed and served
// as it is. Nothing is written when the result has a problem.
//
// Usage:  pnpm build-base

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBase, licenseNotice } from './srd-base.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FULL_DIR = join(ROOT, '.local', 'data')
const OUT_DIR = join(ROOT, 'public', 'data')
const SRD_CONFIG = join(ROOT, 'src', 'config', 'srd.json')
const NOTICE_FILE = 'LICENSE.md'

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))

/** Every JSON file under a folder, as paths relative to it with forward slashes. */
async function listJson(folder, prefix = '') {
  const paths = []
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      paths.push(...(await listJson(join(folder, entry.name), `${prefix}${entry.name}/`)))
    } else if (entry.name.endsWith('.json')) {
      paths.push(prefix + entry.name)
    }
  }
  return paths
}

async function readFullData() {
  let paths
  try {
    paths = await listJson(FULL_DIR)
  } catch {
    throw new Error('`.local/data` is missing - run `pnpm pull-data` first.')
  }
  const files = new Map()
  for (const path of paths) files.set(path, await readJson(join(FULL_DIR, path)))
  return files
}

const kilobytes = (bytes) => `${(bytes / 1024).toFixed(1)} kB`

async function main() {
  const srd = await readJson(SRD_CONFIG)
  const flags = srd.documents.map((document) => document.flag)
  const full = await readFullData()
  const { files, report } = buildBase(full, flags)

  if (report.problems.length > 0) {
    console.error(`${report.problems.length} problems - nothing was written:`)
    for (const problem of report.problems) console.error(`  ${problem}`)
    process.exitCode = 1
    return
  }

  await rm(OUT_DIR, { recursive: true, force: true })
  let total = 0
  for (const [path, json] of files) {
    const text = JSON.stringify(json)
    const file = join(OUT_DIR, path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, text)
    total += text.length
    const counts = Object.entries(json)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => `${key} ${value.length}`)
    console.log(`${path}  ${kilobytes(text.length)}  ${counts.join(', ')}`)
  }
  await writeFile(join(OUT_DIR, NOTICE_FILE), licenseNotice(srd))

  console.log(`\nSources: ${report.sources.join(', ')}`)
  console.log(`\nNamed as the SRD names them (${report.renamed.length}):`)
  for (const line of report.renamed) console.log(`  ${line}`)
  console.log(
    `\nReferences to entries outside the SRD, removed (${report.removed.length}):`,
  )
  for (const line of report.removed) console.log(`  ${line}`)
  console.log(
    `\n${files.size} files, ${kilobytes(total)} written to public/data from ${full.size} files.`,
  )
}

await main()
