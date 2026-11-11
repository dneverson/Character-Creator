import { useMemo } from 'react'
import Accordion from 'react-bootstrap/Accordion'
import Badge from 'react-bootstrap/Badge'
import Card from 'react-bootstrap/Card'
import Table from 'react-bootstrap/Table'
import {
  featuresForClass,
  loadClasses,
  type ClassTableGroup,
  type LoadedClass,
} from '../../data/class'
import type { ClassRef } from '../../character/model'
import { useActiveCharacter } from '../../character/store'
import { useAsyncData } from '../../hooks/useAsyncData'
import { Entries, type Entry } from '../../text/Entries'
import { stripTags } from '../../text/tags'
import { SubSection } from './SubSection'

const classKey = (name: string, source: string) => `${name}|${source}`

function tableCell(cell: Entry): string {
  if (typeof cell === 'string' || typeof cell === 'number') return stripTags(String(cell))
  const obj = cell as {
    type?: string
    value?: number
    toRoll?: { number: number; faces: number }[]
  }
  if (obj.type === 'bonus') return `+${obj.value}`
  if (obj.type === 'bonusSpeed') return `+${obj.value} ft.`
  if (obj.type === 'dice' && obj.toRoll?.[0]) {
    return `${obj.toRoll[0].number}d${obj.toRoll[0].faces}`
  }
  return ''
}

function ClassTable({ group, maxLevel }: { group: ClassTableGroup; maxLevel: number }) {
  // Spell-slot tables carry their rows under `rowsSpellProgression`.
  const source = group.rows ?? group.rowsSpellProgression ?? []
  const rows = source.slice(0, maxLevel)
  if (rows.length === 0) return null
  return (
    <div className="table-responsive mt-3">
      <Table size="sm" bordered hover className="mb-0">
        <thead>
          <tr>
            <th>Level</th>
            {group.colLabels?.map((c, i) => (
              <th key={i}>{stripTags(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              {row.map((cell, ci) => (
                <td key={ci}>{tableCell(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

function ClassFeaturesCard({ loaded, cls }: { loaded: LoadedClass; cls: ClassRef }) {
  const features = featuresForClass(loaded, cls)
  return (
    <Card className="mb-3">
      <Card.Header className="d-flex align-items-center gap-2">
        <strong>
          {cls.name} {cls.level}
        </strong>
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

        {loaded.entry.classTableGroups?.map((group, i) => (
          <ClassTable key={i} group={group} maxLevel={cls.level} />
        ))}
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
