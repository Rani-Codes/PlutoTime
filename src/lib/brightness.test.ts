import { describe, expect, it } from 'vitest'
import { estimateIlluminanceLux, getBrightnessRatio } from './brightness'
import { PLUTO_TIME_ELEVATION_DEGREES } from './plutoTime'

/**
 * Validation of brightness.ts against its own documented anchor points
 * (these are stated, citable constants in the module's own doc comments --
 * checking the code reproduces its own documented anchors is a legitimate
 * regression/sanity test, distinct from re-deriving them from an outside
 * source, which the module's doc comment already says is "commonly-cited
 * ... photometry tables", not something with a single authoritative
 * source we can independently fetch), plus structural properties
 * (monotonicity) and a cross-module consistency check against
 * plutoTime.ts's independently-chosen -1.5 degree constant.
 */

describe('estimateIlluminanceLux - documented anchor points', () => {
  it('~400 lux at elevation 0 (horizon)', () => {
    expect(estimateIlluminanceLux(0)).toBeCloseTo(400, 5)
  })

  it('~3.4 lux at elevation -6 (end of civil twilight)', () => {
    expect(estimateIlluminanceLux(-6)).toBeCloseTo(3.4, 5)
  })

  it('~0.008 lux at elevation -12 (end of nautical twilight)', () => {
    expect(estimateIlluminanceLux(-12)).toBeCloseTo(0.008, 5)
  })

  it('~0.0008 lux at elevation -18 (end of astronomical twilight)', () => {
    // NOTE: as written, this reproduces the module's own documented
    // anchor ("Illuminance at astronomical twilight's end, lux" @
    // ASTRONOMICAL_TWILIGHT_ELEVATION_DEGREES = -18). The -6 and -12
    // anchors are each exactly reproduced by the *next* branch's
    // `elevationDegrees > X` boundary (inclusive from the other side,
    // since the next segment's own start anchor equals the same value).
    // -18 has no such "next segment" to catch it: `elevationDegrees >
    // -18` is false at exactly -18, so it falls through to the flat
    // NIGHT_FLOOR_ILLUMINANCE_LUX (0.0005) instead of the documented
    // 0.0008 anchor. If this test fails, that boundary condition is the
    // reason -- see the test report for how far off it is.
    expect(estimateIlluminanceLux(-18)).toBeCloseTo(0.0008, 6)
  })

  it('flat floor (0.0005 lux) beyond -18', () => {
    expect(estimateIlluminanceLux(-19)).toBe(estimateIlluminanceLux(-25))
    expect(estimateIlluminanceLux(-30)).toBe(estimateIlluminanceLux(-90))
    expect(estimateIlluminanceLux(-25)).toBeCloseTo(0.0005, 6)
  })

  it('~100,000 lux at zenith (elevation 90)', () => {
    expect(estimateIlluminanceLux(90)).toBeCloseTo(100_000, 0)
  })

  it('elevations above 90 are clamped to 90 (zenith), not extrapolated', () => {
    expect(estimateIlluminanceLux(95)).toBeCloseTo(estimateIlluminanceLux(90), 5)
  })
})

describe('estimateIlluminanceLux - monotonicity', () => {
  it('is non-increasing as elevation decreases, over a fine sweep from 90 down to just above 0', () => {
    // Stops just above 0 deliberately: the module's own doc comment
    // discloses "a small, intentional discontinuity right at elevation
    // 0" (daytime power law -> 0 as elevation -> 0+, while the twilight
    // fit is anchored at ~400 lux at exactly 0), so a monotonic sweep
    // through that point is expected to jump, not a bug. That documented
    // jump is exercised on its own below; this sweep covers the daytime
    // segment only, where no such jump is documented or expected.
    let prev = Infinity
    for (let elevation = 90; elevation >= 0.01; elevation -= 0.1) {
      const value = estimateIlluminanceLux(elevation)
      expect(value).toBeLessThanOrEqual(prev + 1e-9)
      prev = value
    }
  })

  it('is non-increasing as elevation decreases, over a fine sweep from 0 down to -90', () => {
    let prev = Infinity
    for (let elevation = 0; elevation >= -90; elevation -= 0.1) {
      const value = estimateIlluminanceLux(elevation)
      expect(value).toBeLessThanOrEqual(prev + 1e-9)
      prev = value
    }
  })

  it('is strictly decreasing within each of the non-flat segments (fine sweep, spot-checked boundaries excluded)', () => {
    const segments: Array<[number, number]> = [
      [90, 0.1], // daytime power law (elevation must stay > 0)
      [-0.1, -5.9], // civil twilight
      [-6.1, -11.9], // nautical twilight
      [-12.1, -17.9], // astronomical twilight
    ]
    for (const [start, end] of segments) {
      let prev = estimateIlluminanceLux(start)
      for (let elevation = start - 0.1; elevation >= end; elevation -= 0.1) {
        const value = estimateIlluminanceLux(elevation)
        expect(value).toBeLessThan(prev)
        prev = value
      }
    }
  })
})

describe('estimateIlluminanceLux - discontinuity at elevation 0 (documented, intentional)', () => {
  it('daytime side approaches 0 as elevation -> 0+, while twilight side is anchored at 400', () => {
    expect(estimateIlluminanceLux(0.001)).toBeLessThan(1)
    expect(estimateIlluminanceLux(0)).toBeCloseTo(400, 5)
  })
})

describe('getBrightnessRatio - cross-module consistency with plutoTime.ts', () => {
  it('ratio at elevation 0 is > 1 (well above Pluto-noon brightness)', () => {
    expect(getBrightnessRatio(0)).toBeGreaterThan(1)
  })

  it('ratio decreases as elevation decreases (monotonic, mirrors illuminance)', () => {
    expect(getBrightnessRatio(-1)).toBeGreaterThan(getBrightnessRatio(-2))
    expect(getBrightnessRatio(-2)).toBeGreaterThan(getBrightnessRatio(-3))
  })

  /**
   * This is the important cross-check called out in the test plan: Pluto
   * Time is *defined* (in plutoTime.ts) as the elevation at which ambient
   * brightness matches Pluto-noon brightness. If brightness.ts's own
   * independently-chosen constants (ZENITH_ILLUMINANCE_LUX, the twilight
   * anchor points, PLUTO_NOON_ILLUMINANCE_LUX) were chosen consistently
   * with plutoTime.ts's PLUTO_TIME_ELEVATION_DEGREES = -1.5, then
   * getBrightnessRatio(-1.5) should come out close to 1.0. We use a
   * generous-but-meaningful band (0.5x-2x, i.e. within one "half stop") to
   * account for this being two independently-curated sets of ballpark
   * photometry figures, not a single calibrated model -- but a ratio far
   * outside that band would indicate the two modules' constants don't
   * actually agree with each other, which would be a real inconsistency
   * worth flagging.
   */
  it('ratio at -1.5 degrees (the Pluto Time threshold) is reasonably close to 1.0', () => {
    const ratio = getBrightnessRatio(PLUTO_TIME_ELEVATION_DEGREES)
    expect(ratio).toBeGreaterThan(0.5)
    expect(ratio).toBeLessThan(2.0)
  })
})
