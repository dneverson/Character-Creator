/**
 * Book content configuration.
 *
 * The site itself hosts only the free rules (the SRD content under `public/data`).
 * Everything else is downloaded by the visitor's own browser from a public mirror
 * of the 5etools data and kept in that browser's storage. This file is the single
 * place that says where that content comes from and how it is fetched.
 */

import srd from './srd.json'

/** Where the full content comes from: two GitHub repositories and a branch. */
export interface ContentSource {
  /** `owner/name` of the repository holding the `data/` folder. */
  dataRepository: string
  /** `owner/name` of the repository holding the images (book covers). */
  imageRepository: string
  /** Branch, tag or commit to read. */
  ref: string
}

export type ContentDownloadMode = 'automatic' | 'prompt'

export const contentConfig = {
  /**
   * How a first-time visitor gets the full content:
   *   'automatic' - the download starts on the first visit;
   *   'prompt'    - the visitor is asked once, and only the free rules load until
   *                 they accept.
   */
  download: 'automatic' as ContentDownloadMode,

  /** The default source. A visitor can point the app at another mirror in Content settings. */
  source: {
    dataRepository: '5etools-mirror-3/5etools-src',
    imageRepository: '5etools-mirror-3/5etools-img',
    ref: 'main',
  } as ContentSource,

  /**
   * Hosts that serve a repository's files, tried in this order. Both allow
   * cross-origin browser requests. The CDN is faster; the raw host has every file.
   */
  hosts: [
    (repository: string, ref: string, path: string) =>
      `https://cdn.jsdelivr.net/gh/${repository}@${ref}/${path}`,
    (repository: string, ref: string, path: string) =>
      `https://raw.githubusercontent.com/${repository}/${ref}/${path}`,
  ],

  /** The version check: the latest commit of a branch, and the file list of a commit. */
  api: {
    commit: (repository: string, ref: string) =>
      `https://api.github.com/repos/${repository}/commits/${ref}`,
    tree: (repository: string, commit: string) =>
      `https://api.github.com/repos/${repository}/git/trees/${commit}?recursive=1`,
  },

  /** Folder inside the data repository that holds the data files. */
  dataFolder: 'data',

  /**
   * Files downloaded in the background, in this order, so later sections are
   * already stored when the user reaches them. Any other file is still fetched
   * the moment something asks for it; listing it here only makes it arrive early.
   * A path ending in `/index.json` also brings in every file that index names.
   * Keep the order: what the editor shows first comes first, monsters come last.
   */
  prefetch: [
    'books.json',
    'class/index.json',
    'races.json',
    'backgrounds.json',
    'feats.json',
    'spells/index.json',
    'generated/gendata-spell-source-lookup.json',
    'items-base.json',
    'items.json',
    'bestiary/index.json',
  ],

  /** The file that names every book and its cover image. */
  booksFile: 'books.json',

  /**
   * Folders left out when the visitor imports their own copy of the data folder:
   * the long-form adventure text, which is large and which nothing reads. (The
   * book text is kept: a book's contents page numbers are read from it.)
   */
  importExclude: ['adventure/'],

  /** How many background downloads run at once. Requests the user is waiting on are never queued. */
  backgroundConcurrency: 4,

  /** Hours between checks for a newer version of the content. */
  updateCheckHours: 24,

  /** Width in pixels of the stored cover thumbnails (table rows show them about 32 px wide). */
  coverThumbWidth: 96,

  /** Names of the browser stores holding downloaded content. */
  stores: {
    files: 'cc-content-files',
    covers: 'cc-content-covers',
    meta: 'cc-content-meta',
  },

  /** localStorage key for the visitor's content settings. */
  settingsKey: 'cc-content',
} as const

/**
 * The documents the free rules come from, each with the attribution its license
 * asks for, and the changes made to the material. `pnpm build-base` reads the
 * same file: a document's `flag` is the mark its entries carry in the data.
 */
export const freeRulesLicense = srd

/**
 * What the visitor is told about where book content comes from. Shown in the
 * Book content window and, in 'prompt' mode, in the one-time question.
 */
export const contentCopy = {
  /** What this site hosts, and what the visitor's browser fetches for itself. */
  notice: [
    'This site hosts only the free rules: the System Reference Document, which Wizards of the Coast publishes under the Creative Commons Attribution 4.0 license.',
    'Content from other books is not hosted here. Your browser downloads it from a public third-party source and keeps it on this device.',
  ],
  /** What downloading the full content means. */
  ownership:
    'By downloading the full content you confirm that you own the books whose content you use.',
} as const
