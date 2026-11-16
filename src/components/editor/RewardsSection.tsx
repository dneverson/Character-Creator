// The supernatural gifts the DM grants (DMG and XDMG: blessings, charms, epic boons and
// the other rewards of the books), added to the character from a table that says what
// each does. What a gift gives goes through the rule tables like any other source; its
// text and its uses are on the sheet's Features tab.

import { useMemo } from 'react'
import Alert from 'react-bootstrap/Alert'
import Spinner from 'react-bootstrap/Spinner'
import type { RewardRef } from '../../character/model'
import {
  useCharacter,
  useLatestCharacter,
  useUpdateCharacter,
} from '../../character/useCharacterDoc'
import { loadRewards, type Reward } from '../../data/rewards'
import { useAsyncData } from '../../hooks/useAsyncData'
import { PickMany } from '../table/PickMany'
import { EditorSection } from './EditorSection'
import {
  describeRewards,
  rewardColumns,
  rewardKey,
  rewardName,
  rewardSearchText,
  rewardSummaryColumns,
} from './rewardFacts'

const refKey = (ref: RewardRef) => `${ref.name}|${ref.source}`

export function RewardsSection() {
  const character = useCharacter()
  const updateActive = useUpdateCharacter()
  const latest = useLatestCharacter()
  const { data: rewards, error, loading } = useAsyncData(loadRewards)
  const books = character?.selectedBooks
  const rows = useMemo(
    () => (rewards ?? []).filter((r) => books?.includes(r.source)),
    [rewards, books],
  )
  if (!character) return null

  const byKey = new Map((rewards ?? []).map((r) => [r.key, r]))
  const refs = character.rewards ?? []
  const picked = refs.flatMap((ref) => byKey.get(refKey(ref)) ?? [])
  const current = () => latest()?.rewards ?? []
  const setRewards = (next: RewardRef[]) =>
    updateActive({ rewards: next.length > 0 ? next : undefined })
  const add = (r: Reward) =>
    setRewards([...current(), { name: r.name, source: r.source }])
  const remove = (r: Pick<Reward, 'key'>) =>
    setRewards(current().filter((ref) => refKey(ref) !== r.key))

  return (
    <EditorSection
      id="rewards"
      title="Rewards"
      subtitle="Blessings, charms, boons and other supernatural gifts your DM grants."
    >
      {loading && (
        <div className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading rewards...
        </div>
      )}
      {error && <Alert variant="danger">Failed to load rewards: {error.message}</Alert>}
      {!loading && !error && rows.length === 0 && picked.length === 0 && (
        <Alert variant="info" className="mb-0">
          No rewards in the selected books: they are in the Dungeon Master&apos;s Guide
          (2014 and 2024) and other books of the full content.
        </Alert>
      )}
      {(rows.length > 0 || picked.length > 0) && (
        <PickMany<Reward>
          tableId="rewards"
          rows={rows}
          columns={rewardColumns}
          idOf={rewardKey}
          nameOf={rewardName}
          describe={describeRewards}
          searchText={rewardSearchText}
          picked={picked}
          onAdd={add}
          onRemove={remove}
          noun="rewards"
          summaryColumns={rewardSummaryColumns}
          summaryTableId="rewards-taken"
          labels={{
            compare: 'Compare rewards',
            search: 'Search rewards and what they do...',
            table: 'Rewards',
          }}
        />
      )}
    </EditorSection>
  )
}
