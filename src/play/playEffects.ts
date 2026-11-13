// What exhaustion and the conditions do to the numbers of the sheet in play. Each effect is
// one line, named for its cause, added to the number it changes; advantage and disadvantage
// are not numbers and stay in the words of the exhaustion and conditions details. Only the
// sheet's play view reads this: the build and the PDF keep the numbers without it.

import type { PlayState } from '../character/model'
import { ABILITIES } from '../dice/dice'
import type { DerivedSheet } from '../derived'
import { quantity, type Line, type Quantity, type SourceRef } from '../derived/types'
import { PLAY_RULES } from '../rules/playRules'

const EXHAUSTION: SourceRef = { kind: 'base', tag: 'play:exhaustion', label: '' }

const conditionSource = (name: string): SourceRef => ({
  kind: 'base',
  tag: `play:condition:${name}`,
  label: '',
})

/** A line that takes `cut` off; never a negative zero. */
const cutLine = (
  id: string,
  label: string,
  source: SourceRef,
  cut: number,
  how: string,
): Line => ({
  id,
  label,
  source,
  op: 'add',
  status: 'applied',
  amount: -cut || 0,
  how,
})

const withLines = (q: Quantity, lines: readonly Line[]): Quantity =>
  lines.length === 0 ? q : quantity([...q.lines, ...lines])

/** The rule's words as the line reads them: "Speed becomes 0", "Can't move, so speed 0". */
function speedZeroHow(text: string): string {
  const words = text.charAt(0).toUpperCase() + text.slice(1)
  return /speed/i.test(text) ? words : `${words}, so speed 0`
}

/** Half, rounded down, as the rules round. */
const halfCut = (value: number) => value - Math.floor(value / 2)

/** The lines that change the speed, each worked out on what the ones before it left. */
function speedLines(
  speed: number,
  play: Pick<PlayState, 'exhaustion' | 'conditions'>,
  edition: DerivedSheet['edition'],
): Line[] {
  const rules = PLAY_RULES[edition]
  const rule = rules.exhaustion
  const level = play.exhaustion
  const lines: Line[] = []
  let left = speed
  const cut = (line: (amount: number) => Line, amount: number) => {
    const taken = Math.min(Math.max(amount, 0), left)
    left -= taken
    lines.push(line(taken))
  }
  const label = `Exhaustion ${level}`
  if (rule.kind === 'perLevel' && level > 0 && level < rule.deathAt) {
    cut(
      (n) =>
        cutLine(
          'speed|exhaustion',
          label,
          EXHAUSTION,
          n,
          `${rule.speedFeet} ft. less per level`,
        ),
      rule.speedFeet * level,
    )
  }
  if (rule.kind === 'levels' && level >= rule.speedHalvedAt) {
    cut(
      (n) => cutLine('speed|exhaustion|half', label, EXHAUSTION, n, 'Speed halved'),
      halfCut(left),
    )
  }
  if (rule.kind === 'levels' && level >= rule.speedZeroAt) {
    cut((n) => cutLine('speed|exhaustion|zero', label, EXHAUSTION, n, 'Speed 0'), left)
  }
  for (const { condition, text } of rules.speedZero) {
    if (!play.conditions.includes(condition)) continue
    cut(
      (n) =>
        cutLine(
          `speed|condition|${condition}`,
          condition,
          conditionSource(condition),
          n,
          speedZeroHow(text),
        ),
      left,
    )
  }
  return lines
}

/** The sheet with the effects of the exhaustion level and the conditions of `play` added. */
export function applyPlayEffects(
  sheet: DerivedSheet,
  play: Pick<PlayState, 'exhaustion' | 'conditions'>,
): DerivedSheet {
  const rule = PLAY_RULES[sheet.edition].exhaustion
  const level = play.exhaustion
  const label = `Exhaustion ${level}`

  // 2024: every d20 Test (an ability check, a saving throw, an attack roll) takes the cut.
  const d20 =
    rule.kind === 'perLevel' && level > 0 && level < rule.deathAt
      ? (id: string) => [
          cutLine(
            `${id}|exhaustion`,
            label,
            EXHAUSTION,
            rule.d20Test * level,
            `${rule.d20Test} less per level, on every d20 Test`,
          ),
        ]
      : () => []

  const hp =
    rule.kind === 'levels' && level >= rule.hpMaxHalvedAt
      ? [
          cutLine(
            'hp|exhaustion',
            label,
            EXHAUSTION,
            halfCut(sheet.hp.value),
            'Hit point maximum halved',
          ),
        ]
      : []

  const speed = speedLines(sheet.speed.value, play, sheet.edition)
  const saves = { ...sheet.saves }
  for (const key of ABILITIES) {
    saves[key] = { ...saves[key], total: withLines(saves[key].total, d20(`save|${key}`)) }
  }

  return {
    ...sheet,
    hp: withLines(sheet.hp, hp),
    speed: withLines(sheet.speed, speed),
    saves,
    skills: sheet.skills.map((s) => ({
      ...s,
      total: withLines(s.total, d20(`skill|${s.key}`)),
    })),
    combat: {
      ...sheet.combat,
      initiative: withLines(sheet.combat.initiative, d20('initiative')),
    },
    attacks: sheet.attacks.map((a) => ({
      ...a,
      toHit: withLines(a.toHit, d20(`attack|${a.id}`)),
    })),
    spellStats: sheet.spellStats.map((s) => ({
      ...s,
      attack: withLines(s.attack, d20(`spell|${s.id}`)),
    })),
  }
}
