// Counts which components React rendered in each commit, for tests that hold an update to
// re-rendering only what depends on it. It listens where React DevTools listens: React
// reports every commit to a global hook it finds when react-dom first loads, so a test
// file imports this module before anything that loads react-dom.

/** The parts of a React fiber the count reads. */
interface Fiber {
  tag: number
  type: unknown
  flags: number
  child: Fiber | null
  sibling: Fiber | null
  alternate: Fiber | null
}

interface FiberRoot {
  current: Fiber
}

/** React's flag for a component whose render function ran in this commit. */
const PERFORMED_WORK = 1
/** Function, class, forwardRef and simple memo components (memo's inner component). */
const COMPONENT_TAGS = new Set([0, 1, 11, 15])

let counts = new Map<string, number>()

const nameOf = (type: unknown): string => {
  if (typeof type === 'function') {
    const named = type as { displayName?: string; name?: string }
    return named.displayName ?? named.name ?? 'Anonymous'
  }
  if (type && typeof type === 'object' && 'render' in type) {
    return nameOf((type as { render: unknown }).render)
  }
  return 'Anonymous'
}

/**
 * Walk the committed tree the way DevTools does: a fiber with no previous version mounted,
 * one with the performed-work flag rendered, and a subtree whose child list was reused
 * (the parent bailed out) was not visited at all.
 */
function walk(fiber: Fiber | null) {
  for (let node = fiber; node; node = node.sibling) {
    const prev = node.alternate
    if (COMPONENT_TAGS.has(node.tag) && (!prev || node.flags & PERFORMED_WORK)) {
      const name = nameOf(node.type)
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    if (!prev || node.child !== prev.child) walk(node.child)
  }
}

const hook = {
  supportsFiber: true,
  renderers: new Map(),
  inject: () => 1,
  onCommitFiberRoot: (_id: number, root: FiberRoot) => walk(root.current.child),
  onCommitFiberUnmount: () => {},
  onPostCommitFiberRoot: () => {},
  checkDCE: () => {},
}

Object.assign(globalThis, { __REACT_DEVTOOLS_GLOBAL_HOOK__: hook })

/** Forget the counts so far. */
export function resetRenderCounts() {
  counts = new Map()
}

/** How many times each component rendered since the last reset, by component name. */
export function renderCounts(): ReadonlyMap<string, number> {
  return counts
}

/** How many times the named component rendered since the last reset. */
export const renderCount = (name: string) => counts.get(name) ?? 0
