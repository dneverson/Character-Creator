// The Rules group of a row's description: why a non-standard row is non-standard.

import type { Describe } from './facts'
import type { RowMeta } from './types'

export const NON_STANDARD = 'Non-standard'
export const reasonOf = (meta: Omit<RowMeta, 'id'>) =>
  meta.reason ?? 'Not a standard choice'

/**
 * The description with a Rules group in front that says why a row is non-standard: what the
 * detail pane and the compare window show. Without `rowMeta` it is the description itself.
 */
export function withRulesGroup<T>(
  describe: Describe<T>,
  rowMeta: ((row: T) => Omit<RowMeta, 'id'>) | undefined,
): Describe<T> {
  if (rowMeta === undefined) return describe
  return (entries) => [
    {
      key: 'rules',
      title: 'Rules',
      facts: [
        {
          key: 'non-standard',
          label: NON_STANDARD,
          text: (row) => {
            const meta = rowMeta(row)
            return meta.standard ? '' : reasonOf(meta)
          },
        },
      ],
    },
    ...describe(entries),
  ]
}
