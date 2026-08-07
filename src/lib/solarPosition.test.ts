import { describe, expect, it } from 'vitest'
import { getSolarElevation } from './solarPosition'

/**
 * Independent validation of `getSolarElevation` against externally-sourced
 * reference data. This file was written by a party that did NOT implement
 * `solarPosition.ts` — golden values below come from NOAA's own published
 * Solar Calculator output and, for a secondary cross-check, from a
 * different independent implementation (sunrise-sunset.org). None of these
 * numbers were derived by reading or re-deriving the implementation's own
 * formulas.
 *
 * === PRIMARY ORACLE: NOAA Solar Calculator ==============================
 *
 * Source: https://gml.noaa.gov/grad/solcalc/table.php?lat=<LAT>&lon=<LON>&year=2026
 * (NOAA Global Monitoring Laboratory Solar Calculator, "Create Sunrise/
 * Sunset Table for the Year" feature). Fetched 2026-08-07.
 *
 * That tool reports LOCAL sunrise/sunset/solar-noon clock times for the
 * IANA zone it auto-detects for the given lat/lon (shown in its own output
 * header, reproduced in the comments below). Those local times were
 * converted to UTC instants using Node's own ICU/Intl timezone database
 * (`Intl.DateTimeFormat` fixed-point conversion) — a source completely
 * independent of this app's `timezone.ts` — via a one-off conversion
 * script, not by hand arithmetic.
 *
 * NOAA defines sunrise/sunset as the moment the sun's true geometric center
 * is at elevation -0.8333° (-(0.2667° solar radius + 0.5667° standard
 * refraction), applied to the geometric position) — this is exactly the
 * quantity `getSolarElevation` computes (see its doc comment: "returns the
 * sun's true geometric elevation... refraction is intentionally NOT
 * applied"). So comparing NOAA's sunrise/sunset instants against the time
 * `getSolarElevation` crosses -0.8333° is an apples-to-apples comparison.
 *
 * Tolerance: both NOAA's table and this app use the same family of
 * low-precision (Meeus/NOAA-spreadsheet-class) solar position formulas,
 * which the literature documents as sub-arcminute / sub-minute-of-time
 * accurate. We use a 2-minute-of-time tolerance for crossing times (tight
 * enough to catch a real formula bug, loose enough not to demand more
 * precision than a low-order truncated series can deliver) and a
 * 0.15°-of-elevation tolerance for direct elevation comparisons.
 *
 * === SECONDARY ORACLE: sunrise-sunset.org ================================
 *
 * A handful of cases are additionally cross-checked against
 * https://api.sunrise-sunset.org/json (a different, independently
 * maintained implementation of the sunrise equation, unrelated to both
 * NOAA and this app). Used as an outside-lineage gut check per the test
 * plan, with a slightly wider tolerance since it's a different algorithm
 * family entirely.
 */

const TIME_TOLERANCE_MS = 2 * 60_000 // 2 minutes
const ELEVATION_TOLERANCE_DEGREES = 0.15

/**
 * Finds, by bisection, the UTC instant nearest `nearMs` at which
 * `getSolarElevation` crosses `thresholdDegrees`. Independent of
 * `plutoTime.ts`'s bisection helper — written fresh for this test file so
 * we aren't reusing (and implicitly trusting) the implementation's own
 * crossing-finder.
 */
function findElevationCrossing(
  nearMs: number,
  thresholdDegrees: number,
  latitude: number,
  longitude: number,
): number {
  const elevationAt = (ms: number) => getSolarElevation(new Date(ms), latitude, longitude) - thresholdDegrees

  // Bracket the crossing: walk outward in 5-minute steps from `nearMs`
  // until we find a sign change. Search up to +/- 6 hours.
  const stepMs = 5 * 60_000
  const maxSteps = (6 * 60 * 60_000) / stepMs

  const signAtNear = Math.sign(elevationAt(nearMs))
  let lo = nearMs
  let hi = nearMs
  let loSign = signAtNear
  let found = false

  for (let i = 1; i <= maxSteps; i++) {
    const candidateHi = nearMs + i * stepMs
    const candidateLo = nearMs - i * stepMs
    const signHi = Math.sign(elevationAt(candidateHi))
    if (signHi !== 0 && signHi !== loSign) {
      lo = candidateHi - stepMs
      hi = candidateHi
      found = true
      break
    }
    const signLo = Math.sign(elevationAt(candidateLo))
    if (signLo !== 0 && signLo !== loSign) {
      lo = candidateLo
      hi = candidateLo + stepMs
      found = true
      break
    }
  }

  if (!found) {
    throw new Error(`No crossing of ${thresholdDegrees}° found within 6h of ${new Date(nearMs).toISOString()}`)
  }

  loSign = Math.sign(elevationAt(lo))
  for (let i = 0; i < 40 && hi - lo > 1000; i++) {
    const mid = (lo + hi) / 2
    const midSign = Math.sign(elevationAt(mid))
    if (midSign === 0 || midSign === loSign) {
      lo = mid
    } else {
      hi = mid
    }
  }

  return Math.round((lo + hi) / 2)
}

interface NoaaCase {
  label: string
  lat: number
  lon: number
  date: string // ISO date, informational
  sunriseUtc: string
  sunsetUtc: string
  solarNoonUtc: string
}

// See file header for provenance. All local->UTC conversions done via
// Node's Intl/ICU tzdata, independent of this app's own timezone.ts.
const NOAA_CASES: NoaaCase[] = [
  // --- Near-equator (elevation swings fastest here) ---
  {
    label: 'Quito, Ecuador (equator) - equinox',
    lat: -0.1807,
    lon: -78.4678,
    date: '2026-03-20',
    sunriseUtc: '2026-03-20T11:18:00.000Z',
    sunsetUtc: '2026-03-20T23:24:00.000Z',
    solarNoonUtc: '2026-03-20T17:21:00.000Z',
  },
  {
    label: 'Quito, Ecuador (equator) - June solstice',
    lat: -0.1807,
    lon: -78.4678,
    date: '2026-06-21',
    sunriseUtc: '2026-06-21T11:12:00.000Z',
    sunsetUtc: '2026-06-21T23:19:00.000Z',
    solarNoonUtc: '2026-06-21T17:15:00.000Z',
  },
  {
    label: 'Quito, Ecuador (equator) - September equinox',
    lat: -0.1807,
    lon: -78.4678,
    date: '2026-09-22',
    sunriseUtc: '2026-09-22T11:03:00.000Z',
    sunsetUtc: '2026-09-22T23:10:00.000Z',
    solarNoonUtc: '2026-09-22T17:06:00.000Z',
  },
  {
    label: 'Singapore (near-equator, Asia, positive UTC offset) - June solstice',
    lat: 1.3521,
    lon: 103.8198,
    date: '2026-06-21',
    sunriseUtc: '2026-06-20T23:00:00.000Z',
    sunsetUtc: '2026-06-21T11:12:00.000Z',
    solarNoonUtc: '2026-06-21T05:06:00.000Z',
  },
  {
    label: 'Singapore (near-equator) - December solstice',
    lat: 1.3521,
    lon: 103.8198,
    date: '2026-12-21',
    sunriseUtc: '2026-12-20T23:01:00.000Z',
    sunsetUtc: '2026-12-21T11:04:00.000Z',
    solarNoonUtc: '2026-12-21T05:02:00.000Z',
  },
  {
    label: 'Nairobi, Kenya (near-equator, southern hemisphere) - equinox',
    lat: -1.2921,
    lon: 36.8219,
    date: '2026-09-22',
    sunriseUtc: '2026-09-22T03:22:00.000Z',
    sunsetUtc: '2026-09-22T15:29:00.000Z',
    solarNoonUtc: '2026-09-22T09:25:00.000Z',
  },
  {
    label: 'Nairobi, Kenya - December solstice',
    lat: -1.2921,
    lon: 36.8219,
    date: '2026-12-21',
    sunriseUtc: '2026-12-21T03:25:00.000Z',
    sunsetUtc: '2026-12-21T15:37:00.000Z',
    solarNoonUtc: '2026-12-21T09:30:00.000Z',
  },

  // --- Southern hemisphere, mid-latitude ---
  {
    label: 'Sydney, Australia (southern hemisphere) - equinox',
    lat: -33.8688,
    lon: 151.2093,
    date: '2026-03-20',
    sunriseUtc: '2026-03-19T19:58:00.000Z',
    sunsetUtc: '2026-03-20T08:07:00.000Z',
    solarNoonUtc: '2026-03-20T02:02:00.000Z',
  },
  {
    label: 'Sydney, Australia - June solstice (southern winter)',
    lat: -33.8688,
    lon: 151.2093,
    date: '2026-06-21',
    sunriseUtc: '2026-06-20T21:00:00.000Z',
    sunsetUtc: '2026-06-21T06:54:00.000Z',
    solarNoonUtc: '2026-06-21T01:56:00.000Z',
  },
  {
    label: 'Sydney, Australia - December solstice (southern summer)',
    lat: -33.8688,
    lon: 151.2093,
    date: '2026-12-21',
    sunriseUtc: '2026-12-20T18:41:00.000Z',
    sunsetUtc: '2026-12-21T09:05:00.000Z',
    solarNoonUtc: '2026-12-21T01:52:00.000Z',
  },
  {
    label: 'Cape Town, South Africa - equinox',
    lat: -33.9249,
    lon: 18.4241,
    date: '2026-03-20',
    sunriseUtc: '2026-03-20T04:49:00.000Z',
    sunsetUtc: '2026-03-20T16:58:00.000Z',
    solarNoonUtc: '2026-03-20T10:53:00.000Z',
  },
  {
    label: 'Cape Town, South Africa - June solstice (southern winter)',
    lat: -33.9249,
    lon: 18.4241,
    date: '2026-06-21',
    sunriseUtc: '2026-06-21T05:51:00.000Z',
    sunsetUtc: '2026-06-21T15:45:00.000Z',
    solarNoonUtc: '2026-06-21T10:48:00.000Z',
  },
  {
    label: 'Cape Town, South Africa - December solstice (southern summer)',
    lat: -33.9249,
    lon: 18.4241,
    date: '2026-12-21',
    sunriseUtc: '2026-12-21T03:32:00.000Z',
    sunsetUtc: '2026-12-21T17:57:00.000Z',
    solarNoonUtc: '2026-12-21T10:44:00.000Z',
  },

  // --- Northern mid/high latitude, non-UTC longitude ---
  {
    label: 'New York, USA (negative UTC offset, DST) - equinox',
    lat: 40.7128,
    lon: -74.006,
    date: '2026-03-20',
    sunriseUtc: '2026-03-20T10:59:00.000Z',
    sunsetUtc: '2026-03-20T23:08:00.000Z',
    solarNoonUtc: '2026-03-20T17:03:00.000Z',
  },
  {
    label: 'New York, USA - June solstice',
    lat: 40.7128,
    lon: -74.006,
    date: '2026-06-21',
    sunriseUtc: '2026-06-21T09:25:00.000Z',
    sunsetUtc: '2026-06-22T00:31:00.000Z',
    solarNoonUtc: '2026-06-21T16:57:00.000Z',
  },
  {
    label: 'New York, USA - December solstice (standard time)',
    lat: 40.7128,
    lon: -74.006,
    date: '2026-12-21',
    sunriseUtc: '2026-12-21T12:17:00.000Z',
    sunsetUtc: '2026-12-21T21:32:00.000Z',
    solarNoonUtc: '2026-12-21T16:53:00.000Z',
  },
  {
    label: 'Tokyo, Japan (positive UTC offset, no DST) - equinox',
    lat: 35.6762,
    lon: 139.6917,
    date: '2026-03-20',
    sunriseUtc: '2026-03-19T20:46:00.000Z',
    sunsetUtc: '2026-03-20T08:53:00.000Z',
    solarNoonUtc: '2026-03-20T02:48:00.000Z',
  },
  {
    label: 'Tokyo, Japan - June solstice',
    lat: 35.6762,
    lon: 139.6917,
    date: '2026-06-21',
    sunriseUtc: '2026-06-20T19:26:00.000Z',
    sunsetUtc: '2026-06-21T10:00:00.000Z',
    solarNoonUtc: '2026-06-21T02:42:00.000Z',
  },
  {
    label: 'Tokyo, Japan - December solstice',
    lat: 35.6762,
    lon: 139.6917,
    date: '2026-12-21',
    sunriseUtc: '2026-12-20T21:47:00.000Z',
    sunsetUtc: '2026-12-21T07:31:00.000Z',
    solarNoonUtc: '2026-12-21T02:38:00.000Z',
  },

  // --- High latitude, non-polar days (rapid day-length change) ---
  {
    label: 'Utqiagvik (Barrow), Alaska - spring (well outside polar day/night)',
    lat: 71.2906,
    lon: -156.7887,
    date: '2026-04-15',
    sunriseUtc: '2026-04-15T14:10:00.000Z',
    sunsetUtc: '2026-04-16T06:47:00.000Z',
    solarNoonUtc: '2026-04-15T22:27:00.000Z',
  },
  {
    label: 'Utqiagvik (Barrow), Alaska - equinox',
    lat: 71.2906,
    lon: -156.7887,
    date: '2026-09-22',
    sunriseUtc: '2026-09-22T16:08:00.000Z',
    sunsetUtc: '2026-09-23T04:29:00.000Z',
    solarNoonUtc: '2026-09-22T22:19:00.000Z',
  },
  {
    label: 'Tromso, Norway - spring (well outside polar day/night)',
    lat: 69.6492,
    lon: 18.9553,
    date: '2026-04-15',
    sunriseUtc: '2026-04-15T02:43:00.000Z',
    sunsetUtc: '2026-04-15T18:49:00.000Z',
    solarNoonUtc: '2026-04-15T10:44:00.000Z',
  },
  {
    label: 'McMurdo Station, Antarctica - equinox (southern high latitude)',
    lat: -77.8419,
    lon: 166.6863,
    date: '2026-09-22',
    sunriseUtc: '2026-09-21T18:39:00.000Z',
    sunsetUtc: '2026-09-22T06:57:00.000Z',
    solarNoonUtc: '2026-09-22T00:46:00.000Z',
  },
]

describe('getSolarElevation vs NOAA Solar Calculator (primary oracle)', () => {
  for (const c of NOAA_CASES) {
    describe(c.label, () => {
      it(`sunrise crossing (-0.8333°) is within ${TIME_TOLERANCE_MS / 60_000} min of NOAA`, () => {
        const noaaMs = new Date(c.sunriseUtc).getTime()
        const crossingMs = findElevationCrossing(noaaMs, -0.8333, c.lat, c.lon)
        expect(Math.abs(crossingMs - noaaMs)).toBeLessThanOrEqual(TIME_TOLERANCE_MS)
      })

      it(`sunset crossing (-0.8333°) is within ${TIME_TOLERANCE_MS / 60_000} min of NOAA`, () => {
        const noaaMs = new Date(c.sunsetUtc).getTime()
        const crossingMs = findElevationCrossing(noaaMs, -0.8333, c.lat, c.lon)
        expect(Math.abs(crossingMs - noaaMs)).toBeLessThanOrEqual(TIME_TOLERANCE_MS)
      })

      it('elevation at NOAA-reported sunrise instant is close to -0.8333°', () => {
        const elevation = getSolarElevation(new Date(c.sunriseUtc), c.lat, c.lon)
        expect(Math.abs(elevation - -0.8333)).toBeLessThanOrEqual(ELEVATION_TOLERANCE_DEGREES)
      })

      it('elevation at NOAA-reported sunset instant is close to -0.8333°', () => {
        const elevation = getSolarElevation(new Date(c.sunsetUtc), c.lat, c.lon)
        expect(Math.abs(elevation - -0.8333)).toBeLessThanOrEqual(ELEVATION_TOLERANCE_DEGREES)
      })

      it('solar noon is a local maximum of elevation (within +/- 20 min)', () => {
        const noonMs = new Date(c.solarNoonUtc).getTime()
        const atNoon = getSolarElevation(new Date(noonMs), c.lat, c.lon)
        const before = getSolarElevation(new Date(noonMs - 20 * 60_000), c.lat, c.lon)
        const after = getSolarElevation(new Date(noonMs + 20 * 60_000), c.lat, c.lon)
        expect(atNoon).toBeGreaterThanOrEqual(before)
        expect(atNoon).toBeGreaterThanOrEqual(after)
      })
    })
  }
})

describe('getSolarElevation vs sunrise-sunset.org (secondary, independent-algorithm oracle)', () => {
  // Source: https://api.sunrise-sunset.org/json?lat=<LAT>&lng=<LON>&date=<DATE>&formatted=0
  // A different, independently maintained implementation of the sunrise
  // equation (unrelated to NOAA and to this app). Fetched 2026-08-07.
  // Wider tolerance (5 min) since this is cross-checking against a
  // different algorithm family, not the same one NOAA/this app both use.
  const SECONDARY_TOLERANCE_MS = 5 * 60_000

  const SECONDARY_CASES: NoaaCase[] = [
    {
      label: 'New York - equinox (sunrise-sunset.org)',
      lat: 40.7128,
      lon: -74.006,
      date: '2026-03-20',
      sunriseUtc: '2026-03-20T10:57:28.000Z',
      sunsetUtc: '2026-03-20T23:09:21.000Z',
      solarNoonUtc: '2026-03-20T17:03:25.000Z',
    },
    {
      label: 'Tokyo - June solstice (sunrise-sunset.org)',
      lat: 35.6762,
      lon: 139.6917,
      date: '2026-06-21',
      sunriseUtc: '2026-06-20T19:24:13.000Z',
      sunsetUtc: '2026-06-21T10:01:43.000Z',
      solarNoonUtc: '2026-06-21T02:42:58.000Z',
    },
    {
      label: 'Sydney - December solstice (sunrise-sunset.org)',
      lat: -33.8688,
      lon: 151.2093,
      date: '2026-12-21',
      sunriseUtc: '2026-12-20T18:39:17.000Z',
      sunsetUtc: '2026-12-21T09:06:45.000Z',
      solarNoonUtc: '2026-12-21T01:53:01.000Z',
    },
    {
      label: 'Quito - equinox (sunrise-sunset.org)',
      lat: -0.1807,
      lon: -78.4678,
      date: '2026-09-22',
      sunriseUtc: '2026-09-22T11:02:06.000Z',
      sunsetUtc: '2026-09-22T23:10:53.000Z',
      solarNoonUtc: '2026-09-22T17:06:30.000Z',
    },
    {
      label: 'Cape Town - June solstice (sunrise-sunset.org)',
      lat: -33.9249,
      lon: 18.4241,
      date: '2026-06-21',
      sunriseUtc: '2026-06-21T05:49:55.000Z',
      sunsetUtc: '2026-06-21T15:46:18.000Z',
      solarNoonUtc: '2026-06-21T10:48:07.000Z',
    },
    {
      label: 'Nairobi - December solstice (sunrise-sunset.org)',
      lat: -1.2921,
      lon: 36.8219,
      date: '2026-12-21',
      sunriseUtc: '2026-12-21T03:23:40.000Z',
      sunsetUtc: '2026-12-21T15:37:47.000Z',
      solarNoonUtc: '2026-12-21T09:30:43.000Z',
    },
  ]

  for (const c of SECONDARY_CASES) {
    it(`${c.label}: sunrise crossing within ${SECONDARY_TOLERANCE_MS / 60_000} min`, () => {
      const refMs = new Date(c.sunriseUtc).getTime()
      const crossingMs = findElevationCrossing(refMs, -0.8333, c.lat, c.lon)
      expect(Math.abs(crossingMs - refMs)).toBeLessThanOrEqual(SECONDARY_TOLERANCE_MS)
    })

    it(`${c.label}: sunset crossing within ${SECONDARY_TOLERANCE_MS / 60_000} min`, () => {
      const refMs = new Date(c.sunsetUtc).getTime()
      const crossingMs = findElevationCrossing(refMs, -0.8333, c.lat, c.lon)
      expect(Math.abs(crossingMs - refMs)).toBeLessThanOrEqual(SECONDARY_TOLERANCE_MS)
    })
  }
})

describe('getSolarElevation - polar day/night sanity (qualitative, well-documented facts)', () => {
  // These are not precise numeric golden values but well-established,
  // widely published astronomical facts independent of any calculator:
  // Utqiagvik (Barrow), AK (71.29N) has no sunrise for ~2 months around the
  // winter solstice (~Nov 18 - Jan 22) and 24h daylight for ~2.5 months
  // around the summer solstice (~May 10 - Aug 2). McMurdo Station,
  // Antarctica (77.84S) is the mirror image on the opposite six months.

  it('Barrow, AK: sun stays below -1.5 the entire day at winter solstice (polar night)', () => {
    const lat = 71.2906
    const lon = -156.7887
    // Sample every 30 minutes across the UTC day containing local Dec 21 noon.
    const noonUtc = new Date('2026-12-21T21:00:00.000Z').getTime()
    for (let offset = -12 * 60; offset <= 12 * 60; offset += 30) {
      const elevation = getSolarElevation(new Date(noonUtc + offset * 60_000), lat, lon)
      expect(elevation).toBeLessThan(-1.5)
    }
  })

  it('Barrow, AK: sun stays above -1.5 the entire day at summer solstice (midnight sun)', () => {
    const lat = 71.2906
    const lon = -156.7887
    const noonUtc = new Date('2026-06-21T21:00:00.000Z').getTime()
    for (let offset = -12 * 60; offset <= 12 * 60; offset += 30) {
      const elevation = getSolarElevation(new Date(noonUtc + offset * 60_000), lat, lon)
      expect(elevation).toBeGreaterThan(-1.5)
    }
  })

  it('McMurdo, Antarctica: sun stays above -1.5 the entire day at (southern) summer solstice', () => {
    const lat = -77.8419
    const lon = 166.6863
    const noonUtc = new Date('2026-12-21T00:46:00.000Z').getTime()
    for (let offset = -12 * 60; offset <= 12 * 60; offset += 30) {
      const elevation = getSolarElevation(new Date(noonUtc + offset * 60_000), lat, lon)
      expect(elevation).toBeGreaterThan(-1.5)
    }
  })

  it('McMurdo, Antarctica: sun stays below -1.5 the entire day at (southern) winter solstice', () => {
    const lat = -77.8419
    const lon = 166.6863
    const noonUtc = new Date('2026-06-21T00:00:00.000Z').getTime()
    for (let offset = -12 * 60; offset <= 12 * 60; offset += 30) {
      const elevation = getSolarElevation(new Date(noonUtc + offset * 60_000), lat, lon)
      expect(elevation).toBeLessThan(-1.5)
    }
  })
})

describe('getSolarElevation - basic geometric sanity', () => {
  it('returns close to +90 at the north pole during its 6-month "day", near the June solstice', () => {
    // North pole: elevation should be ~= solar declination, which peaks at
    // ~23.44 near the June solstice.
    const elevation = getSolarElevation(new Date('2026-06-21T12:00:00.000Z'), 90, 0)
    expect(elevation).toBeGreaterThan(23)
    expect(elevation).toBeLessThan(23.6)
  })

  it('is symmetric-ish: equator elevation at local solar noon on an equinox is close to 90', () => {
    // On the equinox, at the equator, the sun should pass very close to
    // the zenith at local solar noon.
    const elevation = getSolarElevation(new Date('2026-03-20T17:21:00.000Z'), -0.1807, -78.4678)
    expect(elevation).toBeGreaterThan(89)
  })

  it('longitude shifts the elevation curve by exactly 4 minutes of time per degree', () => {
    // Two points at the same latitude, 15 degrees apart in longitude, see
    // the same elevation profile shifted by exactly 15*4 = 60 minutes:
    // elevation(T, lonA) should equal elevation(T + 60min, lonA - 15) since
    // the second point is 15 degrees further west (i.e. its local solar
    // time is 60 minutes behind). This is pure hour-angle geometry, not an
    // externally-sourced number, but it's a strong internal-consistency
    // check on the longitude term independent of the NOAA cases above.
    const lat = 20
    const baseMs = new Date('2026-06-21T10:00:00.000Z').getTime()
    const elevationA = getSolarElevation(new Date(baseMs), lat, 30)
    const elevationB = getSolarElevation(new Date(baseMs + 60 * 60_000), lat, 15)
    expect(Math.abs(elevationA - elevationB)).toBeLessThan(0.01)
  })
})
