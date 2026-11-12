import { useMemo } from 'react'
import Alert from 'react-bootstrap/Alert'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Spinner from 'react-bootstrap/Spinner'
import { loadBeasts, type Beast } from '../../data/beasts'
import { loadBookEditions, type Edition } from '../../data/edition'
import {
  beastFit,
  crLabel,
  wildShapeLimits,
  wildShapeRuleLines,
  type WildShapeLimits,
} from '../../rules/wildshape'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import type { BeastRef } from '../../character/model'
import { useAsyncData } from '../../hooks/useAsyncData'
import { Abbr, AbbrText } from '../Abbr'
import { PickMany } from '../table/PickMany'
import type { RowMeta } from '../table/types'
import {
  beastColumns,
  beastKey,
  beastName,
  beastSearchText,
  beastSummaryColumns,
  beastTags,
  describeBeasts,
} from './beastFacts'
import { EditorSection } from './EditorSection'

type Meta = Omit<RowMeta, 'id'>

const isDruid = (name: string) => name === 'Druid'

/** The wild shape forms of the active character as they are now (a batch adds several). */
function currentForms(): BeastRef[] {
  const { activeId, characters } = useCharacterStore.getState()
  return activeId ? (characters[activeId]?.wildShapes ?? []) : []
}

interface BeastFormsProps {
  selectedBooks: string[]
  wildShapes: BeastRef[]
  limits: WildShapeLimits
}

/**
 * The beast table of a Druid who can use Wild Shape. The bestiary is the largest
 * part of the book data, so it is read only when this table is shown.
 */
function BeastForms({ selectedBooks, wildShapes, limits }: BeastFormsProps) {
  const updateActive = useCharacterStore((s) => s.updateActive)
  const booksKey = selectedBooks.join(',')
  const loader = useMemo(
    () => () => loadBeasts(booksKey ? booksKey.split(',') : []),
    [booksKey],
  )
  const { data: beasts, error, loading } = useAsyncData(loader)

  const known = useMemo(
    () => new Map((beasts ?? []).map((b) => [beastKey(b), b])),
    [beasts],
  )
  const picked = wildShapes.flatMap((ref) => known.get(beastKey(ref)) ?? [])
  // Forms from a book that is not selected cannot be shown as a row, so they are listed apart.
  const unread = wildShapes.filter((ref) => !known.has(beastKey(ref)))
  const pickedIds = new Set(picked.map(beastKey))

  const forms = limits.knownForms
  const limit =
    forms === undefined
      ? undefined
      : { max: forms, reason: `You know ${forms} forms at druid level ${limits.level}` }

  const setForms = (next: BeastRef[]) => updateActive({ wildShapes: next })
  const add = (b: Beast) =>
    setForms([...currentForms(), { name: b.name, source: b.source }])
  const remove = (ref: { name: string; source: string }) =>
    setForms(currentForms().filter((x) => beastKey(x) !== beastKey(ref)))

  // A form still to add: inside the limits, and room among the known forms.
  const rowMeta = (b: Beast): Meta => {
    const fit = beastFit(b, limits)
    if (!fit.standard || pickedIds.has(beastKey(b)) || forms === undefined) return fit
    return picked.length >= forms
      ? {
          standard: false,
          reason: `You know ${forms} forms already: remove one to learn another`,
        }
      : fit
  }

  if (loading) {
    return (
      <div className="text-body-secondary">
        <Spinner size="sm" animation="border" className="me-2" />
        Loading beasts…
      </div>
    )
  }
  if (error) {
    return <Alert variant="danger">Failed to load beasts: {error.message}</Alert>
  }
  if ((beasts ?? []).length === 0 && wildShapes.length === 0) {
    return (
      <Alert variant="info" className="mb-0">
        No beast books selected: turn on the Monster Manual (2014) or the 2025 Monster
        Manual in Books.
      </Alert>
    )
  }

  return (
    <>
      {unread.length > 0 && (
        <Alert variant="warning" className="py-2">
          {unread.map((ref) => (
            <div key={beastKey(ref)} className="d-flex align-items-center gap-2">
              <span>
                {ref.name} ({ref.source}) is in a book that is not selected.
              </span>
              <Button size="sm" variant="danger" onClick={() => remove(ref)}>
                Remove
              </Button>
            </div>
          ))}
        </Alert>
      )}
      <PickMany<Beast>
        tableId="wild-shape-beasts"
        rows={beasts ?? []}
        columns={beastColumns}
        idOf={beastKey}
        nameOf={beastName}
        tagsOf={beastTags}
        describe={describeBeasts}
        searchText={beastSearchText}
        rowMeta={rowMeta}
        pickedRowMeta={(b) => beastFit(b, limits)}
        picked={picked}
        onAdd={add}
        onRemove={remove}
        noun="forms"
        limit={limit}
        autoCloseAtLimit={limit !== undefined}
        summaryColumns={beastSummaryColumns}
        summaryTableId="wild-shape-forms"
        tableShare={75}
        labels={{
          compare: 'Compare beasts',
          search: 'Search beasts, traits and attacks…',
          table: 'Beasts for Wild Shape',
        }}
      />
    </>
  )
}

export function WildShapeSection() {
  const character = useActiveCharacter()
  const editions = useAsyncData(loadBookEditions)

  const druid = useMemo(() => {
    if (!character) return undefined
    const classes = character.classes.filter((c) => isDruid(c.name))
    if (classes.length === 0) return undefined
    const level = classes.reduce((n, c) => n + (c.level || 0), 0)
    const moon = classes.some((c) => c.subclass?.shortName === 'Moon')
    // A druid whose books mix editions follows the first Druid row's book.
    return { level, moon, source: classes[0].source }
  }, [character])

  if (!character) return null
  if (!druid) return null // section only applies to Druids

  const edition: Edition | undefined = editions.data
    ? editions.data(druid.source)
    : editions.error
      ? 'classic'
      : undefined
  const limits = wildShapeLimits(druid.level, druid.moon, edition)
  const ready = edition !== undefined

  return (
    <EditorSection
      id="wildshape"
      title="Wild Shape"
      subtitle="Beast forms your Druid can assume. Forms beyond your level's limits are allowed but flagged."
      actions={
        limits.available && ready ? (
          <Badge bg="secondary">
            Max <Abbr code="CR" /> {crLabel(limits.maxCr)}
            {limits.moon && ' - Moon'}
          </Badge>
        ) : undefined
      }
    >
      {!limits.available && (
        <Alert variant="info" className="mb-0">
          Wild Shape unlocks at Druid level 2.
        </Alert>
      )}

      {limits.available && !ready && (
        <div className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading Wild Shape rules…
        </div>
      )}

      {limits.available && ready && (
        <>
          <div className="small text-body-secondary mb-3">
            {wildShapeRuleLines(limits).map((line) => (
              <p key={line} className="mb-1">
                <AbbrText text={line} />
              </p>
            ))}
          </div>
          <BeastForms
            selectedBooks={character.selectedBooks}
            wildShapes={character.wildShapes}
            limits={limits}
          />
        </>
      )}
    </EditorSection>
  )
}
