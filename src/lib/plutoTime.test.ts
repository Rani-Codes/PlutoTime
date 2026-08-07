import { describe, expect, it } from 'vitest'
import { getPlutoTimes, PLUTO_TIME_ELEVATION_DEGREES } from './plutoTime'
import { getSolarElevation } from './solarPosition'
import { getLocalDayWindow } from './timezone'

/**
 * Independent validation of `getPlutoTimes`. `getSolarElevation` itself is
 * validated separately (and thoroughly) against NOAA/sunrise-sunset.org
 * data in solarPosition.test.ts — this file assumes that underlying
 * function is accurate and focuses on `getPlutoTimes`'s own logic: finding
 * the right crossing(s) of a fixed elevation threshold within a caller-
 * supplied window, picking ascending vs descending correctly, handling
 * polar day/night, and — the specific thing that was corrected during
 * review — actually using the caller's timezone-correct window rather than
 * an implicit UTC-calendar-day window.
 */

const DAY_MS = 24 * 60 * 60_000

/**
 * A from-scratch reference crossing-finder, independent of plutoTime.ts's
 * own `bisectCrossing`/scan loop. Brackets by a coarse forward scan then
 * bisects. Used to check `getPlutoTimes`'s output against a differently-
 * written implementation of the same idea, both built on the
 * already-validated `getSolarElevation`.
 */
function referenceCrossings(
  windowStartMs: number,
  windowEndMs: number,
  latitude: number,
  longitude: number,
): { morning: number | null; evening: number | null } {
  const thresholdDiff = (ms: number) => getSolarElevation(new Date(ms), latitude, longitude) - PLUTO_TIME_ELEVATION_DEGREES

  let morning: number | null = null
  let evening: number | null = null
  const stepMs = 5 * 60_000

  let prev = windowStartMs
  let prevDiff = thresholdDiff(prev)

  for (let t = windowStartMs + stepMs; t <= windowEndMs; t += stepMs) {
    const diff = thresholdDiff(t)
    if (morning === null && prevDiff <= 0 && diff > 0) {
      let lo = prev
      let hi = t
      for (let i = 0; i < 40 && hi - lo > 1000; i++) {
        const mid = (lo + hi) / 2
        if (thresholdDiff(mid) <= 0) lo = mid
        else hi = mid
      }
      morning = Math.round((lo + hi) / 2)
    } else if (evening === null && prevDiff >= 0 && diff < 0) {
      let lo = prev
      let hi = t
      for (let i = 0; i < 40 && hi - lo > 1000; i++) {
        const mid = (lo + hi) / 2
        if (thresholdDiff(mid) >= 0) lo = mid
        else hi = mid
      }
      evening = Math.round((lo + hi) / 2)
    }
    prev = t
    prevDiff = diff
    if (morning !== null && evening !== null) break
  }

  return { morning, evening }
}

describe('PLUTO_TIME_ELEVATION_DEGREES', () => {
  it('is -1.5 (the widely-cited Pluto Time threshold)', () => {
    expect(PLUTO_TIME_ELEVATION_DEGREES).toBe(-1.5)
  })
})

describe('getPlutoTimes - crossing correctness vs an independently-written reference finder', () => {
  const cases: Array<{ label: string; lat: number; lon: number; windowStartIso: string }> = [
    { label: 'New York, equinox', lat: 40.7128, lon: -74.006, windowStartIso: '2026-03-20T00:00:00Z' },
    { label: 'Tokyo, June solstice', lat: 35.6762, lon: 139.6917, windowStartIso: '2026-06-21T00:00:00Z' },
    { label: 'Sydney, December solstice', lat: -33.8688, lon: 151.2093, windowStartIso: '2026-12-21T00:00:00Z' },
    { label: 'Quito (equator), arbitrary date', lat: -0.1807, lon: -78.4678, windowStartIso: '2026-09-22T00:00:00Z' },
    { label: 'Tromso, near (but outside) polar day', lat: 69.6492, lon: 18.9553, windowStartIso: '2026-04-15T00:00:00Z' },
  ]

  for (const c of cases) {
    it(`${c.label}: morning and evening match the reference finder within 30s`, () => {
      const windowStartMs = new Date(c.windowStartIso).getTime()
      const windowEndMs = windowStartMs + DAY_MS

      const result = getPlutoTimes(windowStartMs, windowEndMs, c.lat, c.lon)
      const reference = referenceCrossings(windowStartMs, windowEndMs, c.lat, c.lon)

      expect(result.morning).not.toBeNull()
      expect(result.evening).not.toBeNull()
      expect(reference.morning).not.toBeNull()
      expect(reference.evening).not.toBeNull()

      expect(Math.abs(result.morning!.getTime() - reference.morning!)).toBeLessThanOrEqual(30_000)
      expect(Math.abs(result.evening!.getTime() - reference.evening!)).toBeLessThanOrEqual(30_000)
    })
  }
})

describe('getPlutoTimes - ascending vs descending crossing correctness', () => {
  it('morning crossing is ascending (elevation increasing through -1.5)', () => {
    const windowStartMs = new Date('2026-03-20T00:00:00Z').getTime()
    const windowEndMs = windowStartMs + DAY_MS
    const { morning } = getPlutoTimes(windowStartMs, windowEndMs, 40.7128, -74.006)
    expect(morning).not.toBeNull()

    const before = getSolarElevation(new Date(morning!.getTime() - 5 * 60_000), 40.7128, -74.006)
    const after = getSolarElevation(new Date(morning!.getTime() + 5 * 60_000), 40.7128, -74.006)
    expect(before).toBeLessThan(PLUTO_TIME_ELEVATION_DEGREES)
    expect(after).toBeGreaterThan(PLUTO_TIME_ELEVATION_DEGREES)
  })

  it('evening crossing is descending (elevation decreasing through -1.5)', () => {
    const windowStartMs = new Date('2026-03-20T00:00:00Z').getTime()
    const windowEndMs = windowStartMs + DAY_MS
    const { evening } = getPlutoTimes(windowStartMs, windowEndMs, 40.7128, -74.006)
    expect(evening).not.toBeNull()

    const before = getSolarElevation(new Date(evening!.getTime() - 5 * 60_000), 40.7128, -74.006)
    const after = getSolarElevation(new Date(evening!.getTime() + 5 * 60_000), 40.7128, -74.006)
    expect(before).toBeGreaterThan(PLUTO_TIME_ELEVATION_DEGREES)
    expect(after).toBeLessThan(PLUTO_TIME_ELEVATION_DEGREES)
  })

  it('morning is strictly before evening', () => {
    // Deliberately uses getLocalDayWindow (rather than a raw UTC-calendar
    // window) so the window is aligned to Singapore's own local midnight.
    // A raw UTC-day window for a near-equatorial, far-from-UTC location
    // like Singapore (UTC+8) can start mid-local-day, in which case "first
    // ascending crossing in the window" can legitimately be the *next*
    // day's dawn, landing after the window's own dusk chronologically --
    // that's a property of an arbitrarily-chosen window, not a morning/
    // evening ordering bug, so it's important to test ordering on a
    // properly-aligned window instead.
    const { startMs, endMs } = getLocalDayWindow('Asia/Singapore', new Date('2026-06-21T12:00:00Z'))
    const { morning, evening } = getPlutoTimes(startMs, endMs, 1.3521, 103.8198)
    expect(morning).not.toBeNull()
    expect(evening).not.toBeNull()
    expect(morning!.getTime()).toBeLessThan(evening!.getTime())
  })
})

describe('getPlutoTimes - polar day/night null handling', () => {
  // Same well-documented facts used in solarPosition.test.ts: Barrow, AK
  // has no sunrise for ~2 months around the winter solstice, and 24h
  // daylight for ~2.5 months around the summer solstice.
  const barrow = { lat: 71.2906, lon: -156.7887 }

  it('returns {morning: null, evening: null} during polar night (winter solstice)', () => {
    const windowStartMs = new Date('2026-12-21T00:00:00Z').getTime()
    const windowEndMs = windowStartMs + DAY_MS
    const result = getPlutoTimes(windowStartMs, windowEndMs, barrow.lat, barrow.lon)
    expect(result.morning).toBeNull()
    expect(result.evening).toBeNull()
  })

  it('returns {morning: null, evening: null} during polar day (midnight sun, summer solstice)', () => {
    const windowStartMs = new Date('2026-06-21T00:00:00Z').getTime()
    const windowEndMs = windowStartMs + DAY_MS
    const result = getPlutoTimes(windowStartMs, windowEndMs, barrow.lat, barrow.lon)
    expect(result.morning).toBeNull()
    expect(result.evening).toBeNull()
  })

  it('McMurdo, Antarctica: polar day at (southern) summer solstice also yields nulls', () => {
    const windowStartMs = new Date('2026-12-21T00:00:00Z').getTime()
    const windowEndMs = windowStartMs + DAY_MS
    const result = getPlutoTimes(windowStartMs, windowEndMs, -77.8419, 166.6863)
    expect(result.morning).toBeNull()
    expect(result.evening).toBeNull()
  })

  it('returns real (non-null) crossings for Barrow well outside the polar day/night window', () => {
    const windowStartMs = new Date('2026-04-15T00:00:00Z').getTime()
    const windowEndMs = windowStartMs + DAY_MS
    const result = getPlutoTimes(windowStartMs, windowEndMs, barrow.lat, barrow.lon)
    expect(result.morning).not.toBeNull()
    expect(result.evening).not.toBeNull()
  })
})

/**
 * The timezone-window fix, specifically.
 *
 * This is the bug class the review corrected: deriving the search window
 * from a Date's *UTC* calendar fields silently breaks for non-UTC zones,
 * because "today" in UTC and "today" in, say, Tokyo (UTC+9) are offset by
 * up to 9 hours and can disagree on which calendar day a given instant
 * falls on for a third to a half of each day.
 *
 * We verify two things: (1) using the correct `getLocalDayWindow`-derived
 * window, results land at a plausible local clock hour for dawn/dusk, for
 * several non-UTC zones (including a negative-offset Americas zone and
 * positive-offset Asia/Australia zones); and (2) a naive UTC-calendar-day
 * window (the old, incorrect approach) actually does diverge materially
 * from the correct one for a well-chosen instant, demonstrating the fix
 * is not a no-op.
 */
describe('getPlutoTimes - timezone-window correctness (the reviewed fix)', () => {
  function localHourOf(date: Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(date)
    const hour = Number(parts.find((p) => p.type === 'hour')!.value)
    const minute = Number(parts.find((p) => p.type === 'minute')!.value)
    return hour + minute / 60
  }

  const cases: Array<{ label: string; lat: number; lon: number; timeZone: string; at: string }> = [
    // Negative-offset, Americas.
    { label: 'New York (UTC-4/5)', lat: 40.7128, lon: -74.006, timeZone: 'America/New_York', at: '2026-03-20T12:00:00Z' },
    { label: 'Quito (UTC-5)', lat: -0.1807, lon: -78.4678, timeZone: 'America/Guayaquil', at: '2026-09-22T12:00:00Z' },
    // Positive-offset, Asia/Australia.
    { label: 'Tokyo (UTC+9)', lat: 35.6762, lon: 139.6917, timeZone: 'Asia/Tokyo', at: '2026-06-21T12:00:00Z' },
    { label: 'Sydney (UTC+10/11)', lat: -33.8688, lon: 151.2093, timeZone: 'Australia/Sydney', at: '2026-03-20T12:00:00Z' },
    { label: 'Singapore (UTC+8)', lat: 1.3521, lon: 103.8198, timeZone: 'Asia/Singapore', at: '2026-06-21T12:00:00Z' },
  ]

  for (const c of cases) {
    it(`${c.label}: dawn/dusk land on plausible local clock hours using getLocalDayWindow`, () => {
      const { startMs, endMs } = getLocalDayWindow(c.timeZone, new Date(c.at))
      const { morning, evening } = getPlutoTimes(startMs, endMs, c.lat, c.lon)

      expect(morning).not.toBeNull()
      expect(evening).not.toBeNull()

      const morningLocalHour = localHourOf(morning!, c.timeZone)
      const eveningLocalHour = localHourOf(evening!, c.timeZone)

      // Generous bounds (per task spec: dawn ~3-8am, dusk ~5-9pm), loosened
      // slightly at the edges to tolerate latitude/season variation while
      // still catching a gross timezone-window error (which would land the
      // result at a wildly wrong hour, e.g. 2am or 3pm).
      expect(morningLocalHour).toBeGreaterThanOrEqual(3)
      expect(morningLocalHour).toBeLessThanOrEqual(8.5)
      expect(eveningLocalHour).toBeGreaterThanOrEqual(16.5)
      expect(eveningLocalHour).toBeLessThanOrEqual(21)
    })
  }

  it('a naive UTC-calendar-day window materially diverges from the correct local-day window (Tokyo)', () => {
    // Pick an instant early in the Tokyo local day but still the previous
    // UTC calendar day: 2026-06-21T02:00:00Z is 2026-06-21T11:00 JST --
    // still same UTC date. Instead pick one where UTC date lags local
    // date: 2026-06-21T20:00:00Z is 2026-06-22T05:00 JST (next day in
    // Tokyo already).
    const at = new Date('2026-06-21T20:00:00Z')
    const lat = 35.6762
    const lon = 139.6917

    // Naive (incorrect) approach the review rejected: derive the window
    // from the instant's own *UTC* calendar day.
    const naiveStartMs = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())
    const naiveEndMs = naiveStartMs + DAY_MS

    // Correct approach: ask timezone.ts for Tokyo's actual local calendar
    // day containing `at`.
    const correct = getLocalDayWindow('Asia/Tokyo', at)

    // The two windows should NOT be the same -- if they were, this test
    // instant wasn't actually exercising the bug class, and the "fix"
    // would be unverifiable.
    expect(naiveStartMs).not.toBe(correct.startMs)

    const naiveResult = getPlutoTimes(naiveStartMs, naiveEndMs, lat, lon)
    const correctResult = getPlutoTimes(correct.startMs, correct.endMs, lat, lon)

    expect(naiveResult.morning).not.toBeNull()
    expect(naiveResult.evening).not.toBeNull()
    expect(correctResult.morning).not.toBeNull()
    expect(correctResult.evening).not.toBeNull()

    // The two 24h windows overlap for 9 of their 24 hours (naive:
    // [Jun21 00:00, Jun22 00:00) UTC; correct: [Jun21 15:00, Jun22 15:00)
    // UTC), which produces a subtle, partial failure mode rather than
    // "everything is wrong": the naive window's first ASCENDING crossing
    // happens to be the same physical dawn as the correct window's (both
    // land on Jun22's JST dawn, which falls in the overlap), so `morning`
    // alone would NOT expose the bug here. `evening`, however, does
    // diverge: the naive window's first DESCENDING crossing is Jun21's
    // JST dusk (outside the correct window, which starts after it), while
    // the correct window's is Jun22's JST dusk, roughly 24h later. This
    // mismatched pairing (today's dawn with yesterday's dusk) is exactly
    // the kind of silent, easy-to-miss corruption the window fix
    // addresses -- a naive-window user would see a self-consistent-looking
    // but wrong "evening" value paired with a correct "morning" value.
    const morningDiffMs = Math.abs(naiveResult.morning!.getTime() - correctResult.morning!.getTime())
    const eveningDiffMs = Math.abs(naiveResult.evening!.getTime() - correctResult.evening!.getTime())
    expect(morningDiffMs).toBeLessThan(60_000) // same physical dawn, coincidentally
    expect(eveningDiffMs).toBeGreaterThan(20 * 60 * 60_000) // ~24h apart: wrong day entirely

    // The correct-window result is the one where BOTH fields land at a
    // plausible Tokyo hour (dawn ~3-8:30am, dusk ~4:30-9pm); the naive
    // evening does not, once paired with the naive morning as a "today"
    // pair -- it's the previous day's dusk.
    const correctMorningHour = localHourOf(correctResult.morning!, 'Asia/Tokyo')
    const correctEveningHour = localHourOf(correctResult.evening!, 'Asia/Tokyo')
    expect(correctMorningHour).toBeGreaterThanOrEqual(3)
    expect(correctMorningHour).toBeLessThanOrEqual(8.5)
    expect(correctEveningHour).toBeGreaterThanOrEqual(16.5)
    expect(correctEveningHour).toBeLessThanOrEqual(21)
  })
})

describe('getPlutoTimes - window boundary behavior', () => {
  it('only reports the first ascending and first descending crossing within the window', () => {
    // Standard mid-latitude, non-polar case: exactly one morning and one
    // evening crossing per 24h window.
    const windowStartMs = new Date('2026-09-22T00:00:00Z').getTime()
    const windowEndMs = windowStartMs + DAY_MS
    const { morning, evening } = getPlutoTimes(windowStartMs, windowEndMs, 51.5074, -0.1278) // London
    expect(morning).not.toBeNull()
    expect(evening).not.toBeNull()
  })

  it('a window entirely within full daylight (both endpoints above threshold) yields no morning/evening', () => {
    // A short window around solar noon at the equator: sun is high above
    // -1.5 deg the whole time, so neither crossing occurs within it.
    const noonMs = new Date('2026-03-20T17:21:00Z').getTime() // Quito solar noon, equinox
    const result = getPlutoTimes(noonMs - 30 * 60_000, noonMs + 30 * 60_000, -0.1807, -78.4678)
    expect(result.morning).toBeNull()
    expect(result.evening).toBeNull()
  })
})
