// How the dice of the roll window can look: the finishes, and the presets the player
// picks from. The look is a per-device choice (see storage/deviceSettings.ts), not a
// part of the character. Every preset keeps its number readable against its body (a test
// checks it), and a custom look is corrected the same way (see dice/look.ts).

/** What the surface of a die looks like; the colours come from the look. */
export type Finish =
  'solid' | 'gradient' | 'metallic' | 'translucent' | 'marble' | 'speckled' | 'starry'

export const FINISHES: { finish: Finish; label: string }[] = [
  { finish: 'solid', label: 'Solid' },
  { finish: 'gradient', label: 'Gradient' },
  { finish: 'metallic', label: 'Metallic' },
  { finish: 'translucent', label: 'Translucent' },
  { finish: 'marble', label: 'Marble' },
  { finish: 'speckled', label: 'Speckled' },
  { finish: 'starry', label: 'Starry' },
]

/** The look of a set of dice. Colours are `#rrggbb`. */
export interface DiceLook {
  body: string
  number: string
  edge: string
  finish: Finish
  /** The die and its number glow softly. */
  glow: boolean
}

export interface DicePreset {
  id: string
  label: string
  look: DiceLook
}

export const DICE_PRESETS: DicePreset[] = [
  {
    id: 'classic',
    label: 'Classic ivory',
    look: {
      body: '#f3ead3',
      number: '#2a1f14',
      edge: '#8a7a5a',
      finish: 'gradient',
      glow: false,
    },
  },
  {
    id: 'obsidian',
    label: 'Obsidian',
    look: {
      body: '#1c1c24',
      number: '#f2f2f7',
      edge: '#6b6b80',
      finish: 'metallic',
      glow: false,
    },
  },
  {
    id: 'dragonfire',
    label: 'Dragonfire',
    look: {
      body: '#a3260f',
      number: '#ffd66b',
      edge: '#ff7a1a',
      finish: 'gradient',
      glow: true,
    },
  },
  {
    id: 'frost',
    label: 'Frost',
    look: {
      body: '#cfe8f7',
      number: '#0b2e4a',
      edge: '#5aa9d6',
      finish: 'translucent',
      glow: true,
    },
  },
  {
    id: 'arcane',
    label: 'Arcane',
    look: {
      body: '#2d1459',
      number: '#e9d5ff',
      edge: '#a45cff',
      finish: 'gradient',
      glow: true,
    },
  },
  {
    id: 'verdant',
    label: 'Verdant',
    look: {
      body: '#2f6b3f',
      number: '#f4fff0',
      edge: '#9bd18a',
      finish: 'marble',
      glow: false,
    },
  },
  {
    id: 'gilded',
    label: 'Gilded',
    look: {
      body: '#d4a82e',
      number: '#2b1b00',
      edge: '#fff0a8',
      finish: 'metallic',
      glow: false,
    },
  },
  {
    id: 'necrotic',
    label: 'Necrotic',
    look: {
      body: '#0f2418',
      number: '#9dff7a',
      edge: '#3fa35a',
      finish: 'speckled',
      glow: true,
    },
  },
  {
    id: 'celestial',
    label: 'Celestial',
    look: {
      body: '#f7f4ea',
      number: '#1b2a5c',
      edge: '#d4a82e',
      finish: 'starry',
      glow: true,
    },
  },
  {
    id: 'blood-moon',
    label: 'Blood moon',
    look: {
      body: '#5a0b14',
      number: '#ffe9d6',
      edge: '#d8483a',
      finish: 'marble',
      glow: true,
    },
  },
]

/** The look the dice have until the player picks another (the first preset). */
export const DEFAULT_LOOK: DiceLook = DICE_PRESETS[0].look
