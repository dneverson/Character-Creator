// The dice of a roll, drawn and animated: each die on its own, a d20 for a d20, two for an
// advantage, a d6 for each d6 of the damage, a d100 as two d10 (tens and units). While they
// roll every die tumbles and its face flickers; then each lands on the number it was
// given. The tray never decides a number: the result is computed before it, and the tray
// only shows it. A player who asks the system to reduce motion sees no tumble, the result
// fades in.

import { useEffect, useState } from 'react'
import { appConfig } from '../../config/app'
import type { DiceLook } from '../../config/diceLooks'
import { Die } from './Die'

/** One die of the tray. */
export interface TrayDie {
  /** Unique in the tray. */
  key: string
  sides: number
  /** What it landed on; absent until it is rolled. */
  value?: number
  /** It does not count (the lower die of an advantage). */
  dropped?: boolean
  /** Where it came from, when not the roll itself. */
  tag?: 'bonus' | 'extra'
}

/** A group of dice under a heading ("To hit", "Damage"). */
export interface TraySection {
  title?: string
  dice: TrayDie[]
}

/** Before the roll, while the dice tumble, and once they landed. */
export type TrayPhase = 'idle' | 'rolling' | 'landed'

const TAG_TEXT = { bonus: 'bonus', extra: 'extra (critical)' } as const

/** A face the die shows while it tumbles; only for the eyes, it decides nothing. */
const flickerFace = (sides: number, at: number, tick: number) =>
  ((tick * 7 + at * 13 + sides) % sides) + 1

/** The two d10 a d100 is rolled with: the tens ("00" to "90") and the units. */
function percentFaces(value: number) {
  const number = value % 100
  return {
    tens: String(Math.floor(number / 10) * 10).padStart(2, '0'),
    units: String(number % 10),
  }
}

function TrayDieView({
  die,
  at,
  look,
  phase,
  tick,
}: {
  die: TrayDie
  at: number
  look: DiceLook
  phase: TrayPhase
  tick: number
}) {
  const value =
    phase === 'rolling'
      ? flickerFace(die.sides, at, tick)
      : phase === 'landed'
        ? die.value
        : undefined
  const caption = [
    `d${die.sides}`,
    die.dropped && 'dropped',
    die.tag && TAG_TEXT[die.tag],
  ]
    .filter(Boolean)
    .join(', ')
  const percent = die.sides === 100
  const faces = percent && value !== undefined ? percentFaces(value) : undefined
  return (
    <figure
      className={`dice-tray__die dice-tray__die--${phase}${die.dropped ? ' dice-tray__die--dropped' : ''}`}
    >
      <div className="dice-tray__body" style={phase === 'rolling' ? TUMBLE : undefined}>
        {percent ? (
          <>
            <Die sides={10} face={faces?.tens ?? '?'} look={look} />
            <Die sides={10} face={faces?.units ?? '?'} look={look} />
          </>
        ) : (
          <Die sides={die.sides} face={value ?? '?'} look={look} />
        )}
      </div>
      <figcaption className="dice-tray__caption">{caption}</figcaption>
    </figure>
  )
}

/** The time a die tumbles, from the config, over the stylesheet's own. */
const TUMBLE = { animationDuration: `${appConfig.dice.animationMs}ms` }

export function DiceTray({
  sections,
  look,
  phase,
  reducedMotion,
}: {
  sections: TraySection[]
  look: DiceLook
  phase: TrayPhase
  reducedMotion: boolean
}) {
  const [tick, setTick] = useState(0)
  const tumbling = phase === 'rolling' && !reducedMotion
  useEffect(() => {
    if (!tumbling) return
    const timer = setInterval(() => setTick((t) => t + 1), appConfig.dice.flickerMs)
    return () => clearInterval(timer)
  }, [tumbling])
  return (
    <div
      className={`dice-tray${reducedMotion ? ' dice-tray--still' : ''}`}
      role="group"
      aria-label="Dice"
    >
      {sections.map((section, sectionAt) => (
        <div key={section.title ?? sectionAt} className="dice-tray__section">
          {sections.length > 1 && section.title && (
            <div className="dice-tray__title">{section.title}</div>
          )}
          <div className="dice-tray__dice">
            {section.dice.map((die, at) => (
              <TrayDieView
                key={die.key}
                die={die}
                at={at}
                look={look}
                phase={phase}
                tick={tick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
