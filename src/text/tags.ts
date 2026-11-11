// Convert 5etools "{@tag ...}" markup to plain display text.
//
// 5etools embeds tags like {@spell fireball|phb|fire ball}, {@dice 1d6},
// {@condition prone}, {@item longsword}, {@dc 15}. This renders the human-facing
// text. It is intentionally pragmatic: known special tags get bespoke handling,
// everything else falls back to a display override or the primary text.

function atkLabel(kind: string): string {
  const map: Record<string, string> = {
    mw: 'Melee Weapon Attack',
    rw: 'Ranged Weapon Attack',
    ms: 'Melee Spell Attack',
    rs: 'Ranged Spell Attack',
    ms_rs: 'Melee or Ranged Spell Attack',
    mw_rw: 'Melee or Ranged Weapon Attack',
  }
  return map[kind] ?? kind
}

function renderTag(tag: string, content: string): string {
  const parts = content.split('|')
  const first = parts[0] ?? ''
  switch (tag) {
    case 'atk':
      return atkLabel(first)
    case 'h':
      return 'Hit: '
    case 'hit':
      return `${Number(first) >= 0 ? '+' : ''}${first}`
    case 'dc':
      return `DC ${first}`
    case 'chance':
      return `${first}%`
    case 'recharge':
      return first ? `(Recharge ${first}–6)` : '(Recharge 6)'
    case 'dice':
    case 'damage':
    case 'scaledice':
    case 'scaledamage':
    case 'autodice':
      return parts[1] || first
    case 'book':
    case 'adventure':
    case 'quickref':
    case 'filter':
    case 'footnote':
      return first
    default:
      // Reference tags: {@spell name|source|display}, {@item ...}, {@b text}, …
      return parts[2] || first
  }
}

/** Replace all {@tag …} occurrences with display text, innermost first. */
export function stripTags(text: string): string {
  if (typeof text !== 'string') return String(text)
  // Match an innermost tag (no nested braces inside).
  const re = /\{@(\w+)\s*([^{}]*)\}/
  let out = text
  let guard = 0
  while (re.test(out) && guard < 100) {
    out = out.replace(re, (_m, tag: string, content: string) => renderTag(tag, content))
    guard++
  }
  return out
}
