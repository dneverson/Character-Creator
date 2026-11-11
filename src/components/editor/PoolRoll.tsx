import { useState, type DragEvent } from 'react'
import { abilityMod, formatMod, sum } from '../../dice/dice'
import { DieFaceIcon, type DieFace } from '../Icon'
import { scoreColorClass } from '../../ui/scoreColor'

const GROUP_COUNT = 6
const GROUP_SIZE = 3
const DRAG_TYPE = 'text/plain'

/**
 * The Pool method's interactive area (homebrew): 18 rolled d6 the player sorts
 * into six groups of three, each group summing to one ability score. Grouping is
 * multi-modal - click a group to select it then click dice to fill it, click a
 * pool die with nothing selected to auto-fill the next open group, drag a die
 * onto a group (to place/move) or back onto the pool (to remove), or drop a die
 * onto another die to swap their places. When all 18 are grouped the six sums
 * become the assignable pool (handled by the parent). This
 * component owns only the transient "selected group" UI; grouping changes are
 * reported to the parent, which owns the roll and its history.
 */
export function PoolRoll({
  dice,
  groups,
  onChange,
}: {
  dice: number[]
  groups: (number | null)[]
  onChange: (nextGroups: (number | null)[]) => void
}) {
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)

  const indicesIn = (group: number | null) =>
    dice.map((_, i) => i).filter((i) => groups[i] === group)
  const groupSum = (group: number) => sum(indicesIn(group).map((i) => dice[i]))
  const roomIn = (group: number, excluding = -1) =>
    dice.filter((_, i) => groups[i] === group && i !== excluding).length < GROUP_SIZE

  /** Move die `i` to `target` group (or back to the pool when null); ignore a full group. */
  function assign(i: number, target: number | null) {
    if (target != null && !roomIn(target, i)) return
    const next = [...groups]
    next[i] = target
    onChange(next)
  }

  /**
   * Swap two dice between their slots: die `i` takes die `j`'s group and vice
   * versa. Because it only exchanges assignments, every group keeps the same die
   * count, so it can never overfill a group - this lets a die drop straight onto
   * another (even in a full group) without routing back through the pool.
   */
  function swap(i: number, j: number) {
    if (i === j) return
    const next = [...groups]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  /** Drop a die into the first group that still has room. */
  function autoFill(i: number) {
    for (let g = 0; g < GROUP_COUNT; g++) {
      if (roomIn(g, i)) {
        assign(i, g)
        return
      }
    }
  }

  function onDieClick(i: number) {
    const current = groups[i]
    if (selectedGroup != null) {
      // Clicking a die already in the selected group pulls it back to the pool;
      // otherwise the selected group is the target (a no-op when it is full).
      if (current === selectedGroup) assign(i, null)
      else assign(i, selectedGroup)
      return
    }
    // No group selected: a pool die auto-fills, a grouped die returns to the pool.
    if (current == null) autoFill(i)
    else assign(i, null)
  }

  /** Read the dragged die index from a drop event, or null if it is not a valid die. */
  function draggedIndex(e: DragEvent): number | null {
    const raw = e.dataTransfer.getData(DRAG_TYPE)
    if (raw === '') return null
    const i = Number(raw)
    return Number.isInteger(i) && i >= 0 && i < dice.length ? i : null
  }

  function onDrop(e: DragEvent, target: number | null) {
    e.preventDefault()
    const i = draggedIndex(e)
    if (i != null) assign(i, target)
  }

  /** Drop onto another die: swap their slots (stop the group/pool drop from also firing). */
  function onDieDrop(e: DragEvent, target: number) {
    e.preventDefault()
    e.stopPropagation()
    const i = draggedIndex(e)
    if (i != null) swap(i, target)
  }

  const allowDrop = (e: DragEvent) => e.preventDefault()

  const die = (i: number, inGroup: boolean) => (
    <button
      key={i}
      type="button"
      className={`pool-die${inGroup ? ' pool-die--placed' : ''}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, String(i))}
      onDragOver={allowDrop}
      onDrop={(e) => onDieDrop(e, i)}
      onClick={() => onDieClick(i)}
      aria-label={`Die showing ${dice[i]}${
        inGroup ? ' (click to return to the pool)' : ' (click to group)'
      }`}
    >
      <DieFaceIcon face={dice[i] as DieFace} />
    </button>
  )

  const ungrouped = indicesIn(null)

  return (
    <div className="pool-roll">
      <div className="row g-3">
        {Array.from({ length: GROUP_COUNT }, (_, g) => {
          const members = indicesIn(g)
          const complete = members.length === GROUP_SIZE
          const total = groupSum(g)
          const selected = selectedGroup === g
          return (
            <div key={g} className="col-6 col-md-4">
              <div
                className={`pool-group${selected ? ' pool-group--selected' : ''}`}
                onDragOver={allowDrop}
                onDrop={(e) => onDrop(e, g)}
              >
                <button
                  type="button"
                  className="pool-group__head"
                  onClick={() => setSelectedGroup(selected ? null : g)}
                  aria-pressed={selected}
                  aria-label={`Group ${g + 1}${selected ? ', selected' : ''}, ${
                    members.length
                  } of ${GROUP_SIZE} dice`}
                >
                  <span className="fw-medium">Group {g + 1}</span>
                  <span className="text-body-secondary small">
                    {members.length}/{GROUP_SIZE}
                  </span>
                  {complete ? (
                    <span className={`pool-group__sum ${scoreColorClass(total)}`}>
                      {total}{' '}
                      <span className="small">({formatMod(abilityMod(total))})</span>
                    </span>
                  ) : (
                    <span className="pool-group__sum text-body-secondary">{total}</span>
                  )}
                </button>
                <div className="pool-group__dice">{members.map((i) => die(i, true))}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3">
        <div className="small text-body-secondary mb-1">
          Pool ({ungrouped.length} left)
        </div>
        <div
          className="pool-bank"
          onDragOver={allowDrop}
          onDrop={(e) => onDrop(e, null)}
          aria-label="Ungrouped dice pool"
        >
          {ungrouped.length > 0 ? (
            ungrouped.map((i) => die(i, false))
          ) : (
            <span className="text-body-secondary small">
              All dice grouped - the six group sums are your pool.
            </span>
          )}
        </div>
      </div>

      <div className="small text-body-secondary mt-2">
        Sort all 18 dice into six groups of three; each group sums to one ability score.
        Click a group to select it and click dice to fill it, click a pool die to drop it
        in the next open group, or drag dice between the groups and the pool. Drop a die
        onto another die to swap their places. Click a grouped die to send it to the pool.
      </div>
    </div>
  )
}
