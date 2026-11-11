// What the content library is doing, in words. The navbar button, the Book
// content window and the notices all say the same thing because they all ask here.

import { useContentStatus, type ContentStatus } from './library'
import { fullContentWanted, useContentSettings } from './settings'

export type ContentState = 'free' | 'importing' | 'unreachable' | 'downloading' | 'full'

export interface ContentSummary {
  state: ContentState
  /** A few words, short enough for a button. */
  label: string
  /** One or two sentences saying what that means for the visitor. */
  detail: string
}

type SummarizedStatus = Pick<
  ContentStatus,
  'activity' | 'done' | 'total' | 'complete' | 'unreachable'
>

/** Describe the content in use, given the library's status and the visitor's choice. */
export function summarizeContent(
  status: SummarizedStatus,
  wanted: boolean,
): ContentSummary {
  // An import switches the full content on when it ends, so it is reported first.
  if (status.activity === 'importing') {
    return {
      state: 'importing',
      label: 'Importing',
      detail: 'Reading the files you picked.',
    }
  }
  if (!wanted) {
    return {
      state: 'free',
      label: 'Free rules',
      detail: 'Only the free rules are in use.',
    }
  }
  if (status.unreachable) {
    return {
      state: 'unreachable',
      label: 'Source unreachable',
      detail:
        'The content source could not be reached. Anything not already stored in this browser comes from the free rules.',
    }
  }
  if (status.activity === 'downloading') {
    return {
      state: 'downloading',
      label: `Downloading ${status.done}/${status.total}`,
      detail: `Downloading in the background (${status.done} of ${status.total} files). Whatever you open is fetched first.`,
    }
  }
  return {
    state: 'full',
    label: 'Full content',
    detail: status.complete
      ? 'The full content is stored in this browser.'
      : 'The full content is in use. Files are fetched as you open them.',
  }
}

/** The live summary of the content in use. */
export function useContentSummary(): ContentSummary {
  const status = useContentStatus()
  const choice = useContentSettings((settings) => settings.fullContent)
  return summarizeContent(status, fullContentWanted(choice))
}
