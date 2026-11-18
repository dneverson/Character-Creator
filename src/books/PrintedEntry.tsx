// A creature, a spell or an item of a book as the printed page sets it. It is the book
// presentation of the very same entry the lookup describes (the Beast, Spell and Item of
// the loaded content), so there is no second copy of any stat: the lookup's own detail
// pane is not touched. A kind without a printed layout here is left to the caller.

import { Fragment, type ReactNode } from 'react'
import { Abbr, AbbrText } from '../components/Abbr'
import { classNames } from '../data/spells'
import { describeLookup } from '../components/lookup/lookupFacts'
import { factValue } from '../components/table/facts'
import { type Beast, type BeastEntry } from '../data/beasts'
import { type Item, rarityLabel } from '../data/items'
import { sizeLabel, speedLabel } from '../data/labels'
import { ordinal } from '../data/spellText'
import { schoolName, type Spell } from '../data/spells'
import { ABILITIES, abilityMod, formatMod } from '../dice/dice'
import type { LookupRow } from '../lookup/types'
import { proficiencyForCr, xpForCr } from '../rules/challenge'
import { Entries, type Entry } from '../text/Entries'
import { titleCase } from '../text/titleCase'

const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** "Label value" on a line of a printed block: the label in bold. */
function Line({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <p className="printed__line">
      <strong className="printed__label">{label}</strong> {children}
    </p>
  )
}

const Rule = () => <hr className="printed__rule" />

function Name({ name }: { name: string }) {
  return <h5 className="printed__name">{name}</h5>
}

// ---- Creature ---------------------------------------------------------------

/** The line under the name: "Large aberration, lawful evil" (2014), capitalized in 2024. */
function kindLine(beast: Beast, later: boolean): string {
  const tags = beast.tags.length > 0 ? ` (${beast.tags.join(', ')})` : ''
  const swarmSize = beast.swarmSize ? sizeLabel([beast.swarmSize]) : ''
  const what = beast.swarm
    ? `swarm of ${swarmSize} ${beast.type}s`
    : `${beast.type}${tags}`
  const alignment = beast.alignment ? `, ${beast.alignment}` : ''
  const text = `${what}${alignment}`
  return `${sizeLabel(beast.size)} ${later ? titleCase(text) : text}`.trim()
}

function modeText(beast: Beast, later: boolean): string {
  const text = speedLabel(beast.speed)
  return later ? text.split(', ').map(upper).join(', ') : text
}

const signed = (text: string | undefined, fallback: number) => text ?? formatMod(fallback)

function AbilityTable({ beast, later }: { beast: Beast; later: boolean }) {
  const mod = (key: (typeof ABILITIES)[number]) => abilityMod(beast.abilities[key])
  const head = (key: string) => (
    <Abbr code={key.toUpperCase()} kind="ability" className="printed__ability" />
  )
  if (!later)
    return (
      <table className="printed__abilities">
        <thead>
          <tr>
            {ABILITIES.map((key) => (
              <th key={key} scope="col">
                {head(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {ABILITIES.map((key) => (
              <td key={key}>
                {beast.abilities[key]} ({formatMod(mod(key))})
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    )
  const rows = [ABILITIES.slice(0, 3), ABILITIES.slice(3)]
  return (
    <table className="printed__abilities is-split">
      <colgroup>
        {rows[0].map((key) => (
          <Fragment key={key}>
            <col className="is-name" />
            <col className="is-score" />
            <col className="is-mod" />
            <col className="is-save" />
          </Fragment>
        ))}
      </colgroup>
      <thead>
        <tr>
          {rows[0].map((key) => (
            <Fragment key={key}>
              <td colSpan={2} />
              <th scope="col">Mod</th>
              <th scope="col">Save</th>
            </Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((key) => (
              <Fragment key={key}>
                <th scope="row">{head(key)}</th>
                <td>{beast.abilities[key]}</td>
                <td>{formatMod(mod(key))}</td>
                <td>{signed(beast.saves[key], mod(key))}</td>
              </Fragment>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The challenge line: the rating, its experience points and the proficiency bonus. */
function Challenge({ beast, later }: { beast: Beast; later: boolean }) {
  const xp = beast.xp ?? xpForCr(beast.crValue)
  const bonus = formatMod(proficiencyForCr(beast.crValue))
  const points = (n: number) => n.toLocaleString('en-US')
  const lair = beast.xpLair === undefined ? '' : `, or ${points(beast.xpLair)} in lair`
  if (later)
    return (
      <Line label={<Abbr code="CR" kind="stat" />}>
        {beast.cr}
        {xp !== undefined && (
          <>
            {' '}
            (<Abbr code="XP" kind="stat" /> {points(xp)}
            {lair}; <Abbr code="PB" kind="stat" /> {bonus})
          </>
        )}
      </Line>
    )
  return (
    <p className="printed__line printed__challenge">
      <span>
        <strong className="printed__label">Challenge</strong> {beast.cr}
        {xp !== undefined && (
          <>
            {' '}
            ({points(xp)} <Abbr code="XP" kind="stat" />
            {lair})
          </>
        )}
      </span>
      <span>
        <strong className="printed__label">Proficiency Bonus</strong> {bonus}
      </span>
    </p>
  )
}

/** A list of named entries under its printed heading, led by the creature's own sentence. */
function Section({ title, list }: { title: string; list: BeastEntry[] }) {
  if (list.length === 0) return null
  const [first, ...rest] = list
  const intro = first.name === title
  const entries: Entry[] = [
    ...(intro ? first.entries : []),
    ...(intro ? rest : list).map((e): Entry => ({
      type: 'entries',
      name: e.name,
      entries: e.entries,
    })),
  ]
  return (
    <>
      <h6 className="printed__section">{title}</h6>
      <Entries entries={entries} />
    </>
  )
}

function PrintedCreature({
  beast,
  name,
  headed,
}: {
  beast: Beast
  name: string
  headed: boolean
}) {
  const later = beast.edition === 'one'
  const defenses: [string, string][] = later
    ? [
        ['Vulnerabilities', beast.vulnerable],
        ['Resistances', beast.resist],
        ['Immunities', [beast.immune, beast.conditionImmune].filter(Boolean).join('; ')],
      ]
    : [
        ['Damage Vulnerabilities', beast.vulnerable],
        ['Damage Resistances', beast.resist],
        ['Damage Immunities', beast.immune],
        ['Condition Immunities', beast.conditionImmune],
      ]
  const saves = Object.entries(beast.saves)
  const skills = Object.entries(beast.skills)
  const perception =
    beast.passive > 0
      ? `${later ? 'Passive' : 'passive'} Perception ${beast.passive}`
      : ''
  const senses = [beast.senses.join(', '), perception].filter(Boolean)
  const hit =
    beast.hp > 0
      ? `${beast.hp}${beast.hpFormula ? ` (${beast.hpFormula})` : ''}`
      : (beast.hpSpecial ?? '')
  const armor =
    beast.ac > 0 ? `${beast.ac}${beast.acFrom ? ` (${beast.acFrom})` : ''}` : ''
  return (
    <div className={`printed printed-creature${later ? ' is-2024' : ''}`}>
      {!headed && <Name name={name} />}
      <p className="printed__kind">
        <em>{kindLine(beast, later)}</em>
      </p>
      <Rule />
      {later ? (
        <p className="printed__line printed__challenge">
          <span>
            <strong className="printed__label">
              <Abbr code="AC" kind="stat" />
            </strong>{' '}
            {armor}
          </span>
          {beast.initiative !== undefined && (
            <span>
              <strong className="printed__label">Initiative</strong>{' '}
              {formatMod(beast.initiative)} ({10 + beast.initiative})
            </span>
          )}
        </p>
      ) : (
        <Line label="Armor Class">{armor}</Line>
      )}
      <Line label={later ? <Abbr code="HP" kind="stat" /> : 'Hit Points'}>{hit}</Line>
      <Line label="Speed">{modeText(beast, later)}</Line>
      <Rule />
      <AbilityTable beast={beast} later={later} />
      <Rule />
      {!later && saves.length > 0 && (
        <Line label="Saving Throws">
          {saves.map(([key, bonus], i) => (
            <Fragment key={key}>
              {i > 0 && ', '}
              <Abbr code={key.toUpperCase()} kind="ability" /> {bonus}
            </Fragment>
          ))}
        </Line>
      )}
      {skills.length > 0 && (
        <Line label="Skills">
          {skills.map(([skill, bonus]) => `${titleCase(skill)} ${bonus}`).join(', ')}
        </Line>
      )}
      {defenses.map(([label, text]) =>
        text ? (
          <Line key={label} label={label}>
            {upper(text)}
          </Line>
        ) : null,
      )}
      {senses.length > 0 && (
        <Line label="Senses">{senses.join(later ? '; ' : ', ')}</Line>
      )}
      <Line label="Languages">
        {beast.languages.length > 0 ? beast.languages.join(', ') : later ? 'None' : '-'}
      </Line>
      {beast.hasCr && <Challenge beast={beast} later={later} />}
      <Rule />
      {later && beast.traits.length + beast.spellcasting.length > 0 && (
        <h6 className="printed__section">Traits</h6>
      )}
      <Entries
        entries={[...beast.traits, ...beast.spellcasting].map((e): Entry => ({
          type: 'entries',
          name: e.name,
          entries: e.entries,
        }))}
      />
      <Section title="Actions" list={beast.actions} />
      <Section title="Bonus Actions" list={beast.bonusActions} />
      <Section title="Reactions" list={beast.reactions} />
      <Section title="Legendary Actions" list={beast.legendary} />
      <Section title="Mythic Actions" list={beast.mythic} />
      {beast.lair.map((part) => (
        <Section key={part.name} title={part.name} list={[part]} />
      ))}
    </div>
  )
}

// ---- Spell ------------------------------------------------------------------

/** 2014: "3rd-level evocation (ritual)". 2024: "Level 3 Evocation (Sorcerer, Wizard)". */
function spellLine(spell: Spell, classes: string[]): string {
  const school = schoolName(spell.school)
  if (spell.edition === 'one') {
    const kind =
      spell.level === 0 ? `${school} Cantrip` : `Level ${spell.level} ${school}`
    return classes.length > 0 ? `${kind} (${classes.join(', ')})` : kind
  }
  const kind =
    spell.level === 0
      ? `${school} cantrip`
      : `${ordinal(spell.level)}-level ${school.toLowerCase()}`
  return spell.ritual ? `${kind} (ritual)` : kind
}

function PrintedSpell({
  spell,
  name,
  headed,
}: {
  spell: Spell
  name: string
  headed: boolean
}) {
  const { v, s, m } = spell.components
  const letters = [v && 'V', s && 'S', m && 'M'].filter(Boolean).join(', ')
  const components = m && spell.material ? `${letters} (${spell.material.text})` : letters
  return (
    <div className="printed printed-spell">
      {!headed && <Name name={name} />}
      <p className="printed__kind">
        <em>{spellLine(spell, classNames(spell))}</em>
      </p>
      <Line label="Casting Time:">{spell.casting}</Line>
      <Line label="Range:">{spell.range}</Line>
      <Line label="Components:">
        <AbbrText text={components} kind="component" />
      </Line>
      <Line label="Duration:">{spell.duration}</Line>
      <Entries entries={[...spell.entries, ...(spell.entriesHigherLevel ?? [])]} />
    </div>
  )
}

// ---- Item -------------------------------------------------------------------

/** The facts of a plain item the books print as lines (cost, weight, damage, armor...). */
const MUNDANE_LINES = [
  'cost',
  'weight',
  'damage',
  'damageType',
  'range',
  'properties',
  'ac',
  'strength',
  'stealth',
]

function itemLine(item: Item): string {
  const attune = item.attunement
  const needs = attune?.required
    ? ` (requires attunement${attune.text ? ` ${attune.text}` : ''})`
    : attune?.optional
      ? ' (optional attunement)'
      : ''
  const rarity = item.rarity && item.rarity !== 'none' ? rarityLabel(item.rarity) : ''
  return `${[item.category ?? '', rarity.toLowerCase()].filter(Boolean).join(', ')}${needs}`
}

function PrintedItem({
  item,
  row,
  name,
  headed,
}: {
  item: Item
  row: LookupRow
  name: string
  headed: boolean
}) {
  const facts = item.magic
    ? []
    : describeLookup([row])
        .flatMap((group) => group.facts)
        .filter((fact) => MUNDANE_LINES.includes(fact.key))
  return (
    <div className="printed printed-item">
      {!headed && <Name name={name} />}
      {itemLine(item) && (
        <p className="printed__kind">
          <em>{itemLine(item)}</em>
        </p>
      )}
      {facts.map((fact) => {
        const value = factValue(fact, row)
        return value === null ? null : (
          <Line key={fact.key} label={`${fact.label}:`}>
            {value}
          </Line>
        )
      })}
      <Entries entries={item.entries} />
    </div>
  )
}

/**
 * The printed layout of a looked-up entry, or null for a kind that has none here.
 * `name`: what the block is called (the book may rename it). `headed`: the book's own heading with this name stands right above, so the name is not
 * printed again.
 */
export function PrintedEntry({
  row,
  name,
  headed,
}: {
  row: LookupRow
  name: string
  headed: boolean
}): ReactNode {
  const subject = row.subject
  if (subject.type === 'creature')
    return <PrintedCreature beast={subject.value} name={name} headed={headed} />
  if (subject.type === 'spell')
    return <PrintedSpell spell={subject.value} name={name} headed={headed} />
  if (subject.type === 'item')
    return <PrintedItem item={subject.value} row={row} name={name} headed={headed} />
  return null
}
