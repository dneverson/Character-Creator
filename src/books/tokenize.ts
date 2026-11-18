// The words of a document's blocks of text, in the form the search index takes and a
// worker can hand over cheaply: the words and, for each, the blocks it appears in, as two
// flat arrays (the postings of word `i` are `ids[offsets[i]]` up to `ids[offsets[i + 1]]`).

import { wordsIn } from '../lookup/search'
import type { Heading, Scan } from './outline'

/** One document ready to join the index. */
export interface DocTokens {
  headings: Heading[]
  /** The text of each block, in order. */
  texts: string[]
  /** The index in `headings` of the heading each block sits under. */
  blockHeading: number[]
  /** The distinct words of the document, in order (as a text sorts them). */
  words: string[]
  /** Where each word's block numbers start in `ids`; one more than there are words. */
  offsets: Uint32Array<ArrayBuffer>
  /** The numbers of the blocks (within this document) each word appears in, ascending. */
  ids: Uint32Array<ArrayBuffer>
}

export function tokenize({ headings, blocks }: Scan): DocTokens {
  const postings = new Map<string, number[]>()
  blocks.forEach((block, id) => {
    for (const word of wordsIn(block.text)) {
      const list = postings.get(word)
      if (!list) postings.set(word, [id])
      // A word said twice in a block counts once; blocks come in order.
      else if (list[list.length - 1] !== id) list.push(id)
    }
  })
  const words = [...postings.keys()].sort()
  const offsets = new Uint32Array(words.length + 1)
  let total = 0
  for (const [i, word] of words.entries()) {
    offsets[i] = total
    total += postings.get(word)?.length ?? 0
  }
  offsets[words.length] = total
  const ids = new Uint32Array(total)
  for (const [i, word] of words.entries()) ids.set(postings.get(word) ?? [], offsets[i])
  return {
    headings,
    texts: blocks.map((block) => block.text),
    blockHeading: blocks.map((block) => block.heading),
    words,
    offsets,
    ids,
  }
}
