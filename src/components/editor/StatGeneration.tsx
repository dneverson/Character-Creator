import { useMemo, useState, type CSSProperties } from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import {
  abilityMod,
  bestLine,
  clamp,
  formatMod,
  gauntletImproveChance,
  matrixFromScores,
  matrixLines,
  rollConfigLabel,
  rollDice,
  rollGauntletSlot,
  rollMatrix,
  ROLL_DICE_MAX,
  ROLL_DICE_MIN,
  ROLL_REROLLS_MAX,
  ROLL_REROLLS_MIN,
  STANDARD_ARRAY,
  sum,
  type MatrixLine,
  type RollConfig,
} from '../../dice/dice'
import { DieFaceIcon, type DieFace } from '../Icon'
import { type RollRecord, type StatMethod } from '../../character/model'
import {
  activeRoll,
  newRoll,
  rollAction,
  rollRecords,
  withCursor,
} from '../../character/rollHistory'
import { useCharacter, useUpdateCharacter } from '../../character/useCharacterDoc'
import {
  clearedAbilities,
  gauntletScores,
  generatePool,
  isRollMethod,
  pointBuyBaseline,
  poolGroupTotals,
  poolScores,
  rollStats,
  type RollStats,
} from '../../character/stats'
import { scoreCellClass, scoreColorClass } from '../../ui/scoreColor'
import { DraftInput } from './DraftInput'
import { SubSection } from './SubSection'
import { GauntletRoll } from './GauntletRoll'
import { PoolRoll } from './PoolRoll'
import { RollHistoryControls } from './RollHistoryControls'

const METHOD_OPTIONS: { value: StatMethod; label: string }[] = [
  { value: 'roll', label: 'Roll, Reroll, Keep Best' },
  { value: 'matrix', label: 'Roll Matrix (pick a line)' },
  { value: 'gauntlet', label: 'Gauntlet (per-slot reroll)' },
  { value: 'pool', label: 'The Pool (group 18d6)' },
  { value: 'array', label: 'Standard Array' },
  { value: 'pointbuy', label: 'Point Buy' },
]

/**
 * A random d6 face for the "rolling" die flourish on the roll buttons. This is
 * purely a visual affordance, so it uses Math.random and deliberately does not
 * draw from the cryptographic dice RNG that produces the actual, fair rolls.
 */
function randomFace(): DieFace {
  return (Math.floor(Math.random() * 6) + 1) as DieFace
}

/**
 * A small clearable number stepper for the roll config. It keeps a local text
 * buffer so the box can be emptied and a fresh digit typed (rather than forcing
 * highlight-then-type), and commits on blur or Enter, clamped to [min, max].
 * Native number spinners provide the up/down arrows.
 */
function RollNumberInput({
  id,
  value,
  min,
  max,
  ariaLabel,
  onCommit,
}: {
  id: string
  value: number
  min: number
  max: number
  ariaLabel: string
  onCommit: (next: number) => void
}) {
  return (
    <DraftInput
      id={id}
      type="number"
      min={min}
      max={max}
      step={1}
      value={String(value)}
      onCommit={(raw) => {
        const digits = raw.replace(/\D/g, '')
        if (digits !== '') onCommit(clamp(Number(digits), min, max))
      }}
      aria-label={ariaLabel}
      style={{ width: 68, textAlign: 'center' }}
    />
  )
}

/** Identity of a selectable line, used for selected/hover comparisons. */
type LineRef = { kind: MatrixLine['kind']; index: number }

const sameLine = (a: LineRef | null, b: LineRef | null) =>
  !!a && !!b && a.kind === b.kind && a.index === b.index

/**
 * Endpoints of a line in the SVG overlay's coordinate space (0..size on each
 * axis, one unit per cell), so the drawn line runs through the centre of every
 * cell it claims - including the two diagonals.
 */
function lineEndpoints(line: LineRef, size: number) {
  switch (line.kind) {
    case 'row':
      return { x1: 0, y1: line.index + 0.5, x2: size, y2: line.index + 0.5 }
    case 'col':
      return { x1: line.index + 0.5, y1: 0, x2: line.index + 0.5, y2: size }
    case 'diag':
      // 0 = main (top-left → bottom-right), 1 = anti (bottom-left → top-right).
      return line.index === 0
        ? { x1: 0, y1: 0, x2: size, y2: size }
        : { x1: 0, y1: size, x2: size, y2: 0 }
  }
}

/**
 * One drawn line over the matrix: the picked line (`selected`), a lighter hover
 * preview (`hover`), a faint marker for a line tied for the best total that
 * isn't the current pick (`best`), or a `gold` line for a best line that also
 * lands at least one 18 - the strongest possible pick, drawn over any blue.
 */
function OverlayLine({
  line,
  size,
  variant,
}: {
  line: LineRef
  size: number
  variant: 'selected' | 'hover' | 'best' | 'gold'
}) {
  const { x1, y1, x2, y2 } = lineEndpoints(line, size)
  return (
    <line
      className={`matrix-line matrix-line--${variant}`}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      vectorEffect="non-scaling-stroke"
      strokeLinecap="round"
    />
  )
}

/**
 * A row of rolled score tiles (the "normal roll" look): each score as a rounded
 * die tile, tinted by value, with its ability modifier on a corner badge. Shared
 * by the dice-pool result, the matrix's chosen line, and the Pool's group totals
 * so they all read the same. A null entry renders as a blank placeholder tile, so
 * the Pool can keep six tiles on screen while its groups are still filling in.
 * Scores are shown high-to-low (blanks last); assignment order is handled below.
 */
function ScoreTiles({
  scores,
  label,
  className,
}: {
  scores: (number | null)[]
  label: string
  className?: string
}) {
  return (
    <div
      className={`d-flex pb-2${className ? ` ${className}` : ''}`}
      aria-label={label}
      data-bs-theme="light"
    >
      {[...scores]
        .sort((a, b) => (b ?? -Infinity) - (a ?? -Infinity))
        .map((score, i) =>
          score == null ? (
            <div key={i} className="roll-die roll-die--blank" aria-hidden />
          ) : (
            <div key={i} className={`roll-die ${scoreCellClass(score)}`}>
              <span className={scoreColorClass(score)}>{score}</span>
              <span className="roll-die-mod">{formatMod(abilityMod(score))}</span>
            </div>
          ),
        )}
    </div>
  )
}

/**
 * One objective metric in a stats readout: a muted label and its value. Keeps the
 * summary rows uniform (DRY) so every method's numbers line up the same way.
 */
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <span className="text-body-secondary">{label}</span> <strong>{value}</strong>
    </span>
  )
}

/**
 * Objective summary of a rolled set of scores, identical for every method: the
 * total, the computed average (total / count), and the sum of the modifiers the
 * scores grant. No luck or "vs average" framing - just the same three facts.
 */
function StatsSummary({ stats }: { stats: RollStats }) {
  const { total, average, modSum } = stats
  return (
    <div className="d-flex flex-wrap gap-3 small mt-2" aria-label="Roll statistics">
      <Stat label="Total" value={total} />
      <Stat label="Average" value={average.toFixed(1)} />
      <Stat label="Mod sum" value={formatMod(modSum)} />
    </div>
  )
}

export function StatGeneration() {
  const character = useCharacter()
  const updateActive = useUpdateCharacter()
  const [hovered, setHovered] = useState<LineRef | null>(null)
  // The face shown on the roll buttons; re-randomised on each click so the die
  // appears to tumble (a small "rolling" flourish, purely decorative).
  const [dieFace, setDieFace] = useState<DieFace>(6)

  // The saved character is the single source of truth for the matrix, so a rolled
  // grid and the picked line survive reload/reopen (and export/import) the same way
  // the other methods' pools do. The MatrixCell grid and selected line are derived
  // from the saved scores each render; only `hovered`/`dieFace` are transient UI.
  const savedMatrix = character?.matrix ?? null
  const matrix = useMemo(
    () => (savedMatrix ? matrixFromScores(savedMatrix.scores) : null),
    [savedMatrix],
  )
  const selected: LineRef | null = savedMatrix?.line ?? null

  if (!character) return null
  const method = character.statMethod
  const abilityRecords = rollRecords(character.history, 'ability')
  const abilityCursor = character.rollCursors.ability ?? null

  /** Restore a browsed ability roll: its method, pool/grid, and cleared assignments. */
  function applyAbilityRecord(record: RollRecord) {
    if (!character) return
    const rollCursors = withCursor(character, 'ability', record.id)
    setHovered(null)
    if (record.kind === 'stat-pool') {
      updateActive({
        statMethod: 'roll',
        rollConfig: { ...record.config },
        statPool: [...record.scores],
        matrix: null,
        gauntlet: null,
        pool: null,
        abilities: clearedAbilities(character.abilities),
        rollCursors,
      })
    } else if (record.kind === 'matrix') {
      const grid = matrixFromScores(record.scores)
      const line = record.line
        ? matrixLines(grid).find(
            (l) => l.kind === record.line!.kind && l.index === record.line!.index,
          )
        : undefined
      updateActive({
        statMethod: 'matrix',
        matrix: { scores: record.scores, line: record.line },
        statPool: line ? [...line.values] : [],
        gauntlet: null,
        pool: null,
        abilities: clearedAbilities(character.abilities),
        rollCursors,
      })
    } else if (record.kind === 'gauntlet') {
      // Every slot's total is live, so restoring the historical totals makes them
      // immediately assignable again.
      const slots = record.scores.map((total, i) => ({
        total,
        rerolls: record.rerolls[i] ?? 0,
      }))
      updateActive({
        statMethod: 'gauntlet',
        gauntlet: { slots },
        matrix: null,
        pool: null,
        statPool: gauntletScores(slots),
        abilities: clearedAbilities(character.abilities),
        rollCursors,
      })
    } else if (record.kind === 'pool') {
      const groups = [...record.groups]
      updateActive({
        statMethod: 'pool',
        pool: { dice: [...record.dice], groups },
        matrix: null,
        gauntlet: null,
        statPool: poolScores(record.dice, groups),
        abilities: clearedAbilities(character.abilities),
        rollCursors,
      })
    }
  }

  function selectMethod(next: StatMethod) {
    if (!character) return
    setHovered(null)
    // Switching method clears any saved matrix/gauntlet/pool so a stale roll never lingers.
    if (next === 'array') {
      updateActive({
        statMethod: next,
        statPool: [...STANDARD_ARRAY],
        matrix: null,
        gauntlet: null,
        pool: null,
        abilities: clearedAbilities(character.abilities),
      })
    } else if (next === 'pointbuy') {
      updateActive({
        statMethod: next,
        statPool: [],
        matrix: null,
        gauntlet: null,
        pool: null,
        abilities: pointBuyBaseline(),
      })
    } else {
      updateActive({
        statMethod: next,
        statPool: [],
        matrix: null,
        gauntlet: null,
        pool: null,
        abilities: clearedAbilities(character.abilities),
      })
    }
  }

  function roll() {
    if (!character || !isRollMethod(method)) return
    setDieFace(randomFace())
    const config = character.rollConfig
    const scores = generatePool(method, config)
    // Every roll is recorded as a new one and becomes the roll in use, so a
    // fresh roll is always the newest entry to browse back from.
    const rolled = newRoll({
      stream: 'ability',
      kind: 'stat-pool',
      config: { ...config },
      scores,
    })
    updateActive(
      {
        statPool: scores,
        matrix: null,
        abilities: clearedAbilities(character.abilities),
      },
      rollAction(rolled),
    )
  }

  /** Update the configurable-roll settings (dice count / reroll count). */
  function updateRollConfig(patch: Partial<RollConfig>) {
    if (!character) return
    updateActive({ rollConfig: { ...character.rollConfig, ...patch } })
  }

  function rollMatrixGrid() {
    if (!character) return
    setDieFace(randomFace())
    const grid = rollMatrix(6, 6)
    const best = bestLine(matrixLines(grid))
    const scores = grid.map((row) => row.map((cell) => cell.sum))
    const line = best ? { kind: best.kind, index: best.index } : null
    setHovered(null)
    const rolled = newRoll({ stream: 'ability', kind: 'matrix', scores, line })
    updateActive(
      {
        matrix: { scores, line },
        statPool: best ? [...best.values] : [],
        abilities: clearedAbilities(character.abilities),
      },
      rollAction(rolled),
    )
  }

  function selectLine(kind: MatrixLine['kind'], index: number) {
    if (!character || !matrix || !savedMatrix) return
    const line = matrixLines(matrix).find((l) => l.kind === kind && l.index === index)
    if (!line) return
    // Picking a line refines the current matrix roll rather than making a new
    // one, so the roll in use is recorded again with its line.
    const active = activeRoll(character, 'ability')
    updateActive(
      {
        matrix: { scores: savedMatrix.scores, line: { kind, index } },
        statPool: [...line.values],
        abilities: clearedAbilities(character.abilities),
      },
      active?.kind === 'matrix'
        ? rollAction({ ...active, line: { kind, index } })
        : undefined,
    )
  }

  /** Start a fresh Gauntlet: six independent 3d6 slots, all totals live at once. */
  function rollGauntlet() {
    if (!character) return
    setDieFace(randomFace())
    const slots = Array.from({ length: 6 }, () => ({
      total: rollGauntletSlot(0),
      rerolls: 0,
    }))
    const rolled = newRoll({
      stream: 'ability',
      kind: 'gauntlet',
      scores: slots.map((s) => s.total),
      rerolls: slots.map((s) => s.rerolls),
    })
    updateActive(
      {
        gauntlet: { slots },
        matrix: null,
        pool: null,
        statPool: gauntletScores(slots),
        abilities: clearedAbilities(character.abilities),
      },
      rollAction(rolled),
    )
  }

  /** Commit changed Gauntlet slots: refine the roll in use and recompute the pool. */
  function commitGauntlet(slots: { total: number; rerolls: number }[]) {
    if (!character) return
    const active = activeRoll(character, 'ability')
    updateActive(
      {
        gauntlet: { slots },
        statPool: gauntletScores(slots),
        abilities: clearedAbilities(character.abilities),
      },
      active?.kind === 'gauntlet'
        ? rollAction({
            ...active,
            scores: slots.map((s) => s.total),
            rerolls: slots.map((s) => s.rerolls),
          })
        : undefined,
    )
  }

  /**
   * Reroll one slot at a growing penalty (3d6 minus its reroll count, clamped).
   * A reroll is refused once it can no longer beat the current total - the same
   * zero-probability test that disables the button - so the score never worsens
   * on a bet that cannot possibly win.
   */
  function gauntletReroll(index: number) {
    if (!character?.gauntlet) return
    const slot = character.gauntlet.slots[index]
    if (!slot || gauntletImproveChance(slot.total, slot.rerolls) === 0) return
    const rerolls = slot.rerolls + 1
    const total = rollGauntletSlot(rerolls)
    commitGauntlet(
      character.gauntlet.slots.map((s, i) =>
        i === index ? { ...s, total, rerolls } : s,
      ),
    )
  }

  /**
   * Roll a fresh Pool: 18d6, all ungrouped. Nothing is written to history yet - a
   * pool earns its single entry only once the grouping is complete (see poolChange),
   * so an unfinished pool never leaves a stray "grouping…" record. The ability
   * cursor is cleared so no earlier roll reads as "current" while this fresh, not-
   * yet-recorded pool is being grouped.
   */
  function rollPool() {
    if (!character) return
    setDieFace(randomFace())
    const dice = rollDice(18, 6)
    const groups: (number | null)[] = Array(18).fill(null)
    updateActive({
      pool: { dice, groups },
      matrix: null,
      gauntlet: null,
      statPool: [],
      abilities: clearedAbilities(character.abilities),
      rollCursors: withCursor(character, 'ability', null),
    })
  }

  /**
   * Apply a Pool regrouping and recompute the pool. A pool is recorded only when its
   * grouping is complete (six scores): the first completing grouping appends the one
   * entry for this roll, and rearranging an already-recorded pool into a new valid
   * grouping refines that same entry in place. An incomplete grouping is working
   * state only - it never creates or alters a history entry.
   */
  function poolChange(nextGroups: (number | null)[]) {
    if (!character?.pool) return
    const dice = character.pool.dice
    const scores = poolScores(dice, nextGroups)
    const active = activeRoll(character, 'ability')
    const grouped = { groups: [...nextGroups], scores }
    const complete =
      active?.kind === 'pool'
        ? { ...active, ...grouped }
        : newRoll({ stream: 'ability', kind: 'pool', dice: [...dice], ...grouped })
    updateActive(
      {
        pool: { dice, groups: nextGroups },
        statPool: scores,
        abilities: clearedAbilities(character.abilities),
      },
      scores.length ? rollAction(complete) : undefined,
    )
  }

  /** One-line summary of an ability roll for the history arrows and modal rows. */
  function abilitySummary(record: RollRecord) {
    if (record.kind === 'stat-pool') {
      const label = rollConfigLabel(record.config)
      const scores = [...record.scores].sort((a, b) => b - a).join(', ')
      return `${label}: ${scores}`
    }
    if (record.kind === 'matrix') {
      const chosen = record.line
        ? matrixLines(matrixFromScores(record.scores)).find(
            (l) => l.kind === record.line!.kind && l.index === record.line!.index,
          )
        : undefined
      const values = chosen
        ? ` - ${[...chosen.values].sort((a, b) => b - a).join(', ')}`
        : ''
      return `Matrix${values}`
    }
    if (record.kind === 'gauntlet') {
      const scores = [...record.scores].sort((a, b) => b - a).join(', ')
      return `Gauntlet - ${scores}`
    }
    if (record.kind === 'pool') {
      const scores = poolScores(record.dice, record.groups)
      const label = scores.length
        ? [...scores].sort((a, b) => b - a).join(', ')
        : 'grouping…'
      return `Pool - ${label}`
    }
    return ''
  }

  const poolStats = method !== 'matrix' ? rollStats(character.statPool) : null

  return (
    <SubSection
      title="Method"
      subtitle="Roll, use the standard array, or point buy. Assign the results in the table below."
    >
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <Form.Select
          value={method}
          onChange={(e) => selectMethod(e.target.value as StatMethod)}
          style={{ maxWidth: 280 }}
          aria-label="Ability score method"
        >
          {METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Form.Select>

        {isRollMethod(method) && (
          <Button variant="success" onClick={roll}>
            <DieFaceIcon face={dieFace} className="me-1" />
            Roll
          </Button>
        )}
        {method === 'matrix' && (
          <Button variant="success" onClick={rollMatrixGrid}>
            <DieFaceIcon face={dieFace} className="me-1" />
            Roll Matrix
          </Button>
        )}
        {method === 'gauntlet' && (
          <Button variant="success" onClick={rollGauntlet}>
            <DieFaceIcon face={dieFace} className="me-1" />
            Roll Gauntlet
          </Button>
        )}
        {method === 'pool' && (
          <Button variant="success" onClick={rollPool}>
            <DieFaceIcon face={dieFace} className="me-1" />
            Roll Pool
          </Button>
        )}
        {(isRollMethod(method) ||
          method === 'matrix' ||
          method === 'gauntlet' ||
          method === 'pool') && (
          <RollHistoryControls
            records={abilityRecords}
            activeId={abilityCursor}
            onSelect={applyAbilityRecord}
            renderSummary={abilitySummary}
            title="Ability roll history"
          />
        )}
        {method === 'pointbuy' && (
          <span className="text-body-secondary small">
            27-point buy - set scores in the table below.
          </span>
        )}
        {method === 'array' && (
          <span className="text-body-secondary small">
            Standard array - assign the values in the table below.
          </span>
        )}
      </div>

      {isRollMethod(method) && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <span className="text-body-secondary">Roll</span>
          <RollNumberInput
            id="roll-dice"
            value={character.rollConfig.dice}
            min={ROLL_DICE_MIN}
            max={ROLL_DICE_MAX}
            ariaLabel="Number of d6 to roll"
            onCommit={(dice) => updateRollConfig({ dice })}
          />
          <span
            className="text-body-secondary"
            title="Roll this many d6, reroll the current-lowest die the chosen number of times, then keep the highest 3"
          >
            D6 Dice Keep 3 Reroll
          </span>
          <RollNumberInput
            id="roll-rerolls"
            value={character.rollConfig.rerolls}
            min={ROLL_REROLLS_MIN}
            max={ROLL_REROLLS_MAX}
            ariaLabel="Number of times to reroll the lowest die"
            onCommit={(rerolls) => updateRollConfig({ rerolls })}
          />
        </div>
      )}

      {method === 'gauntlet' && character.gauntlet && (
        <GauntletRoll slots={character.gauntlet.slots} onReroll={gauntletReroll} />
      )}

      {method === 'pool' && character.pool && (
        <PoolRoll
          dice={character.pool.dice}
          groups={character.pool.groups}
          onChange={poolChange}
        />
      )}

      {/* The Pool keeps its six score tiles on screen the whole time (blanks for
          groups not yet complete). While grouping, a lightweight Total/Average
          gives pre-distribution feedback; once every group is full the same
          objective StatsSummary the other methods show takes over (so the two
          never duplicate). */}
      {method === 'pool' &&
        character.pool &&
        (() => {
          const tiles = poolGroupTotals(character.pool.dice, character.pool.groups)
          const total = sum(character.pool.dice)
          return (
            <>
              <ScoreTiles
                scores={tiles}
                label="Grouped scores"
                className="flex-wrap gap-3 pe-2"
              />
              {poolStats ? (
                <StatsSummary stats={poolStats} />
              ) : (
                <div
                  className="d-flex flex-wrap gap-3 small mt-2"
                  aria-label="Pool totals"
                >
                  <Stat label="Total" value={total} />
                  <Stat label="Average" value={(total / 6).toFixed(1)} />
                </div>
              )}
            </>
          )
        })()}

      {method !== 'matrix' &&
        method !== 'pointbuy' &&
        method !== 'pool' &&
        character.statPool.length > 0 && (
          <>
            <ScoreTiles
              scores={character.statPool}
              label="Generated scores"
              className="flex-wrap gap-3 pe-2"
            />
            {poolStats && <StatsSummary stats={poolStats} />}
          </>
        )}

      {method === 'matrix' &&
        matrix &&
        (() => {
          const size = matrix[0]?.length ?? 0
          const lines = matrixLines(matrix)
          const bestSum = lines.reduce((max, l) => Math.max(max, l.sum), -Infinity)
          // A "gold" line is a best line that also lands at least one 18: the
          // strongest possible pick. It is drawn gold and outranks any blue, so
          // whether selected or merely tied for best, gold wins the styling.
          const isGoldLine = (l: MatrixLine) =>
            l.sum === bestSum && l.values.some((v) => v >= 18)
          const selectedLine = selected
            ? (lines.find(
                (l) => l.kind === selected.kind && l.index === selected.index,
              ) ?? null)
            : null
          const matrixStats = selectedLine ? rollStats(selectedLine.values) : null
          const lineOf = (kind: MatrixLine['kind'], index: number) =>
            lines.find((l) => l.kind === kind && l.index === index)
          const isSelected = (kind: MatrixLine['kind'], index: number) =>
            selected?.kind === kind && selected.index === index
          const selectorVariant = (
            kind: MatrixLine['kind'],
            index: number,
            sum: number,
          ) =>
            isSelected(kind, index)
              ? 'primary'
              : sum === bestSum
                ? 'primary'
                : 'secondary'
          const lineAverage = (line: MatrixLine) =>
            (line.sum / line.values.length).toFixed(1)
          // Every selector is the same square-shouldered size (`.matrix-selector`)
          // for a uniform edge. It shows the line's total and average; a plain
          // "Best" badge - no glyph - flags every line tied for the top total.
          // Hovering (or focusing) a selector previews its line in the overlay.
          const renderSelector = (line: MatrixLine, label: string) => {
            const ref: LineRef = { kind: line.kind, index: line.index }
            // When the picked line is a gold line, its selector is painted gold
            // too, so the button matches the gold line drawn across the grid.
            const selectedGold = isSelected(line.kind, line.index) && isGoldLine(line)
            return (
              <Button
                size="sm"
                variant={
                  selectedGold
                    ? 'warning'
                    : selectorVariant(line.kind, line.index, line.sum)
                }
                onClick={() => selectLine(line.kind, line.index)}
                onMouseEnter={() => setHovered(ref)}
                onMouseLeave={() => setHovered((h) => (sameLine(h, ref) ? null : h))}
                onFocus={() => setHovered(ref)}
                onBlur={() => setHovered((h) => (sameLine(h, ref) ? null : h))}
                aria-label={`${label} (total ${line.sum}, average ${lineAverage(line)})`}
                aria-pressed={isSelected(line.kind, line.index)}
                className="matrix-selector d-inline-flex flex-column align-items-center justify-content-center lh-1"
              >
                <span className="fw-bold">{line.sum}</span>
                <span className="small fw-medium">avg {lineAverage(line)}</span>
                {line.sum === bestSum && <span className="small fw-bold">Best</span>}
              </Button>
            )
          }
          const diagMain = lineOf('diag', 0) // top-left → bottom-right
          const diagAnti = lineOf('diag', 1) // bottom-left → top-right
          // Only draw a hover preview when it differs from the current selection.
          const hoverPreview = sameLine(hovered, selected) ? null : hovered

          return (
            <div className="matrix-roll">
              <div
                className="matrix-grid"
                role="group"
                aria-label="Rolled score matrix"
                style={
                  {
                    gridTemplateColumns: `var(--matrix-cell) var(--matrix-gap) repeat(${size}, var(--matrix-cell)) var(--matrix-gap) var(--matrix-cell)`,
                    gridTemplateRows: `repeat(${size}, var(--matrix-cell)) var(--matrix-gap) var(--matrix-cell)`,
                  } as CSSProperties
                }
              >
                {matrix.map((row) =>
                  row.map((cell) => (
                    <div
                      key={`${cell.row}-${cell.col}`}
                      // Only the data cells keep a pinned light theme, so their tint
                      // and score colour read the same in either app theme. The
                      // selectors and the empty gutter follow the page theme instead,
                      // so their background matches the page (white in light, dark in
                      // dark) rather than showing this light island's white.
                      data-bs-theme="light"
                      className={`matrix-cell ${scoreCellClass(cell.sum)} ${scoreColorClass(cell.sum)}`}
                      style={{ gridColumn: cell.col + 3, gridRow: cell.row + 1 }}
                      title={`${cell.sum} (${formatMod(cell.mod)})`}
                    >
                      {cell.sum}
                    </div>
                  )),
                )}

                {matrix.map((_, r) => {
                  const rowLine = lineOf('row', r)
                  return (
                    rowLine && (
                      <div
                        key={`rowsel-${r}`}
                        className="matrix-selector-cell"
                        style={{ gridColumn: size + 4, gridRow: r + 1 }}
                      >
                        {renderSelector(rowLine, `Use row ${r + 1}`)}
                      </div>
                    )
                  )
                })}

                {matrix[0].map((_, c) => {
                  const colLine = lineOf('col', c)
                  return (
                    colLine && (
                      <div
                        key={`colsel-${c}`}
                        className="matrix-selector-cell"
                        style={{ gridColumn: c + 3, gridRow: size + 2 }}
                      >
                        {renderSelector(colLine, `Use column ${c + 1}`)}
                      </div>
                    )
                  )
                })}

                {/* Anti-diagonal picker at its bottom-left end. */}
                {diagAnti && (
                  <div
                    className="matrix-selector-cell"
                    style={{ gridColumn: 1, gridRow: size + 2 }}
                  >
                    {renderSelector(
                      diagAnti,
                      'Use the anti-diagonal, bottom-left to top-right',
                    )}
                  </div>
                )}
                {/* Main-diagonal picker at its bottom-right end. */}
                {diagMain && (
                  <div
                    className="matrix-selector-cell"
                    style={{ gridColumn: size + 4, gridRow: size + 2 }}
                  >
                    {renderSelector(
                      diagMain,
                      'Use the main diagonal, top-left to bottom-right',
                    )}
                  </div>
                )}

                {/* Line overlay: sits exactly over the cell block, above the cells.
                    The picked line is a solid accent; a hover preview is lighter,
                    so you can always tell what is selected from what you're eyeing. */}
                <svg
                  className="matrix-lines"
                  viewBox={`0 0 ${size} ${size}`}
                  preserveAspectRatio="none"
                  aria-hidden
                  style={{ gridColumn: `3 / span ${size}`, gridRow: `1 / span ${size}` }}
                >
                  {/* Every line tied for the best total is drawn faintly so
                      the player sees all the top options at once; the one they pick
                      is promoted to the solid selected line below, and hover sits
                      on top. Drawn first = underneath the selected/hover lines. */}
                  {lines
                    .filter(
                      (l) =>
                        l.sum === bestSum &&
                        !sameLine({ kind: l.kind, index: l.index }, selected),
                    )
                    .map((l) => (
                      <OverlayLine
                        key={`best-${l.kind}-${l.index}`}
                        line={{ kind: l.kind, index: l.index }}
                        size={size}
                        variant={isGoldLine(l) ? 'gold' : 'best'}
                      />
                    ))}
                  {hoverPreview && (
                    <OverlayLine line={hoverPreview} size={size} variant="hover" />
                  )}
                  {selected && (
                    <OverlayLine
                      line={selected}
                      size={size}
                      variant={
                        selectedLine && isGoldLine(selectedLine) ? 'gold' : 'selected'
                      }
                    />
                  )}
                </svg>
              </div>

              {selectedLine && (
                <ScoreTiles
                  scores={selectedLine.values}
                  label="Chosen line scores"
                  className="mt-3 matrix-line-tiles"
                />
              )}
              {matrixStats && <StatsSummary stats={matrixStats} />}

              <div className="small text-body-secondary mt-2">
                Pick a row, column, or diagonal; lines tied for the highest total are
                marked Best and drawn faintly. The chosen line is drawn solid across the
                grid, and its six scores become your pool.
              </div>
            </div>
          )
        })()}
    </SubSection>
  )
}
