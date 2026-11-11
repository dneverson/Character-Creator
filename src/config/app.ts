/**
 * Central application configuration.
 *
 * Single source of truth for branding, credits, links, and persistence keys, so
 * they can be tweaked in one place instead of hunting through source. Everything
 * here is a plain, non-sensitive setting - never secrets.
 *
 * NOTE: `index.html` cannot import this module (its inline script runs before the
 * bundle, to set the theme pre-paint). The static `<title>` and the literal
 * `'cc-theme'` key are mirrored there by hand - keep them in sync with
 * `appConfig.name` and `appConfig.storageKeys.theme` below.
 */
export const appConfig = {
  /** Primary product name - navbar brand and document title. */
  name: 'D&D 5e Character Creator',
  /** Full, spelled-out name - used in the footer credit line. */
  fullName: 'Dungeons & Dragons 5th Edition Character Creator',
  /** Compact name for tight spaces (e.g. a future PWA manifest short_name). */
  shortName: 'D&D 5e Creator',
  /** Meta description / tagline. */
  description: 'Dungeons & Dragons 5th Edition character creator. Data from 5etools.',
  /** Original authors, in credit order. */
  authors: ['Derry Everson', 'Mikel Jensen'],
  /** Source repository. */
  repository: {
    url: 'https://github.com/dneverson/Character-Creator',
    label: 'GitHub',
  },
  /** Names of the browser stores (IndexedDB) holding what the user makes. */
  stores: {
    characters: 'cc-characters',
  },
  /**
   * Device setting keys (localStorage). Keep `theme` in sync with the inline
   * script in index.html. `characters` is where the characters were kept before
   * they moved to the `characters` store above: it is read once to bring them
   * over, never written, and `charactersMoved` records that this was done.
   */
  storageKeys: {
    theme: 'cc-theme',
    characters: 'cc-characters',
    charactersMoved: 'cc-characters-moved',
  },
  /**
   * How long the first render waits for the stored characters, in milliseconds.
   * Reading them normally takes a few; this only bounds a browser whose storage
   * does not answer, and the characters still appear once it does.
   */
  characterLoadWaitMs: 1500,
  /** The record of what was done to a character (see src/character/history.ts). */
  history: {
    /**
     * Edits to the same values that follow each other within this time, in
     * milliseconds, are recorded as one: typing a name is one entry, not one per
     * letter. Rolls are always recorded one by one.
     */
    mergeWindowMs: 60_000,
  },
  /** Rules of the game that the app measures against (and flags, never blocks). */
  rules: {
    /** Items a character can be attuned to at once. */
    attunementLimit: 3,
    /** Coins in a pound, for the weight of a purse. */
    coinsPerPound: 50,
    /** Pounds a character can carry for each point of Strength. */
    carryingPerStrength: 15,
  },
} as const

export type AppConfig = typeof appConfig
