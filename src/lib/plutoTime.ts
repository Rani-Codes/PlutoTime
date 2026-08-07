import { getSolarElevation } from './solarPosition'

/**
 * The sun elevation (degrees below the horizon) at which ambient sky
 * brightness on Earth is said to roughly match noon sunlight on Pluto's
 * surface. This -1.5° figure is the number NASA's own "Pluto Time" outreach
 * material and every independent reproduction of it (blog posts, calculator
 * apps, etc.) converge on, but NASA's original archived write-up does not
 * pin it down with a rigorous derivation or error bar — it's a popular-
 * science rule of thumb, not a metrology-grade constant. We treat it as
 * this app's single source of truth and isolate it here, as a named
 * constant, specifically so it's a one-line change if a better-sourced
 * figure ever surfaces.
 */
export const PLUTO_TIME_ELEVATION_DEGREES = -1.5

export interface PlutoTimeResult {
  /** Today's dawn crossing of the threshold, ascending. `null` if the sun's elevation never reaches it (e.g. polar winter, where the sun stays below -1.5° all day). */
  morning: Date | null
  /** Today's dusk crossing of the threshold, descending. `null` if the sun's elevation never drops to it (e.g. polar summer, where the sun stays above -1.5° all day). */
  evening: Date | null
}

const MINUTES_PER_MS = 1 / 60_000

// Coarse sampling step used to bracket the crossing(s). Solar elevation is a
// smooth, slowly-varying function of time (it moves at most ~0.5°/minute
// even at the equator on an equinox), so a 10-minute grid cannot skip past a
// crossing of a threshold as shallow as -1.5°; the subsequent bisection pass
// then refines whichever bracket is found down to well under a minute.
const SAMPLE_INTERVAL_MINUTES = 10
const SAMPLE_INTERVAL_MS = SAMPLE_INTERVAL_MINUTES * 60_000

// Bisection stops once the bracket is narrower than this — 15 seconds gives
// "to the minute or better" crossing times with a comfortable margin.
const BISECTION_TOLERANCE_MS = 15_000
// Hard cap so a pathological input can never spin forever; a 10-minute
// bracket converges to 15s in well under 20 halvings, so this is generous.
const MAX_BISECTION_ITERATIONS = 40

function elevationAtTime(timestampMs: number, latitude: number, longitude: number): number {
  return getSolarElevation(new Date(timestampMs), latitude, longitude)
}

/**
 * Refines a bracket [lowMs, highMs] — known to contain exactly one crossing
 * of PLUTO_TIME_ELEVATION_DEGREES, with elevation(lowMs) on one side of the
 * threshold and elevation(highMs) on the other — down to a single instant
 * via bisection. Plain bisection (rather than something faster like secant)
 * is used because it's unconditionally stable: solar elevation is smooth
 * but not linear, and we'd rather have a guaranteed-converging root finder
 * than a marginally faster one that can misbehave near a very shallow
 * crossing (e.g. high-latitude summer, where the curve grazes the threshold
 * almost tangentially).
 */
function bisectCrossing(
  lowMs: number,
  highMs: number,
  lowDiffSign: number,
  latitude: number,
  longitude: number,
): Date {
  let lo = lowMs
  let hi = highMs
  let loSign = lowDiffSign

  for (let i = 0; i < MAX_BISECTION_ITERATIONS && hi - lo > BISECTION_TOLERANCE_MS; i++) {
    const mid = (lo + hi) / 2
    const midDiff = elevationAtTime(mid, latitude, longitude) - PLUTO_TIME_ELEVATION_DEGREES
    const midSign = Math.sign(midDiff)

    if (midSign === 0 || midSign === loSign) {
      lo = mid
      loSign = midSign === 0 ? loSign : midSign
    } else {
      hi = mid
    }
  }

  return new Date(Math.round((lo + hi) / 2))
}

/**
 * Finds the times, within [windowStartMs, windowEndMs), that the sun's
 * elevation crosses PLUTO_TIME_ELEVATION_DEGREES ascending (dawn, "morning")
 * and descending (dusk, "evening").
 *
 * This module has no timezone database and deliberately doesn't reach for
 * one: it takes an explicit absolute-time window rather than a `Date` plus
 * an implied "calendar day", because there is no UTC-based rule that
 * correctly derives "today" for an arbitrary IANA timezone (naively
 * snapping to UTC midnight boundaries is wrong for most timezones — e.g. a
 * UTC-day window for Tokyo covers 09:00-09:00 JST, not Tokyo's actual local
 * day, and would silently report the wrong day's crossing). Computing the
 * correct local-midnight-to-next-local-midnight window for a given
 * timezone is a timezone-lookup concern, handled by the caller (see
 * `getLocalDayWindow` in `timezone.ts`) — entirely separate from the solar
 * geometry implemented here.
 *
 * A consequence of searching a fixed window: a location experiencing
 * multiple threshold crossings within one window (only possible transiently
 * near the poles, around the equinoxes) will only have its first ascending
 * and first descending crossing reported.
 */
export function getPlutoTimes(
  windowStartMs: number,
  windowEndMs: number,
  latitude: number,
  longitude: number,
): PlutoTimeResult {
  let morning: Date | null = null
  let evening: Date | null = null

  let prevTimeMs = windowStartMs
  let prevDiff = elevationAtTime(prevTimeMs, latitude, longitude) - PLUTO_TIME_ELEVATION_DEGREES

  for (let timeMs = windowStartMs + SAMPLE_INTERVAL_MS; timeMs <= windowEndMs; timeMs += SAMPLE_INTERVAL_MS) {
    const diff = elevationAtTime(timeMs, latitude, longitude) - PLUTO_TIME_ELEVATION_DEGREES
    const prevSign = Math.sign(prevDiff)
    const sign = Math.sign(diff)

    if (morning === null && prevSign <= 0 && sign > 0) {
      // Ascending: elevation moved from at-or-below the threshold to above it.
      morning = bisectCrossing(prevTimeMs, timeMs, prevSign === 0 ? -1 : prevSign, latitude, longitude)
    } else if (evening === null && prevSign >= 0 && sign < 0) {
      // Descending: elevation moved from at-or-above the threshold to below it.
      evening = bisectCrossing(prevTimeMs, timeMs, prevSign === 0 ? 1 : prevSign, latitude, longitude)
    }

    prevTimeMs = timeMs
    prevDiff = diff

    if (morning !== null && evening !== null) break
  }

  return { morning, evening }
}

// Re-exported only for readability of the bisection tolerance in minutes,
// should a future reader want to reason about precision without doing the
// division themselves.
export const PLUTO_TIME_PRECISION_MINUTES = BISECTION_TOLERANCE_MS * MINUTES_PER_MS
