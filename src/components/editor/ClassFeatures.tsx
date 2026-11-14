import { useMemo } from 'react'
import Accordion from 'react-bootstrap/Accordion'
import Badge from 'react-bootstrap/Badge'
import Card from 'react-bootstrap/Card'
import {
  featuresForClass,
  loadClasses,
  resolveClassFeatures,
  resolveSubclassFeatures,
  subclassOf,
  type LoadedClass,
  type ResolvedFeature,
} from '../../data/class'
import type { ClassRef } from '../../character/model'
import type { PickCard as PickCardModel, PickChip } from '../../character/picks'
import { useCharacter } from '../../character/useCharacterDoc'
import { useAsyncData } from '../../hooks/useAsyncData'
import { Entries } from '../../text/Entries'
import { ClassLevelTable } from './ClassLevelTable'
import { isFightingStyleCard } from '../../derived/classOptions'
import { PickCard } from './PickCard'
import { useDerivedSheet } from './useDerivedSheet'
import { usePickClassOption } from './usePickClassOption'
import { editionLabel } from './classRows'
import { TRAIL_ATTRIBUTE } from './sectionTrail'
import { SubSection } from './SubSection'

const classKey = (name: string, source: string) => `${name}|${source}`

/** The option cards of one class, or of the feats, each with its table of options. */
export function OptionCards({
  cards,
  onPick,
}: {
  cards: PickCardModel[]
  onPick: (card: PickCardModel, chip: PickChip) => void
}) {
  if (cards.length === 0) return null
  return (
    <div className="d-flex flex-column gap-2 mb-3">
      {cards.map((card) => (
        <PickCard key={card.tag} card={card} onPick={(chip) => onPick(card, chip)} />
      ))}
    </div>
  )
}

/** Features by level, each opening its full text. */
export function FeatureAccordion({ features }: { features: ResolvedFeature[] }) {
  return (
    <Accordion alwaysOpen flush>
      {features.map((f, i) => (
        <Accordion.Item eventKey={String(i)} key={i}>
          <Accordion.Header>
            <span className="me-2 text-body-secondary">Lv {f.level}</span>
            {f.name}
            {f.isSubclassSlot && (
              <Badge bg="secondary" className="ms-2">
                choose subclass
              </Badge>
            )}
          </Accordion.Header>
          <Accordion.Body>
            {f.entries.length > 0 ? (
              <Entries entries={f.entries} />
            ) : (
              <span className="text-body-secondary">
                Select a subclass to see this feature.
              </span>
            )}
          </Accordion.Body>
        </Accordion.Item>
      ))}
    </Accordion>
  )
}

interface CardProps {
  loaded: LoadedClass
  cls: ClassRef
  options: PickCardModel[]
  onPick: (card: PickCardModel, chip: PickChip) => void
}

function ClassFeaturesCard({ loaded, cls, options, onPick }: CardProps) {
  const features = featuresForClass(loaded, cls)
  const subclass = subclassOf(loaded, cls.subclass)
  return (
    <Card className="mb-3" {...{ [TRAIL_ATTRIBUTE]: `${cls.name} ${cls.level}` }}>
      <Card.Header className="d-flex align-items-center gap-2">
        <strong>
          {cls.name} {cls.level}
        </strong>
        <Badge bg="secondary">{editionLabel(loaded)}</Badge>
        {cls.subclass && <Badge bg="info">{cls.subclass.name}</Badge>}
      </Card.Header>
      <Card.Body>
        <OptionCards cards={options} onPick={onPick} />
        {features.length === 0 ? (
          <div className="text-body-secondary">No features at this level.</div>
        ) : (
          <FeatureAccordion features={features} />
        )}

        <ClassLevelTable
          groups={loaded.entry.classTableGroups}
          features={resolveClassFeatures(loaded)}
          level={cls.level}
          label={`${cls.name} level table`}
        />
        {subclass?.subclassTableGroups && (
          <>
            <div className="mt-3 fw-semibold">{subclass.name}</div>
            <ClassLevelTable
              groups={subclass.subclassTableGroups}
              features={resolveSubclassFeatures(loaded.file, subclass)}
              level={cls.level}
              label={`${subclass.name} level table`}
            />
          </>
        )}
      </Card.Body>
    </Card>
  )
}

export function ClassFeatures() {
  const character = useCharacter()
  const pick = usePickClassOption()
  const { data: loaded } = useAsyncData(loadClasses)
  const { sheet } = useDerivedSheet()

  const byKey = useMemo(() => {
    const m = new Map<string, LoadedClass>()
    for (const l of loaded ?? []) m.set(classKey(l.entry.name, l.entry.source), l)
    return m
  }, [loaded])

  if (!character) return null
  const chosen = character.classes.filter((c) => c.name)
  if (chosen.length === 0) return null
  // The fighting styles are picked in Combat, where their rules apply.
  const cards = (sheet?.classOptions ?? []).filter((card) => !isFightingStyleCard(card))
  const ofClass = (cls: ClassRef) =>
    cards.filter((card) =>
      card.tag.startsWith(`class:${classKey(cls.name, cls.source)}|`),
    )
  const ofFeats = cards.filter((card) => card.kind === 'feat')

  return (
    <SubSection
      title="Class Features"
      subtitle="Features gained by level, including your subclass."
    >
      {chosen.map((cls, i) => {
        const loadedClass = byKey.get(classKey(cls.name, cls.source))
        if (!loadedClass) return null
        return (
          <ClassFeaturesCard
            key={i}
            loaded={loadedClass}
            cls={cls}
            options={ofClass(cls)}
            onPick={pick}
          />
        )
      })}
      {ofFeats.length > 0 && (
        <Card className="mb-3">
          <Card.Header>
            <strong>Options from feats</strong>
          </Card.Header>
          <Card.Body>
            <OptionCards cards={ofFeats} onPick={pick} />
          </Card.Body>
        </Card>
      )}
    </SubSection>
  )
}
