// The order the printed book has. A book's text is the data's: its entries are listed by
// name or by level, and a block the print has on one page may be set where the data lists it
// (a creature printed in an appendix, shown at its place in the A-Z). The pages the text
// marks say where each part is in print, so they are read against each other. A part is out
// of place for one of two reasons.
//
// - Its page differs from the pages around it, but falls within them: the data orders the
//   list differently from print (Fireball, page 241, is listed after Fire Storm, page
//   242). The part is put where its page belongs, the parts of the list that are in print
//   order keeping theirs.
// - Its page falls outside the pages of the heading it is under, from the page the chapter
//   starts on to the page the next heading starts on, or outside those the rest of its
//   list covers: the part is printed elsewhere and only shown here (a creature printed in
//   an appendix, a rule printed in the glossary). It stays where it is, but it marks no
//   page (no separator, no contents number, no page of the page box) and says where it is
//   printed (`printedOn`).
//
// Parts with no page of their own stay with the part before them.

import type { Entry } from '../text/Entries'

type Json = Record<string, unknown>

const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The pages a part marks: the first it stands at and the highest. */
interface Reach {
  first: number
  max: number
}

const reached = new WeakMap<object, Reach | null>()

/** The first and the highest page marked in a part, or undefined when it marks none. */
function reachOf(node: unknown): Reach | undefined {
  if (typeof node !== 'object' || node === null) return undefined
  const known = reached.get(node)
  if (known !== undefined) return known ?? undefined
  let reach: Reach | undefined
  const add = (page: Reach | undefined) => {
    if (page) {
      reach = reach
        ? { first: reach.first, max: Math.max(reach.max, page.max) }
        : { first: page.first, max: page.max }
    }
  }
  const own = (node as Json).page
  if (!Array.isArray(node) && typeof own === 'number') add({ first: own, max: own })
  for (const child of Array.isArray(node) ? node : Object.values(node)) {
    add(reachOf(child))
  }
  reached.set(node, reach ?? null)
  return reach
}

/** Whether a part marks a page from `low` to `high`. */
function marksBetween(node: unknown, low: number, high: number): boolean {
  if (typeof node !== 'object' || node === null) return false
  if (!Array.isArray(node)) {
    const page = (node as Json).page
    if (typeof page === 'number' && page >= low && page <= high) return true
  }
  return (Array.isArray(node) ? node : Object.values(node)).some((child) =>
    marksBetween(child, low, high),
  )
}

/** The same part with no page marked in it. */
function withoutPages(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withoutPages)
  if (!isJson(node)) return node
  const copy: Json = {}
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'page') copy[key] = withoutPages(value)
  }
  return copy
}

/** A part printed elsewhere: it marks no page, and the first part that has a name says where. */
function printedElsewhere(node: unknown, page: number): unknown {
  if (!isJson(node)) return node
  const named = typeof node.name === 'string' && node.name !== ''
  if (named || node.type === 'statblock') {
    return { ...(withoutPages(node) as Json), printedOn: page }
  }
  // A part with no name of its own (a bare group) has no heading to say it.
  return Array.isArray(node.entries)
    ? {
        ...(withoutPages({ ...node, entries: [] }) as Json),
        entries: node.entries.map((child) => {
          const at = reachOf(child)
          return at ? printedElsewhere(child, at.first) : child
        }),
      }
    : withoutPages(node)
}

/**
 * The indexes of the longest run of pages that never go back (equal pages follow each
 * other): the parts that are in the order of the print. Of runs as long, the one that
 * starts first, so the part a list opens with is not the one that is out of place.
 */
function mainRun(pages: readonly number[]): Set<number> {
  // longest[i]: the most parts a run that starts at part i has.
  const longest: number[] = []
  for (let i = pages.length - 1; i >= 0; i--) {
    let best = 0
    for (let j = i + 1; j < pages.length; j++) {
      if (pages[j] >= pages[i]) best = Math.max(best, longest[j])
    }
    longest[i] = best + 1
  }
  const run = new Set<number>()
  let need = Math.max(0, ...longest)
  let from = -1
  for (let i = 0; i < pages.length && need > 0; i++) {
    if (longest[i] === need && (from < 0 || pages[i] >= pages[from])) {
      run.add(i)
      from = i
      need--
    }
  }
  return run
}

/** The parts of one list in print order, those printed elsewhere marked as such. */
function orderList(parts: Entry[]): Entry[] {
  const reaches = parts.map(reachOf)
  const keyed = parts.flatMap((_, index) => (reaches[index] ? [index] : []))
  if (keyed.length < 2) return parts
  const main = mainRun(keyed.map((index) => reaches[index]?.first ?? 0))
  if (main.size === keyed.length) return parts

  let low = Infinity
  let high = -Infinity
  keyed.forEach((index, at) => {
    if (!main.has(at)) return
    low = Math.min(low, reaches[index]?.first ?? low)
    high = Math.max(high, reaches[index]?.max ?? high)
  })

  const next = [...parts]
  let moved = false
  keyed.forEach((index, at) => {
    if (main.has(at)) return
    const reach = reaches[index]
    if (!reach) return
    if (reach.first >= low && reach.max <= high) moved = true
    else {
      next[index] = printedElsewhere(parts[index], reach.first) as Entry
      reaches[index] = undefined
    }
  })
  if (!moved) return next

  // Each part with a page starts a group with the parts without one that follow it.
  const groups: { page: number; entries: Entry[] }[] = []
  const lead: Entry[] = []
  next.forEach((part, index) => {
    const reach = reaches[index]
    if (reach) groups.push({ page: reach.first, entries: [part] })
    else if (groups.length > 0) groups[groups.length - 1].entries.push(part)
    else lead.push(part)
  })
  groups.sort((a, b) => a.page - b.page)
  return [...lead, ...groups.flatMap((group) => group.entries)]
}

/**
 * The parts of a list held to the pages of the chapter they are in: from the page it
 * starts on (`low`) to the page the part after the heading they are under starts on
 * (`high`). A part whose pages all fall outside them is printed elsewhere: a creature
 * printed in an appendix and shown in the A-Z, a rule printed in the glossary and shown
 * where a chapter uses it. A heading that says no page of its own has its parent's span.
 */
function held(parts: Entry[], low: number, high: number): Entry[] {
  let changed = false
  const next = parts.map((part, index) => {
    const reach = reachOf(part)
    if (!isJson(part) || !reach) return part
    if (!marksBetween(part, low, high)) {
      changed = true
      return printedElsewhere(part, reach.first) as Entry
    }
    if (!Array.isArray(part.entries)) return part
    let inner = { low, high }
    const own = part.page
    if (typeof own === 'number' && own >= low && own <= high) {
      // The heading ends where the next one that starts on a later page starts.
      const end = parts
        .slice(index + 1)
        .flatMap((other) => reachOf(other)?.first ?? [])
        .filter((page) => page > own && page <= high)
      inner = { low: own, high: end.length > 0 ? Math.min(...end) : high }
    }
    const done = held(part.entries, inner.low, inner.high)
    if (done === part.entries) return part
    changed = true
    return { ...part, entries: done }
  })
  return changed ? next : parts
}

/** A part with the lists inside it in print order, inside lists first. */
function orderPart(node: Entry): Entry {
  if (!isJson(node)) return node
  if (!Array.isArray(node.entries)) return node
  const before: Entry[] = node.entries
  const inner = before.map(orderPart)
  const same = inner.every((part, index) => part === before[index])
  const done = orderList(inner)
  return same && done === inner ? node : { ...node, entries: done }
}

/**
 * The chapters of a book with every list of parts in the order of the print (see the head
 * of this file). The chapters themselves keep their order: they are the book's contents.
 */
export function inPrintOrder(sections: Entry[]): Entry[] {
  const starts = sections.map((chapter) => reachOf(chapter)?.first)
  const bounded = sections.map((chapter, index) => {
    const start = starts[index]
    if (start === undefined || !isJson(chapter) || !Array.isArray(chapter.entries)) {
      return chapter
    }
    const later = starts
      .slice(index + 1)
      .flatMap((page) => (page !== undefined ? page : []))
    const end = Math.min(Infinity, ...later.filter((page) => page > start))
    const inner = held(chapter.entries, start, end)
    return inner === chapter.entries ? chapter : { ...chapter, entries: inner }
  })
  const chapters = bounded.map(orderPart)
  const reaches = chapters.map(reachOf)
  const keyed = chapters.flatMap((_, index) => (reaches[index] ? [index] : []))
  if (keyed.length < 2) return chapters
  // Only the chapters with a page are weighed; none of them is moved.
  const main = mainRun(keyed.map((index) => reaches[index]?.first ?? 0))
  if (main.size === keyed.length) return chapters
  let low = Infinity
  keyed.forEach((index, at) => {
    if (main.has(at)) low = Math.min(low, reaches[index]?.first ?? low)
  })
  return chapters.map((chapter, index) => {
    const reach = reaches[index]
    return reach && reach.first < low
      ? (printedElsewhere(chapter, reach.first) as Entry)
      : chapter
  })
}
