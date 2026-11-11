import { useMemo } from 'react'
import Accordion from 'react-bootstrap/Accordion'
import Badge from 'react-bootstrap/Badge'
import Card from 'react-bootstrap/Card'
import {
  featuresForClass,
  loadClasses,
  resolveClassFeatures,
  resolveSubclassFeatures,
  subclassesFor,
  type LoadedClass,
} from '../../data/class'
import type { ClassRef } from '../../character/model'
import { useActiveCharacter } from '../../character/store'
import { useAsyncData } from '../../hooks/useAsyncData'
import { Entries } from '../../text/Entries'
import { ClassLevelTable } from './ClassLevelTable'
import { editionLabel } from './classRows'
import { TRAIL_ATTRIBUTE } from './sectionTrail'
import { SubSection } from './SubSection'

const classKey = (name: string, source: string) => `${name}|${source}`

function ClassFeaturesCard({ loaded, cls }: { loaded: LoadedClass; cls: ClassRef }) {
  const features = featuresForClass(loaded, cls)
  const subclass = cls.subclass
    ? subclassesFor(loaded).find(
        (s) =>
          s.shortName === cls.subclass?.shortName && s.source === cls.subclass.source,
      )
    : undefined
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
        {features.length === 0 ? (
          <div className="text-body-secondary">No features at this level.</div>
        ) : (
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
  const character = useActiveCharacter()
  const { data: loaded } = useAsyncData(loadClasses)

  const byKey = useMemo(() => {
    const m = new Map<string, LoadedClass>()
    for (const l of loaded ?? []) m.set(classKey(l.entry.name, l.entry.source), l)
    return m
  }, [loaded])

  if (!character) return null
  const chosen = character.classes.filter((c) => c.name)
  if (chosen.length === 0) return null

  return (
    <SubSection
      title="Class Features"
      subtitle="Features gained by level, including your subclass."
    >
      {chosen.map((cls, i) => {
        const loadedClass = byKey.get(classKey(cls.name, cls.source))
        if (!loadedClass) return null
        return <ClassFeaturesCard key={i} loaded={loadedClass} cls={cls} />
      })}
    </SubSection>
  )
}
