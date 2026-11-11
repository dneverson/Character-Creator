// Renders an acronym/code (STR, PHB, gp, …) with a tooltip spelling out its full
// name, e.g. "Sourcebook · Player's Handbook (2014)". The expansion comes from
// the glossary registry (data/glossary), so book sources stay data-driven and
// the fixed rules vocabulary is maintained in one place.
//
// The tooltip shows how the acronym is formed by bolding the letters it maps to
// ([P]layer's [H]and[B]ook). A code the glossary doesn't know - or an ambiguous
// one looked up without a `kind` - renders as plain text with no tooltip, so it
// is always safe to wrap a value in <Abbr>.

import { Fragment } from 'react'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { lookup, matchAcronym, type AbbrKind } from '../data/glossary'

interface Props {
  /** The acronym/code to expand, e.g. "PHB", "STR", "gp". */
  code: string
  /** The acronym family, when known - disambiguates codes shared across families. */
  kind?: AbbrKind
  /** Extra classes for the rendered code (the visual affordance lives in `.abbr`). */
  className?: string
}

/** The full name with the acronym's letters bolded to show how it's derived. */
function ExpandedName({ code, full }: { code: string; full: string }) {
  const segments = matchAcronym(code, full)
  if (!segments) return <>{full}</>
  return (
    <>
      {segments.map((seg, i) => (
        <Fragment key={i}>
          {seg.matched ? <strong>{seg.text}</strong> : seg.text}
        </Fragment>
      ))}
    </>
  )
}

export function Abbr({ code, kind, className }: Props) {
  const hit = lookup(code, kind)
  if (!hit) return <>{code}</>
  return (
    <OverlayTrigger
      placement="top"
      overlay={
        <Tooltip>
          <strong>{hit.category}</strong> · <ExpandedName code={code} full={hit.full} />
        </Tooltip>
      }
    >
      <abbr className={className ? `abbr ${className}` : 'abbr'}>{code}</abbr>
    </OverlayTrigger>
  )
}

// Matches one whitespace-separated token as optional edge punctuation around a
// single run of letters, so "(RPG)," yields the core "RPG" while "Master's"
// (letters split by punctuation) is left whole and never wrapped.
const WORD = /^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/

/**
 * Wraps recognized acronyms found *inside* a plain string in <Abbr>, leaving the
 * surrounding text untouched - for free-text fields where an acronym is embedded
 * rather than standing alone (e.g. the "RPG" in "Wizards RPG Team", the "DM" in
 * "DM screen"). Only whole words the glossary resolves are wrapped; everything
 * else passes through verbatim, so it is always safe to wrap a field in it.
 */
export function AbbrText({
  text,
  kind,
  className,
}: {
  text: string
  kind?: AbbrKind
  className?: string
}) {
  const tokens = text.split(/(\s+)/) // keeps the whitespace runs as tokens
  return (
    <>
      {tokens.map((token, i) => {
        const parts = WORD.exec(token)
        if (parts && lookup(parts[2], kind)) {
          const [, pre, core, post] = parts
          return (
            <Fragment key={i}>
              {pre}
              <Abbr code={core} kind={kind} className={className} />
              {post}
            </Fragment>
          )
        }
        return <Fragment key={i}>{token}</Fragment>
      })}
    </>
  )
}
