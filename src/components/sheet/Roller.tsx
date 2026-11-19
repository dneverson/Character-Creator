// The dice of the sheet: the roll window every number of the sheet opens, and what a roll
// there does. Every roll is recorded as an event of the character's history (see
// rollHistory.ts); the window shows it as made and the Dice tab lists it from there.

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { newRoll, rollAction } from '../../character/rollHistory'
import type { CheckRollRecord } from '../../character/model'
import { useLatestCharacter, useUpdateCharacter } from '../../character/useCharacterDoc'
import { appConfig } from '../../config/app'
import { DEFAULT_LOOK, type DiceLook } from '../../config/diceLooks'
import { parseLook } from '../../dice/look'
import {
  RollParseError,
  cryptoRng,
  d20Modifier,
  rollD20,
  rollExpression,
  rollPieces,
  type RollMode,
  type RollOutcome,
  type Rng,
  type Term,
} from '../../dice/roll'
import { deviceSettings } from '../../storage/deviceSettings'
import type { RollPart } from '../../character/model'
import { RollModal } from './RollModal'
import { RollerContext } from './rollerContext'
import type { PlayEffect, RollSpec } from './rollSpec'

/** What a click on a roll button asks for. */
export interface RollRequest {
  /** The roll itself (an attack's to-hit), or the damage of an attack, plain or critical. */
  part: 'roll' | 'damage' | 'critical'
  mode: RollMode
  /** The situational bonus on the d20 or on the dice typed. */
  bonus: Term[]
  /** The extra damage of an attack. */
  damageBonus: Term[]
}

/** Rolls what the window asked for and records it; returns the roll as recorded. */
export type Perform = (spec: RollSpec, request: RollRequest) => CheckRollRecord[]

const LOOK_KEY = appConfig.storageKeys.diceLook

export function RollerProvider({
  rng = cryptoRng,
  children,
}: {
  /** The dice; the browser's crypto unless a test supplies them. */
  rng?: Rng
  children: ReactNode
}) {
  const update = useUpdateCharacter()
  const latest = useLatestCharacter()
  const [session, setSession] = useState<{ spec: RollSpec; serial: number } | null>(null)
  const [shown, setShown] = useState(false)
  const [look, setLookState] = useState<DiceLook>(
    () => parseLook(deviceSettings.getItem(LOOK_KEY)) ?? DEFAULT_LOOK,
  )

  const record = useCallback(
    (
      label: string,
      outcome: RollOutcome,
      parts: RollPart[],
      effect?: PlayEffect,
    ): CheckRollRecord => {
      const made = newRoll({
        stream: 'check',
        kind: 'check',
        label,
        ...outcome,
        ...(parts.length > 0 && { parts }),
      })
      const character = latest()
      update(
        effect && character ? { play: effect(character.play, outcome) } : {},
        rollAction(made),
      )
      return made as CheckRollRecord
    },
    [latest, update],
  )

  const perform = useCallback<Perform>(
    (spec, { part, mode, bonus, damageBonus }) => {
      const { damage } = spec
      if (part === 'roll' || !damage) {
        const outcome =
          spec.kind === 'test' || spec.d20 !== undefined
            ? rollD20(spec.d20 ?? spec.modifier, mode, rng, bonus)
            : rollExpression(spec.expression ?? '', rng, false, bonus)
        return [record(spec.label, outcome, spec.parts, spec.effect)]
      }
      const critical = part === 'critical'
      const what = critical ? 'critical damage' : (damage.verb ?? 'damage')
      const label = `${damage.name} ${what}${damage.detail ? ` (${damage.detail})` : ''}`
      return [
        record(
          label,
          rollPieces(damage.pieces, rng, critical, damageBonus),
          damage.parts,
        ),
      ]
    },
    [record, rng],
  )

  const open = useCallback((spec: RollSpec) => {
    setSession((current) => ({ spec, serial: (current?.serial ?? 0) + 1 }))
    setShown(true)
  }, [])

  const openFree = useCallback(
    (text: string) => {
      try {
        const modifier = d20Modifier(text)
        open({
          kind: 'free',
          label: 'Free roll',
          modifier: 0,
          tables: [],
          parts: [],
          expression: text.trim(),
          ...(modifier !== null && { d20: modifier }),
        })
        return null
      } catch (error) {
        if (error instanceof RollParseError) return error.message
        throw error
      }
    },
    [open],
  )

  const setLook = useCallback((next: DiceLook) => {
    setLookState(next)
    deviceSettings.setItem(LOOK_KEY, JSON.stringify(next))
  }, [])
  const resetLook = useCallback(() => {
    setLookState(DEFAULT_LOOK)
    deviceSettings.removeItem(LOOK_KEY)
  }, [])

  const value = useMemo(
    () => ({ open, openFree, look, setLook, resetLook }),
    [open, openFree, look, setLook, resetLook],
  )
  return (
    <RollerContext.Provider value={value}>
      {children}
      {session && (
        <RollModal
          key={session.serial}
          spec={session.spec}
          show={shown}
          onHide={() => setShown(false)}
          perform={perform}
          look={look}
          setLook={setLook}
          resetLook={resetLook}
        />
      )}
    </RollerContext.Provider>
  )
}
