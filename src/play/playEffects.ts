// What exhaustion and the conditions do to the numbers of the sheet in play. Each effect is
// one line, named for its cause, added to the number it changes (every speed alike).
// Advantage and disadvantage are not numbers and stay in the words of the exhaustion and
// conditions details, save on a passive score, where disadvantage is -5. Only the sheet's
// play view reads this: the build and the PDF keep the numbers without it.

import type { PlayState } from '../character/model'
import { ABILITIES } from '../dice/dice'
import type { DerivedSheet } from '../derived'
import { edgeLine, settleEdges } from '../derived/combat'
import { moveRow } from '../derived/speed'
import { quantity, type Line, type Quantity, type SourceRef } from '../derived/types'
import type { PassiveSkill } from '../rules/combatRules'
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

/**
 * The lines that change a speed, each worked out on what the ones before it left; `id`
 * names the speed ("speed", "speed|fly").
 */
function speedLines(
  speed: number,
  play: Pick<PlayState, 'exhaustion' | 'conditions'>,
  edition: DerivedSheet['edition'],
  id = 'speed',
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
          `${id}|exhaustion`,
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
      (n) => cutLine(`${id}|exhaustion|half`, label, EXHAUSTION, n, 'Speed halved'),
      halfCut(left),
    )
  }
  if (rule.kind === 'levels' && level >= rule.speedZeroAt) {
    cut((n) => cutLine(`${id}|exhaustion|zero`, label, EXHAUSTION, n, 'Speed 0'), left)
  }
  for (const { condition, text } of rules.speedZero) {
    if (!play.conditions.includes(condition)) continue
    cut(
      (n) =>
        cutLine(
          `${id}|condition|${condition}`,
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

/**
 * The disadvantage on ability checks that exhaustion (2014, from level 1) and the conditions
 * give, as lines of a passive score: -5 each, settled with the score's other advantage and
 * disadvantage.
 */
function passiveLines(
  key: PassiveSkill,
  play: Pick<PlayState, 'exhaustion' | 'conditions'>,
  edition: DerivedSheet['edition'],
): Line[] {
  const rules = PLAY_RULES[edition]
  const rule = rules.exhaustion
  const lines: Line[] = []
  if (rule.kind === 'levels' && play.exhaustion >= rule.checkDisadvantageAt) {
    lines.push(
      edgeLine(edition, key, 'disadvantage', {
        label: `Exhaustion ${play.exhaustion}`,
        source: EXHAUSTION,
        text: `Exhaustion: ${rule.effects[rule.checkDisadvantageAt - 1]}.`,
        status: 'applied',
      }),
    )
  }
  for (const { condition, text, when } of rules.checkDisadvantage) {
    if (!play.conditions.includes(condition)) continue
    lines.push(
      edgeLine(edition, key, 'disadvantage', {
        label: condition,
        source: conditionSource(condition),
        text: `${condition}: ${text}.`,
        ...(when ? { status: 'conditional', when } : { status: 'applied' }),
      }),
    )
  }
  // A condition that takes a sense fails the checks that need it: Passive Perception shows
  // the line, not counted, since the sheet cannot tell what the noticing needs.
  if (key === 'perception') {
    for (const { condition, text, when } of rules.senseLoss) {
      if (!play.conditions.includes(condition)) continue
      lines.push({
        id: `passive|${key}|condition|${condition}`,
        label: condition,
        source: conditionSource(condition),
        op: 'note',
        status: 'conditional',
        when,
        text: `${condition}: ${text}.`,
      })
    }
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

  const speed = withLines(sheet.speed, speedLines(sheet.speed.value, play, sheet.edition))
  // A speed equal to walking follows the walking speed left; one of its own number takes
  // the same effects itself.
  const speeds = sheet.speeds.map((row) => {
    const again = moveRow(row.mode, row.speed.lines, row.follows, row.hovers, speed.value)
    if (again.equalsWalk) return again
    const id = `speed|${row.mode}`
    const lines = speedLines(again.speed.value, play, sheet.edition, id)
    return { ...again, speed: withLines(again.speed, lines) }
  })
  const saves = { ...sheet.saves }
  for (const key of ABILITIES) {
    saves[key] = { ...saves[key], total: withLines(saves[key].total, d20(`save|${key}`)) }
  }

  return {
    ...sheet,
    hp: withLines(sheet.hp, hp),
    speed,
    speeds,
    saves,
    skills: sheet.skills.map((s) => ({
      ...s,
      total: withLines(s.total, d20(`skill|${s.key}`)),
    })),
    combat: {
      ...sheet.combat,
      initiative: withLines(sheet.combat.initiative, d20('initiative')),
      passives: sheet.combat.passives.map((row) => {
        const lines = passiveLines(row.key, play, sheet.edition)
        return lines.length === 0
          ? row
          : { ...row, score: quantity(settleEdges([...row.score.lines, ...lines])) }
      }),
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
