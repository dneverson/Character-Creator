// How a class/subclass row is described: its name, its Basics, and its features
// level by level. The class table hands this one description to the shared browse
// table, which draws both the detail pane (one entry) and the Compare window (a
// column per entry) from it - so both always say the same thing about an entry.

import Badge from 'react-bootstrap/Badge'
import {
  hitDieLabel,
  resolveClassFeatures,
  resolveSubclassFeatures,
  subclassUnlockLevel,
  type ResolvedFeature,
} from '../../data/class'
import type { Describe, Fact } from '../table/facts'
import {
  castingWithAbility,
  rowEdition,
  rowKey,
  rowSource,
  upper,
  type ClassRow,
} from './classRows'
import { FeatureCell } from './FeatureCell'

// One entry's title: "Fighter" for a base class, "Fighter (Champion)" for a
// subclass. Heads the Compare column and the detail pane alike.
export const colTitle = (r: ClassRow) =>
  r.subclass ? `${r.loaded.entry.name} (${r.subclass.name})` : r.loaded.entry.name

// The edition year rides with the name so a 2014 and a 2024 column stay
// identifiable after scrolling past the Edition row.
export const classTags = (r: ClassRow) => [rowEdition(r)]

// Flatten a level-indexed feature map into a single level-ordered list.
export function orderedFeatures(
  byLevel: Map<number, ResolvedFeature[]>,
): ResolvedFeature[] {
  const out: ResolvedFeature[] = []
  for (let level = 1; level <= 20; level++) {
    for (const f of byLevel.get(level) ?? []) out.push(f)
  }
  return out
}

// The Basics of a class/subclass row. Declarative so adding an attribute stays a
// one-line change.
export const attributes: Fact<ClassRow>[] = [
  {
    key: 'type',
    label: 'Type',
    text: (r) => (r.subclass ? 'Subclass' : 'Class'),
    render: (r) => (
      <Badge bg={r.subclass ? 'info' : 'secondary'}>
        {r.subclass ? 'Subclass' : 'Class'}
      </Badge>
    ),
  },
  { key: 'base', label: 'Base class', text: (r) => r.loaded.entry.name },
  { key: 'hd', label: 'Hit Die', text: (r) => hitDieLabel(r.loaded.entry) },
  {
    key: 'saves',
    label: 'Saving Throws',
    text: (r) => upper(r.loaded.entry.proficiency) || 'None',
  },
  { key: 'casting', label: 'Spellcasting', text: (r) => castingWithAbility(r.loaded) },
  { key: 'source', label: 'Source', text: (r) => rowSource(r) },
  { key: 'edition', label: 'Edition', text: (r) => rowEdition(r) },
  {
    key: 'subclassAt',
    label: 'Subclass chosen at',
    text: (r) => `Level ${subclassUnlockLevel(r.loaded)}`,
  },
]

// The features a row's subclass grants, in level order (none for a bare class).
const subclassFeatures = (r: ClassRow) =>
  r.subclass ? orderedFeatures(resolveSubclassFeatures(r.loaded.file, r.subclass)) : []

// The features a row's class grants. The empty "Subclass Feature" placeholder
// slots are dropped since the real subclass features have their own group.
const classFeatures = (r: ClassRow) =>
  orderedFeatures(resolveClassFeatures(r.loaded)).filter((f) => !f.isSubclassSlot)

// Features as one fact per level that ANY row gains something at, so the same
// level always sits on the same line and a row with nothing at that level is
// simply blank. The features are resolved once per row.
function levelFacts(
  rows: ClassRow[],
  featuresOf: (r: ClassRow) => ResolvedFeature[],
): Fact<ClassRow>[] {
  const resolved = new Map(rows.map((r) => [rowKey(r), featuresOf(r)]))
  const at = (r: ClassRow, level: number) =>
    (resolved.get(rowKey(r)) ?? []).filter((f) => f.level === level)
  const levels = new Set<number>()
  for (const features of resolved.values()) for (const f of features) levels.add(f.level)
  return [...levels]
    .sort((a, b) => a - b)
    .map((level) => ({
      key: `level-${level}`,
      label: <span className="text-nowrap">Lv {level}</span>,
      // Name plus full text, order-sensitive, so identical grants are detected.
      text: (r) => {
        const features = at(r, level)
        return features.length
          ? JSON.stringify(features.map((f) => [f.name, f.entries]))
          : ''
      },
      render: (r) => <FeatureCell features={at(r, level)} />,
    }))
}

// A subclass row leads with its own features, then the base class's.
export const describeClasses: Describe<ClassRow> = (rows) => [
  { key: 'basics', title: 'Basics', facts: attributes },
  ...(rows.some((r) => r.subclass)
    ? [
        {
          key: 'subclass',
          entryTitle: (r: ClassRow) => (r.subclass ? `${r.subclass.name} features` : ''),
          facts: levelFacts(rows, subclassFeatures),
          empty: 'No subclass features found.',
        },
      ]
    : []),
  {
    key: 'class',
    entryTitle: (r) => `${r.loaded.entry.name} class features`,
    facts: levelFacts(rows, classFeatures),
    empty: 'No class features found.',
  },
]
