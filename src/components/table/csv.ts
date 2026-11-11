// Comma-separated values export of a table, as it is on screen. Pure: the rows
// and columns it is given are already filtered, sorted and ordered by the table.

import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { nodeText } from './tableState'
import type { Column } from './types'

/** Tells Excel the file is UTF-8, so accents and symbols survive. */
const BOM = '﻿'

/** The text a rendered cell shows: markup stripped, entities decoded, spaces tidied. */
export function plainText(node: ReactNode): string {
  let html: string
  try {
    html = renderToStaticMarkup(node)
  } catch {
    // A cell that needs something only the live page has: fall back to its own children.
    return nodeText(node).replace(/\s+/g, ' ').trim()
  }
  const holder = document.createElement('div')
  holder.innerHTML = html.replace(/<\/?(?:div|p|li|tr|h\d)\b[^>]*>|<br\s*\/?>/gi, ' ')
  return (holder.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** One field, quoted when it holds a comma, a quote or a line break (RFC 4180). */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * The table as CSV text: a header line of the column headings, then a line per
 * row with each cell's displayed text. Lines end in CRLF and the text starts with
 * a byte order mark.
 */
export function rowsToCsv<T>(rows: T[], columns: Column<T>[]): string {
  const lines = [
    columns.map((c) => csvField(plainText(c.header))),
    ...rows.map((row) => columns.map((c) => csvField(plainText(c.render(row))))),
  ]
  return BOM + lines.map((line) => line.join(',')).join('\r\n') + '\r\n'
}

/** `spells-2026-11-11.csv`: the table's name (a label or its id) and the day. */
export function csvFileName(name: string, date = new Date()): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'table'
  return `${slug}-${date.toISOString().slice(0, 10)}.csv`
}

/** Hands the CSV text to the browser as a file download. */
export function downloadCsv(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
