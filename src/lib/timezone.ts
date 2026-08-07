/**
 * Returns `timeZone`'s UTC offset (minutes, positive east of UTC) at the
 * given instant. Works by formatting `at` in the target zone to get its
 * wall-clock components, then reinterpreting those same components as if
 * they were UTC — the gap between that reinterpreted timestamp and the real
 * one is exactly the zone's offset. Avoids parsing locale-formatted offset
 * strings (e.g. "GMT+9:30"), which vary by ICU version/locale.
 */
function getTimeZoneOffsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)

  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type)
    return part ? Number.parseInt(part.value, 10) : 0
  }

  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return (asUtc - at.getTime()) / 60_000
}

/**
 * Computes the UTC timestamp range [startMs, endMs) spanning `timeZone`'s
 * local calendar day containing `at` — i.e. that location's actual midnight
 * to next midnight, not a UTC-day window (see the "why" note in
 * `plutoTime.ts`'s `getPlutoTimes` doc comment for why the distinction
 * matters).
 *
 * The offset used for both boundaries is sampled once, at `at` — a day with
 * a DST transition exactly at midnight (rare) could shift a boundary by up
 * to an hour, but that's inconsequential here: dawn/dusk crossings sit many
 * hours from midnight, so a boundary being off by up to an hour doesn't
 * affect which crossing gets found, only the window's rarely-relevant edges.
 */
export function getLocalDayWindow(timeZone: string, at: Date = new Date()): { startMs: number; endMs: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at)

  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type)
    return part ? Number.parseInt(part.value, 10) : 0
  }

  const year = get('year')
  const month = get('month') - 1
  const day = get('day')

  const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, at)
  const startMs = Date.UTC(year, month, day) - offsetMinutes * 60_000
  const endMs = Date.UTC(year, month, day + 1) - offsetMinutes * 60_000

  return { startMs, endMs }
}
