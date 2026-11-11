// App-wide date formatting. Every date renders slash-separated, zero-padded, and
// locale-independent, at the *finest granularity the value actually carries*:
//
//   YYYY                    year only
//   YYYY/MM                 year + month
//   YYYY/MM/DD              full date
//   YYYY/MM/DD HH:MM AM/PM  full date + time (a timestamp always has a time)

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * Format a partial ISO date string ("YYYY", "YYYY-MM", or "YYYY-MM-DD") at its own
 * granularity, e.g. "2014-08-19" → "2014/08/19", "2020" → "2020". Anything that is
 * not one of those shapes passes through unchanged.
 */
export function formatDateParts(value: string | undefined): string | null {
  if (!value) return null
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim())
  if (!m) return value
  const [, year, month, day] = m
  if (day) return `${year}/${month}/${day}`
  if (month) return `${year}/${month}`
  return year
}

/**
 * Format a millisecond timestamp as "YYYY/MM/DD HH:MM AM/PM" in local time. A
 * timestamp always carries a time, so it always renders at the finest granularity.
 */
export function formatTimestamp(ms: number): string {
  const d = new Date(ms)
  const hours = d.getHours()
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  const meridiem = hours < 12 ? 'AM' : 'PM'
  return (
    `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ` +
    `${pad(hour12)}:${pad(d.getMinutes())} ${meridiem}`
  )
}
