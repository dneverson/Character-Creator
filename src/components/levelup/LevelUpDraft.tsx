import { useMemo, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Spinner from 'react-bootstrap/Spinner'
import Table from 'react-bootstrap/Table'
import { levelUpSteps, type LevelUp } from '../../character/levelUp'
import type { Character, LevelHitDie } from '../../character/model'
import { useCharacterStore } from '../../character/store'
import { useCharacter } from '../../character/useCharacterDoc'
import { resolveClassFeatures, type ResolvedFeature } from '../../data/class'
import type { DerivedSheet } from '../../derived'
import { AbbrText } from '../Abbr'
import { ClassLevelTable } from '../editor/ClassLevelTable'
import { FeatureAccordion, OptionCards } from '../editor/ClassFeatures'
import { FeatSlots } from '../editor/FeatsSection'
import { SpellsSection, type SpellsScope } from '../editor/SpellsSection'
import { useDerivedSheet } from '../editor/useDerivedSheet'
import { NO_VALUE } from '../table/facts'
import { usePickClassOption } from '../editor/usePickClassOption'
import { HitPointsStep } from './HitPointsStep'
import { levelUpPatch, openedChoices, spellChanges, summaryRows } from './levelUpSummary'
import { StepCard } from './StepCard'
import { SubclassStep } from './SubclassStep'

interface Props {
  /** The character as it is in the store, and its derived sheet. */
  before: Character
  beforeSheet: DerivedSheet
  level: LevelUp
}

const SWAP_TEXT =
  'When you gain a level in this class you can replace one spell you know with another: remove it below and choose the new one.'

/**
 * The steps of the level after the class, on the draft (read from the provider around it):
 * hit points, then each choice the level asks for, what it brings, and the summary with
 * Confirm and Cancel.
 */
export function LevelUpDraft({ before, beforeSheet, level }: Props) {
  const draft = useCharacter()
  const { sheet: after, deps, loading } = useDerivedSheet()
  const confirmLevelUp = useCharacterStore((s) => s.confirmLevelUp)
  const setView = useCharacterStore((s) => s.setView)
  const pickOption = usePickClassOption()
  const [hpPick, setHpPick] = useState<LevelHitDie | null>(null)

  const steps = useMemo(
    () => (draft ? levelUpSteps(before, draft, level, deps) : null),
    [before, draft, level, deps],
  )
  // The scope stays the same object while the step does, as SpellsSection asks.
  const spellStep = steps?.spells
  const scopeKey = spellStep ? JSON.stringify(spellStep) : ''
  const spellScope = useMemo<SpellsScope | null>(() => {
    if (!scopeKey) return null
    const step = JSON.parse(scopeKey) as NonNullable<typeof spellStep>
    return { classKeys: step.classKey ? [step.classKey] : [], grantIds: step.grantIds }
  }, [scopeKey])
  if (!draft || !after || !steps || loading) {
    return (
      <div className="text-body-secondary mb-2">
        <Spinner size="sm" animation="border" className="me-2" />
        Loading...
      </div>
    )
  }

  const row = draft.classes[level.classIndex]
  const key = `${row.name}|${row.source}`
  const loaded = deps.classByKey.get(key)
  const countOf = (id: string) =>
    after.checklist.items.find((item) => item.id === id)?.count ?? 0
  const openOf = (...ids: string[]) =>
    after.checklist.items.filter((item) => ids.includes(item.id))
  const optionCards = after.classOptions.filter((c) => steps.options.includes(c.tag))
  const optionsLeft = optionCards.reduce((n, c) => n + c.left, 0)
  // The class's earlier choices: some features let one be replaced on gaining a level.
  const earlierCards =
    level.from > 0
      ? after.classOptions.filter(
          (c) => c.tag.startsWith(`class:${key}|`) && !steps.options.includes(c.tag),
        )
      : []
  const gained: ResolvedFeature[] = steps.features.map((f) => ({
    name: f.kind === 'Class' ? f.name : `${f.name} (${f.from})`,
    level: f.level ?? level.to,
    entries: f.entries,
  }))

  const opened = openedChoices(beforeSheet.checklist.items, after.checklist.items)
  const open = [
    ...(level.die?.rolled && !hpPick ? ['Hit die not rolled: the average is taken'] : []),
    ...opened.map((item) => item.label),
  ]
  const rows = summaryRows(
    { character: before, sheet: beforeSheet },
    { character: draft, sheet: after },
  )
  const spells = spellChanges(before, draft)

  const confirm = () => {
    const hitDie = level.die?.rolled
      ? (hpPick ?? {
          die: `d${level.die.faces}`,
          value: draft.hp.rolls[level.die.index],
          by: 'average' as const,
        })
      : undefined
    confirmLevelUp(levelUpPatch(before, draft), {
      type: 'level-up',
      class: key,
      from: level.from,
      to: level.to,
      ...(hitDie ? { hitDie } : {}),
    })
  }

  return (
    <>
      <HitPointsStep
        before={beforeSheet.hp}
        after={after.hp}
        die={level.die}
        pick={hpPick}
        onPick={setHpPick}
      />

      {steps.subclass && (
        <StepCard
          title={loaded?.entry.subclassTitle ?? 'Subclass'}
          subtitle={row.subclass ? row.subclass.name : `Choose your ${row.name} subclass`}
          done={countOf('subclass') === 0}
          openText="choose a subclass"
        >
          <SubclassStep classIndex={level.classIndex} />
        </StepCard>
      )}

      {steps.featSlots.length > 0 && (
        <StepCard
          title="Ability score improvement or feat"
          done={countOf('feats') === 0}
          openText="choose an ability score improvement or a feat"
        >
          <FeatSlots only={steps.featSlots} />
        </StepCard>
      )}

      {steps.spells && spellScope && (
        <StepCard
          title="Spells"
          subtitle={steps.spells.swap ? SWAP_TEXT : undefined}
          done={countOf('spells') + countOf('spell-grants') === 0}
          openText={openOf('spells', 'spell-grants')
            .map((item) => item.label)
            .join('; ')}
        >
          <SpellsSection scope={spellScope} />
        </StepCard>
      )}

      {(optionCards.length > 0 || earlierCards.length > 0) && (
        <StepCard
          title="Class options"
          subtitle={
            optionCards.length > 0
              ? 'What the level adds to choose from.'
              : 'Nothing new to choose; your earlier choices are below.'
          }
          done={optionCards.length > 0 ? optionsLeft === 0 : undefined}
          openText={`${optionsLeft} to choose`}
        >
          <OptionCards cards={optionCards} onPick={pickOption} />
          {earlierCards.length > 0 && (
            <>
              <h3 className="h6 mt-2">Replace an earlier choice</h3>
              <p className="small text-body-secondary mb-2">
                Some features let you replace one choice when you gain a level in the
                class (an invocation, a maneuver, a metamagic option): the feature's text
                says so. Remove the old choice and choose the new one.
              </p>
              <OptionCards cards={earlierCards} onPick={pickOption} />
            </>
          )}
        </StepCard>
      )}

      <StepCard
        title="What you gain"
        subtitle={`${gained.length} new ${gained.length === 1 ? 'feature' : 'features'}`}
      >
        {gained.length > 0 ? (
          <FeatureAccordion features={gained} />
        ) : (
          <div className="text-body-secondary mb-2">No new features at this level.</div>
        )}
        {loaded && (
          <div className="mt-3">
            <ClassLevelTable
              groups={loaded.entry.classTableGroups}
              features={resolveClassFeatures(loaded)}
              level={row.level}
              label={`${row.name} level table`}
            />
          </div>
        )}
      </StepCard>

      <StepCard title="Summary" done={open.length === 0} openText={open.join('; ')}>
        {open.length > 0 && (
          <Alert variant="warning" className="py-2">
            <div className="fw-semibold">Still open</div>
            <ul className="mb-0 ps-3">
              {open.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
            <div className="small mt-1">
              You can confirm now and choose these later in Edit.
            </div>
          </Alert>
        )}
        <Table size="sm" className="mb-2 align-middle" aria-label="Before and after">
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const changed = r.before !== r.after
              return (
                <tr key={r.label}>
                  <th scope="row" className="fw-normal">
                    <AbbrText text={r.label} />
                  </th>
                  <td>{r.before}</td>
                  <td className={changed ? 'fw-bold' : undefined}>{r.after}</td>
                </tr>
              )
            })}
            <tr>
              <th scope="row" className="fw-normal">
                Features added
              </th>
              <td>{NO_VALUE}</td>
              <td className={gained.length > 0 ? 'fw-bold' : undefined}>
                {gained.map((f) => f.name).join(', ') || 'None'}
              </td>
            </tr>
            {(spells.added.length > 0 || spells.removed.length > 0) && (
              <tr>
                <th scope="row" className="fw-normal">
                  Spells
                </th>
                <td>{NO_VALUE}</td>
                <td className="fw-bold">
                  {[
                    spells.added.length > 0 ? `Added: ${spells.added.join(', ')}` : '',
                    spells.removed.length > 0
                      ? `Removed: ${spells.removed.join(', ')}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join('. ')}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
        <div className="d-flex flex-wrap gap-2">
          <Button onClick={confirm}>
            {open.length > 0 ? 'Confirm anyway' : 'Confirm level up'}
          </Button>
          <Button variant="secondary" onClick={() => setView('sheet')}>
            Cancel
          </Button>
        </div>
      </StepCard>
    </>
  )
}
