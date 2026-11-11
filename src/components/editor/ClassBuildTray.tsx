// The character's actual class build.
// This is the editor half of the merged Class & Level section: the reference
// table below adds classes to the build, and this tray shows what has been added
// and lets each entry's level and subclass be tuned inline. Classes are added
// from the table (there is no class dropdown here), so an empty build shows a
// prompt pointing at the table.
//
// Subclass timing: a subclass can be chosen (planned) at any level. Below the
// class's unlock level it is kept but shown as "unlocks at level N"; its features
// are level-gated elsewhere so nothing applies early.

import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Stack from 'react-bootstrap/Stack'
import { hitDieLabel, subclassesFor, type LoadedClass } from '../../data/class'
import { Icon } from '../Icon'
import { NonStandardBadge } from '../NonStandardBadge'
import { classKey, subclassUnlockLevel, type ClassBuild } from './useClassBuild'

interface Props {
  build: ClassBuild
  selectedBooks: string[]
}

export function ClassBuildTray({ build, selectedBooks }: Props) {
  const { classes, byKey, totalLevel, deviationByKey, levelDeviations } = build

  if (classes.length === 0) {
    return (
      <div className="border rounded p-3 mb-3 text-body-secondary small">
        No classes yet. Add one from the reference table below to start your build.
      </div>
    )
  }

  return (
    <div className="mb-3">
      <div className="d-flex align-items-center gap-2 mb-2">
        <span className="fw-semibold">Your build</span>
        <Badge bg="secondary">Level {totalLevel}</Badge>
        {levelDeviations.map((d) => (
          <NonStandardBadge key={d.id} reason={d.message} />
        ))}
      </div>

      <Stack gap={2}>
        {classes.map((cls, index) => {
          const loadedClass = byKey.get(classKey(cls.name, cls.source))
          return (
            <BuildEntry
              key={`${classKey(cls.name, cls.source)}-${index}`}
              index={index}
              name={cls.name}
              level={cls.level}
              subclassValue={
                cls.subclass ? `${cls.subclass.shortName}|${cls.subclass.source}` : ''
              }
              loadedClass={loadedClass}
              selectedBooks={selectedBooks}
              deviation={deviationByKey.get(
                `multiclass-req:${classKey(cls.name, cls.source)}`,
              )}
              onLevel={(lvl) => build.setLevel(index, lvl)}
              onSubclass={(value) => build.setSubclass(index, value)}
              onRemove={() => build.removeEntry(index)}
            />
          )
        })}
      </Stack>
    </div>
  )
}

function BuildEntry({
  index,
  name,
  level,
  subclassValue,
  loadedClass,
  selectedBooks,
  deviation,
  onLevel,
  onSubclass,
  onRemove,
}: {
  index: number
  name: string
  level: number
  subclassValue: string
  loadedClass: LoadedClass | undefined
  selectedBooks: string[]
  deviation: { message: string } | undefined
  onLevel: (level: number) => void
  onSubclass: (value: string) => void
  onRemove: () => void
}) {
  const entry = loadedClass?.entry
  const subclasses = loadedClass
    ? subclassesFor(loadedClass).filter((s) => selectedBooks.includes(s.source))
    : []
  const unlockLevel = loadedClass ? subclassUnlockLevel(loadedClass) : 1
  // A subclass may be planned below its unlock level, so the picker stays
  // enabled; the indicator tells the player when it actually takes effect.
  const notYetUnlocked = !!loadedClass && (level || 0) < unlockLevel
  const label = index === 0 ? name : `${name} (multiclass)`

  return (
    <div className="border rounded p-3">
      <div className="row g-2 align-items-end">
        <div className="col-sm-5">
          <Form.Label className="small mb-1 fw-semibold">{label}</Form.Label>
          <div className="small text-body-secondary">
            {entry ? `${entry.source} · ${entry.subclassTitle ?? 'Subclass'}` : name}
          </div>
        </div>
        <div className="col-sm-2">
          <Form.Label className="small mb-1">Level</Form.Label>
          <Form.Control
            type="number"
            min={1}
            value={level}
            onChange={(e) => onLevel(Number(e.target.value))}
            aria-label={`Level for ${name}`}
          />
        </div>
        <div className="col-sm-4">
          <Form.Label className="small mb-1">
            {entry?.subclassTitle ?? 'Subclass'}
          </Form.Label>
          <Form.Select
            value={subclassValue}
            onChange={(e) => onSubclass(e.target.value)}
            disabled={!loadedClass || subclasses.length === 0}
            aria-label={`Subclass for ${name}`}
          >
            <option value="">{subclasses.length === 0 ? '-' : 'Choose…'}</option>
            {subclasses.map((s) => (
              <option
                key={`${s.shortName}|${s.source}`}
                value={`${s.shortName}|${s.source}`}
              >
                {s.name} ({s.source})
              </option>
            ))}
          </Form.Select>
        </div>
        <div className="col-sm-1 d-flex justify-content-end">
          <Button
            variant="danger"
            size="sm"
            onClick={onRemove}
            aria-label={`Remove ${name}`}
          >
            <Icon name="remove" />
          </Button>
        </div>
      </div>

      <div className="small text-body-secondary mt-2 d-flex flex-wrap gap-3 align-items-center">
        {entry && (
          <span>
            Hit Die: <strong>{hitDieLabel(entry)}</strong>
          </span>
        )}
        {entry?.proficiency && (
          <span>Saves: {entry.proficiency.map((p) => p.toUpperCase()).join(', ')}</span>
        )}
        {entry?.spellcastingAbility && (
          <span>Spellcasting: {entry.spellcastingAbility.toUpperCase()}</span>
        )}
        {subclassValue && notYetUnlocked && (
          <Badge bg="warning" text="dark">
            Subclass unlocks at level {unlockLevel}
          </Badge>
        )}
        {deviation && <NonStandardBadge reason={deviation.message} />}
      </div>
    </div>
  )
}
