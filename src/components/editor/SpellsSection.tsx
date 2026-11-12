// Spells: one card per spellcasting class (a casting subclass counts as one), each
// with the tiers its kind of caster chooses in - cantrips, spells known or
// prepared, and for a spellbook caster the book and what is prepared from it. Every
// tier is a chooser over the same table of spells with all their stats, its limit
// always beside it ("Cantrips 3 of 4"). A spell the class cannot have (off its list,
// above its level, from the other edition) is greyed with the reason and can be
// chosen only when the section's switch allows it; it is then flagged, never
// blocked. One table is open at a time; a chosen tier folds to a short table of the
// picks, each with its Remove. What the class always gives (a domain's spells) heads
// the tier it belongs to and costs no pick; what a species, feat or background gives
// is its own card below the classes.

import { useMemo, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Spinner from 'react-bootstrap/Spinner'
import Tooltip from 'react-bootstrap/Tooltip'
import { isOnClassList, loadSpells, spellLevelLabel, type Spell } from '../../data/spells'
import { matchesFilter } from '../../data/grants'
import { editionYear } from '../../data/labels'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import { characterCasters } from '../../character/spellcasting'
import {
  classMaxSpellLevel,
  spellbookFreeCount,
  spellSlots,
  usesSpellbook,
  type ClassCaster,
} from '../../rules/spellcasting'
import type {
  Character,
  ClassSpellSelection,
  GrantedSpellChoice,
  SpellRef,
} from '../../character/model'
import {
  grantedSpell,
  resolveSpellGrants,
  spellsByName,
  type SpellGrant,
} from '../../character/spellGrants'
import { refKey, refOf, without, withRef } from '../../character/spellRefs'
import { useAsyncData } from '../../hooks/useAsyncData'
import { Abbr } from '../Abbr'
import { EditorSection } from './EditorSection'
import { NotInBooksAlert } from './NotInBooksAlert'
import { GrantedSpells } from './GrantedSpells'
import { pickTierId } from './grantedCast'
import { SpellPicker } from './SpellPicker'
import { YourSpells } from './YourSpells'
import { useFeatSummary } from './useFeatSummary'

const EMPTY_SELECTION: ClassSpellSelection = { cantrips: [], spells: [] }

// ---- Tiers ------------------------------------------------------------------

type TierKind = 'cantrips' | 'spells' | 'book' | 'prepared'

/** One table a class chooses in, and how full it is. */
interface TierSpec {
  id: string
  kind: TierKind
  /** What is chosen, plural, lower case: it heads the count. */
  noun: string
  count: number
  /** The most the rules allow, when they state one. */
  max?: number
  /** How many picks make the tier done: the cap, else something chosen. */
  target: number
}

/** Spells a class always has, by where they are shown: the cantrip tier, or the spell tier. */
interface Hosted {
  cantrips: number
  leveled: number
}
const NOTHING_HOSTED: Hosted = { cantrips: 0, leveled: 0 }

/** The tiers of a caster, in the order they are chosen. A tier with no room is left out. */
function tiersOf(
  caster: ClassCaster,
  selection: ClassSpellSelection,
  hosted: Hosted = NOTHING_HOSTED,
): TierSpec[] {
  const tier = (
    kind: TierKind,
    noun: string,
    count: number,
    max: number | undefined,
    target = max ?? 1,
  ): TierSpec => ({ id: `${caster.classKey}:${kind}`, kind, noun, count, max, target })
  const out: TierSpec[] = [
    tier('cantrips', 'cantrips', selection.cantrips.length, caster.cantripsKnown),
  ]
  if (usesSpellbook(caster.name)) {
    const book = selection.spellbook ?? selection.spells
    out.push(
      tier(
        'book',
        'spellbook spells',
        book.length,
        undefined,
        caster.spellbookFree ?? spellbookFreeCount(caster.level),
      ),
      tier('prepared', 'spells prepared', selection.spells.length, caster.preparedMax),
    )
  } else if (caster.kind === 'known') {
    out.push(tier('spells', 'spells known', selection.spells.length, caster.spellsKnown))
  } else {
    out.push(
      tier('spells', 'spells prepared', selection.spells.length, caster.preparedMax),
    )
  }
  const hosts = (t: TierSpec) =>
    t.kind === 'cantrips' ? hosted.cantrips : t.kind === 'book' ? 0 : hosted.leveled
  return out.filter((t) => t.max !== 0 || t.count > 0 || hosts(t) > 0)
}

const hasRoom = (t: { count: number; target: number }) => t.count < t.target

/** The character as it is now, for handlers that run more than once in a click. */
function latestCharacter() {
  const { activeId, characters } = useCharacterStore.getState()
  return activeId ? characters[activeId] : undefined
}
const latestSelection = (classKey: string) =>
  latestCharacter()?.spells[classKey] ?? EMPTY_SELECTION

/** A spell a class always has, with the grant that gives it. */
interface Fixed {
  grant: SpellGrant
  spell: Spell
}

/** Whether a class's own grant of a named spell is shown in that class's tier. */
const isPlaced = (grant: SpellGrant, casters: ClassCaster[]) =>
  (grant.origin === 'class' || grant.origin === 'subclass') &&
  grant.spell !== undefined &&
  (grant.mode === 'known' || grant.mode === 'prepared') &&
  casters.some((c) => c.classKey === grant.classKey)

/** How full a table the player chooses in is. */
interface Room {
  id: string
  count: number
  target: number
}

// ---- Section ----------------------------------------------------------------

export function SpellsSection() {
  const character = useActiveCharacter()
  const updateActive = useCharacterStore((s) => s.updateActive)
  const featSummary = useFeatSummary()
  const spellsData = useAsyncData(loadSpells)
  const { classByKey, race, background, summary } = featSummary
  // The tier whose table is open; unset until the player opens or shuts one, when
  // it is the first with room left. `null` is every table shut.
  const [opened, setOpened] = useState<string | null | undefined>(undefined)
  const [allowNonStandard, setAllowNonStandard] = useState(false)

  const casters = useMemo(
    () =>
      character ? characterCasters(character, classByKey, summary.abilityBonus) : [],
    [character, classByKey, summary.abilityBonus],
  )
  const slots = useMemo(() => spellSlots(casters), [casters])
  const allSpells = useMemo(() => spellsData.data ?? [], [spellsData.data])
  const selectedBooks = character?.selectedBooks
  const byKey = useMemo(() => new Map(allSpells.map((s) => [s.key, s])), [allSpells])
  const byName = useMemo(() => spellsByName(allSpells), [allSpells])
  const inBooks = useMemo(() => {
    const books = new Set(selectedBooks ?? [])
    return allSpells.filter((s) => books.has(s.source))
  }, [allSpells, selectedBooks])
  // A spell printed in both editions appears twice; each row says which version it is.
  const twins = useMemo(() => {
    const editions = new Map<string, Set<Spell['edition']>>()
    for (const s of inBooks) {
      const name = s.name.toLowerCase()
      editions.set(name, (editions.get(name) ?? new Set()).add(s.edition))
    }
    return new Set(
      inBooks
        .filter((s) => (editions.get(s.name.toLowerCase())?.size ?? 0) > 1)
        .map((s) => s.key),
    )
  }, [inBooks])

  const resolved = useMemo(
    () =>
      character
        ? resolveSpellGrants(character, {
            race,
            background,
            featSlots: summary.slots,
            classByKey,
          })
        : undefined,
    [character, race, background, summary.slots, classByKey],
  )
  const grants = useMemo(() => resolved?.grants ?? [], [resolved])
  // What each class always has, and the spells a source adds to a class's list.
  const fixedByClass = useMemo(() => {
    const out = new Map<string, Fixed[]>()
    for (const grant of grants) {
      const spell = isPlaced(grant, casters) ? grantedSpell(grant, byName) : undefined
      if (!spell || !grant.classKey) continue
      const list = out.get(grant.classKey) ?? []
      if (!list.some((f) => f.spell.key === spell.key)) list.push({ grant, spell })
      out.set(grant.classKey, list)
    }
    return out
  }, [grants, casters, byName])
  const cardGrants = useMemo(
    () => grants.filter((g) => g.mode !== 'expanded' && !isPlaced(g, casters)),
    [grants, casters],
  )

  if (!character || !resolved) return null
  const cardAndPlaced = grants.filter((g) => g.mode !== 'expanded')

  const loading = featSummary.loading || spellsData.loading
  const error = featSummary.error ?? spellsData.error

  const hostedOf = (classKey: string): Hosted => {
    const fixed = fixedByClass.get(classKey) ?? []
    return {
      cantrips: fixed.filter((f) => f.spell.level === 0).length,
      leveled: fixed.filter((f) => f.spell.level > 0).length,
    }
  }
  /** Every table the player chooses in, with how full it is, for the character as given. */
  const roomsOf = (now: Character): Room[] => [
    ...casters.flatMap((c) =>
      tiersOf(c, now.spells[c.classKey] ?? EMPTY_SELECTION, hostedOf(c.classKey)),
    ),
    ...cardGrants.flatMap((g) =>
      g.pick && !g.locked
        ? [
            {
              id: pickTierId(g),
              count: (now.spellGrants[g.id]?.picks ?? []).length,
              target: g.pick.count,
            },
          ]
        : [],
    ),
  ]
  const firstWithRoom = (now: Character) => roomsOf(now).find(hasRoom)?.id ?? null
  const open = opened === undefined ? firstWithRoom(character) : opened

  /** A table was opened or shut; one that shut full hands over to the next with room. */
  function onBrowsingChange(tierId: string, browsing: boolean) {
    if (browsing) return setOpened(tierId)
    const now = latestCharacter()
    const filled = now ? roomsOf(now).find((t) => t.id === tierId) : undefined
    setOpened(now && filled && !hasRoom(filled) ? firstWithRoom(now) : null)
  }

  /** Edit a class's picks from what is stored now, so several adds in a click all land. */
  function edit(
    classKey: string,
    change: (s: ClassSpellSelection) => ClassSpellSelection,
  ) {
    const now = latestCharacter()
    if (!now) return
    updateActive({
      spells: { ...now.spells, [classKey]: change(latestSelection(classKey)) },
    })
  }

  /** The same for what a grant lets the player choose. */
  function editChoice(
    id: string,
    change: (choice: GrantedSpellChoice) => GrantedSpellChoice,
  ) {
    const now = latestCharacter()
    if (!now) return
    updateActive({
      spellGrants: {
        ...now.spellGrants,
        [id]: change(now.spellGrants[id] ?? { picks: [] }),
      },
    })
  }

  // What the player chose for a source the character no longer has.
  const lostGrants = Object.entries(character.spellGrants).filter(
    ([id, choice]) => !resolved.knownIds.has(id) && choice.picks.length > 0,
  )
  const orphans = Object.entries(character.spells).filter(
    ([key, s]) =>
      !casters.some((c) => c.classKey === key) &&
      s.cantrips.length + s.spells.length + (s.spellbook?.length ?? 0) > 0,
  )

  return (
    <EditorSection
      title="Spells"
      subtitle="Cantrips and spells per spellcasting class, chosen from every spell in your books. Limits are shown; a spell your class cannot have is greyed with the reason, and the switch allows it as a non-standard choice."
    >
      {loading && (
        <div className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading spells…
        </div>
      )}
      {error && <Alert variant="danger">Failed to load spells: {error.message}</Alert>}

      {!loading && !error && casters.length === 0 && (
        <Alert variant="warning" className="mb-0">
          No spellcasting class yet. Add a class like Wizard, Cleric, or Bard to cast
          spells.
        </Alert>
      )}

      {!loading && !error && (
        <>
          {casters.length > 0 && <SlotOverview slots={slots} />}
          {casters.map((caster) => (
            <CasterCard
              key={caster.classKey}
              caster={caster}
              edition={classByKey.get(caster.classKey)?.entry.edition}
              selection={character.spells[caster.classKey] ?? EMPTY_SELECTION}
              inBooks={inBooks}
              byKey={byKey}
              twins={twins}
              fixed={fixedByClass.get(caster.classKey) ?? []}
              expanded={grants.filter(
                (g) =>
                  g.mode === 'expanded' &&
                  !g.locked &&
                  (g.classKey === undefined || g.classKey === caster.classKey),
              )}
              selectedBooks={character.selectedBooks}
              open={open}
              onBrowsingChange={onBrowsingChange}
              allowNonStandard={allowNonStandard}
              onAllowNonStandardChange={setAllowNonStandard}
              edit={(change) => edit(caster.classKey, change)}
            />
          ))}
          <GrantedSpells
            grants={cardGrants}
            variants={resolved.variants}
            choices={character.spellGrants}
            byName={byName}
            byKey={byKey}
            rows={inBooks}
            twins={twins}
            open={open}
            onBrowsingChange={onBrowsingChange}
            allowNonStandard={allowNonStandard}
            onAllowNonStandardChange={setAllowNonStandard}
            editChoice={editChoice}
          />
          <YourSpells
            casters={casters}
            character={character}
            grants={cardAndPlaced}
            byKey={byKey}
            byName={byName}
            removeClassPick={(classKey, spell) =>
              edit(classKey, (c) => ({
                ...c,
                cantrips: without(c.cantrips, spell.key),
                spellbook: c.spellbook ? without(c.spellbook, spell.key) : undefined,
                spells: without(c.spells, spell.key),
              }))
            }
            removeGrantPick={(id, spell) =>
              editChoice(id, (c) => ({ ...c, picks: without(c.picks, spell.key) }))
            }
          />
          {lostGrants.length > 0 && (
            <Alert
              variant="warning"
              className="d-flex flex-wrap align-items-center gap-2"
            >
              <span className="flex-grow-1">
                <strong>Spells from something you no longer have:</strong>{' '}
                {[
                  ...new Set(lostGrants.flatMap(([, c]) => c.picks.map((r) => r.name))),
                ].join(', ')}
                . They stay on the character until you remove them.
              </span>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  const gone = new Set(lostGrants.map(([id]) => id))
                  updateActive({
                    spellGrants: Object.fromEntries(
                      Object.entries(character.spellGrants).filter(
                        ([id]) => !gone.has(id),
                      ),
                    ),
                  })
                }}
              >
                Remove all
              </Button>
            </Alert>
          )}
          {orphans.map(([key, selection]) => (
            <OrphanAlert
              key={key}
              classKey={key}
              selection={selection}
              onRemoveAll={() => {
                const { [key]: _gone, ...rest } = character.spells
                updateActive({ spells: rest })
              }}
            />
          ))}
        </>
      )}
    </EditorSection>
  )
}

function SlotOverview({ slots }: { slots: ReturnType<typeof spellSlots> }) {
  const active = slots.standard
    .map((count, i) => ({ level: i + 1, count }))
    .filter((s) => s.count > 0)
  if (active.length === 0 && !slots.pact) return null
  return (
    <div className="d-flex flex-wrap gap-2 mb-3">
      {active.map((s) => (
        <Badge bg="secondary" key={s.level}>
          Level {s.level}: {s.count} slot{s.count === 1 ? '' : 's'}
        </Badge>
      ))}
      {slots.pact && (
        <Badge bg="info" text="dark">
          Pact: {slots.pact.slots} slot{slots.pact.slots === 1 ? '' : 's'} of level{' '}
          {slots.pact.level}
        </Badge>
      )}
    </div>
  )
}

/** Spells saved for a class that no longer casts: kept, shown, removable. */
function OrphanAlert({
  classKey,
  selection,
  onRemoveAll,
}: {
  classKey: string
  selection: ClassSpellSelection
  onRemoveAll: () => void
}) {
  const names = [
    ...selection.cantrips,
    ...(selection.spellbook ?? []),
    ...selection.spells,
  ]
    .map((r) => r.name)
    .filter((name, i, all) => all.indexOf(name) === i)
  return (
    <Alert variant="warning" className="d-flex flex-wrap align-items-center gap-2">
      <span className="flex-grow-1">
        <strong>Spells for {classKey.split('|')[0]} (no longer casting):</strong>{' '}
        {names.join(', ')}. They stay on the character until you remove them.
      </span>
      <Button size="sm" variant="danger" onClick={onRemoveAll}>
        Remove all
      </Button>
    </Alert>
  )
}

// ---- A class card -----------------------------------------------------------

/** What the kind badge says when hovered: how the class's spells are chosen and changed. */
function kindTip(caster: ClassCaster): string {
  const changes =
    caster.changes === 'level'
      ? ' You can change them when you gain a level.'
      : caster.changes === 'restLong'
        ? ' You can change them after a long rest.'
        : ''
  if (caster.isPact)
    return 'Pact Magic: a few slots, all of the same level, back after a short rest.'
  if (usesSpellbook(caster.name))
    return `Spells are written in a spellbook, and you prepare some of them.${changes}`
  if (caster.kind === 'known') return `You know a fixed number of spells.${changes}`
  return `You prepare spells from the class list.${changes}`
}

const kindLabel = (caster: ClassCaster) =>
  caster.isPact
    ? 'Pact Magic'
    : usesSpellbook(caster.name)
      ? 'Spellbook'
      : caster.kind === 'known'
        ? 'Known'
        : 'Prepared'

interface CasterCardProps {
  caster: ClassCaster
  selection: ClassSpellSelection
  /** Every spell of the selected books. */
  inBooks: Spell[]
  /** The rules edition of the class, which a subclass list is held to. */
  edition: Spell['edition'] | undefined
  /** Every loaded spell, to turn a saved pick back into its stats. */
  byKey: Map<string, Spell>
  /** Spells with a namesake of the other edition, to say which version a row is. */
  twins: Set<string>
  /** The spells the class always has: they head the tier and cost no pick. */
  fixed: Fixed[]
  /** What sources add to the class's list (a patron's spells, a background's). */
  expanded: SpellGrant[]
  selectedBooks: string[]
  open: string | null
  onBrowsingChange: (tierId: string, browsing: boolean) => void
  allowNonStandard: boolean
  onAllowNonStandardChange: (allow: boolean) => void
  edit: (change: (s: ClassSpellSelection) => ClassSpellSelection) => void
}

const alwaysWord = (grant: SpellGrant) =>
  grant.mode === 'known' ? 'always known' : 'always prepared'

/** Whether a source's added spell is this one. */
function addsSpell(grant: SpellGrant, spell: Spell): boolean {
  if (grant.all) return matchesFilter(spell, grant.all, grant.edition)
  if (!grant.spell || grant.spell.name.toLowerCase() !== spell.name.toLowerCase())
    return false
  return grant.spell.source
    ? grant.spell.source.toLowerCase() === spell.source.toLowerCase()
    : grant.edition === undefined || grant.edition === spell.edition
}

function CasterCard({
  caster,
  edition,
  selection,
  inBooks,
  byKey,
  twins,
  fixed,
  expanded,
  selectedBooks,
  open,
  onBrowsingChange,
  allowNonStandard,
  onAllowNonStandardChange,
  edit,
}: CasterCardProps) {
  const maxLevel = classMaxSpellLevel(caster)
  const book = selection.spellbook ?? selection.spells
  const spellsOf = (refs: SpellRef[]) => refs.flatMap((r) => byKey.get(refKey(r)) ?? [])
  const className = caster.classKey.split('|')[0]
  const fixedByKey = new Map(fixed.map((f) => [f.spell.key, f]))
  const version = (spell: Spell) =>
    twins.has(spell.key) ? ` (${editionYear(spell.edition)} version)` : ''

  // Spells saved from a book that is no longer selected stay, and say so.
  const strays = [...selection.cantrips, ...book, ...selection.spells]
    .filter((r, i, all) => all.findIndex((o) => refKey(o) === refKey(r)) === i)
    .filter((r) => !selectedBooks.includes(r.source))

  /** The class's own rules for a spell: its list and its level. */
  const problemsOf = (spell: Spell): string[] => {
    const problems: string[] = []
    const listed =
      isOnClassList(spell, { ...caster, edition }, selectedBooks) ||
      expanded.some((grant) => addsSpell(grant, spell))
    if (!listed) {
      // The same list of the other edition holds it: say which edition this is.
      const elsewhere = caster.subclassKey
        ? spell.lists.subclasses.some(
            (k) => k.split('|')[2] === caster.subclassKey?.split('|')[2],
          )
        : spell.lists.classes.some((k) => k.split('|')[0] === className)
      problems.push(
        elsewhere
          ? `${editionYear(spell.edition)} version`
          : `Not on the ${caster.name} list${version(spell)}`,
      )
    }
    if (spell.level > maxLevel) problems.push(`Needs level ${spell.level} slots`)
    return problems
  }
  const metaOf = (problems: string[]) => ({
    standard: problems.length === 0,
    reason: problems.length > 0 ? problems.join('; ') : undefined,
  })
  /** A spell the class always has is no pick and no deviation; before its level it is greyed. */
  const fixedMeta = (entry: Fixed) =>
    entry.grant.locked
      ? { standard: true, gated: { reason: `Unlocks at level ${entry.grant.gate}` } }
      : { standard: true }

  const cantripRows = inBooks.filter((s) => s.level === 0)
  const leveledRows = inBooks.filter((s) => s.level > 0)
  const bookRows = spellsOf(book).filter((s) => selectedBooks.includes(s.source))

  /** What each tier works on: its rows, its picks, and how a pick is added or removed. */
  const tierBody = (t: TierSpec) => {
    const bookOf = (s: ClassSpellSelection) => s.spellbook ?? s.spells
    switch (t.kind) {
      case 'cantrips':
        return {
          rows: cantripRows,
          picked: spellsOf(selection.cantrips),
          add: (s: Spell) =>
            edit((c) => ({ ...c, cantrips: withRef(c.cantrips, refOf(s)) })),
          remove: (s: Spell) =>
            edit((c) => ({ ...c, cantrips: without(c.cantrips, s.key) })),
        }
      case 'book':
        return {
          rows: leveledRows,
          picked: spellsOf(book),
          add: (s: Spell) =>
            edit((c) => ({ ...c, spellbook: withRef(bookOf(c), refOf(s)) })),
          // Erasing a spell from the book also unprepares it: it can no longer be prepared.
          remove: (s: Spell) =>
            edit((c) => ({
              ...c,
              spellbook: without(bookOf(c), s.key),
              spells: without(c.spells, s.key),
            })),
        }
      case 'prepared':
        return {
          rows: bookRows,
          picked: spellsOf(selection.spells),
          add: (s: Spell) =>
            edit((c) => ({
              ...c,
              spellbook: bookOf(c),
              spells: withRef(c.spells, refOf(s)),
            })),
          remove: (s: Spell) =>
            edit((c) => ({
              ...c,
              spellbook: bookOf(c),
              spells: without(c.spells, s.key),
            })),
        }
      case 'spells':
        return {
          rows: leveledRows,
          picked: spellsOf(selection.spells),
          add: (s: Spell) => edit((c) => ({ ...c, spells: withRef(c.spells, refOf(s)) })),
          remove: (s: Spell) => edit((c) => ({ ...c, spells: without(c.spells, s.key) })),
        }
    }
  }

  /** The spells the class always has that a tier shows: cantrips, or the leveled spells. */
  const fixedIn = (t: TierSpec) =>
    t.kind === 'book'
      ? []
      : fixed.filter((f) => (f.spell.level === 0) === (t.kind === 'cantrips'))

  const hosted = {
    cantrips: fixed.filter((f) => f.spell.level === 0).length,
    leveled: fixed.filter((f) => f.spell.level > 0).length,
  }
  const tiers = tiersOf(caster, selection, hosted)
  const bookFree = caster.spellbookFree ?? spellbookFreeCount(caster.level)

  return (
    <section className="border rounded p-3 mb-3" aria-label={caster.name}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <strong>{caster.name}</strong>
        <span className="text-body-secondary">level {caster.level}</span>
        {caster.ability && (
          <Badge bg="light" text="dark">
            <Abbr code={caster.ability.toUpperCase()} kind="ability" />
          </Badge>
        )}
        <OverlayTrigger placement="top" overlay={<Tooltip>{kindTip(caster)}</Tooltip>}>
          <Badge bg="light" text="dark">
            {kindLabel(caster)}
          </Badge>
        </OverlayTrigger>
        <span className="small text-body-secondary">
          {maxLevel > 0
            ? `Highest spell level you can learn: ${spellLevelLabel(maxLevel).replace(' level', '')}`
            : 'No spell slots yet'}
        </span>
      </div>

      {strays.map((ref) => (
        <NotInBooksAlert
          key={refKey(ref)}
          noun="spell"
          name={ref.name}
          source={ref.source}
          onRemove={() =>
            edit((c) => ({
              ...c,
              cantrips: without(c.cantrips, refKey(ref)),
              spellbook: c.spellbook ? without(c.spellbook, refKey(ref)) : undefined,
              spells: without(c.spells, refKey(ref)),
            }))
          }
        />
      ))}

      {tiers.map((t) => {
        const body = tierBody(t)
        const pickedKeys = new Set(body.picked.map((s) => s.key))
        const full = t.max !== undefined && t.count >= t.max
        const given = fixedIn(t)
        const active = given.filter((f) => !f.grant.locked)
        const words = new Set(active.map((f) => alwaysWord(f.grant)))
        return (
          <div key={t.id} className="mb-3">
            {t.kind === 'book' && (
              <div className="small text-body-secondary mb-1">
                Free from your levels: {bookFree} spells. Copied spells add more.
              </div>
            )}
            {t.kind === 'prepared' && (
              <div className="small text-body-secondary mb-1">
                Chosen from your spellbook.
              </div>
            )}
            <SpellPicker
              rows={body.rows}
              picked={body.picked}
              fixed={
                given.length > 0
                  ? {
                      spells: given.map((f) => f.spell),
                      notes: new Map(
                        given.map((f) => [
                          f.spell.key,
                          f.grant.locked
                            ? `${f.grant.from}, unlocks at level ${f.grant.gate}`
                            : `${f.grant.from}, ${alwaysWord(f.grant)}`,
                        ]),
                      ),
                    }
                  : undefined
              }
              aside={
                active.length > 0
                  ? `+${active.length} ${words.size === 1 ? [...words][0] : 'granted'}`
                  : undefined
              }
              cantrips={t.kind === 'cantrips'}
              rowMeta={(spell) => {
                const given = fixedByKey.get(spell.key)
                return metaOf([
                  ...(given
                    ? [`Already ${alwaysWord(given.grant)} (${given.grant.from})`]
                    : problemsOf(spell)),
                  ...(full && !pickedKeys.has(spell.key)
                    ? [`All ${t.max} ${t.noun} chosen`]
                    : []),
                ])
              }}
              pickedRowMeta={(spell) => {
                const given = fixedByKey.get(spell.key)
                return given ? fixedMeta(given) : metaOf(problemsOf(spell))
              }}
              allowNonStandard={allowNonStandard}
              onAllowNonStandardChange={onAllowNonStandardChange}
              onAdd={body.add}
              onRemove={body.remove}
              noun={t.noun}
              limit={
                t.max === undefined
                  ? undefined
                  : {
                      max: t.max,
                      reason: `More ${t.noun} than ${caster.name} gets at this level`,
                    }
              }
              open={open === t.id}
              onBrowsingChange={(browsing) => onBrowsingChange(t.id, browsing)}
              label={`${caster.name} ${t.noun}`}
            />
          </div>
        )
      })}
    </section>
  )
}
