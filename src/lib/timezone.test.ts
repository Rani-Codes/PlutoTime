import { describe, expect, it } from 'vitest'
import { getLocalDayWindow } from './timezone'

/**
 * Independent validation of `getLocalDayWindow` against well-documented,
 * publicly known UTC offsets for a handful of IANA timezones — including a
 * half-hour offset zone, a 45-minute offset zone, and a DST-observing zone
 * checked at both a standard-time and a daylight-time date. These offsets
 * are common-knowledge facts (not derived from this codebase):
 *
 *  - Asia/Kolkata (India Standard Time): fixed UTC+5:30, no DST, ever.
 *  - Asia/Kathmandu (Nepal Time): fixed UTC+5:45, no DST, ever.
 *  - America/New_York: UTC-5 (EST) in January, UTC-4 (EDT) in July.
 *  - Australia/Sydney: UTC+11 (AEDT) in January (southern-hemisphere
 *    summer DST), UTC+10 (AEST) in July (southern-hemisphere winter,
 *    standard time).
 */

const HOUR_MS = 60 * 60_000
const DAY_MS = 24 * HOUR_MS

describe('getLocalDayWindow', () => {
  it('Asia/Kolkata: window is exactly 24h and starts at local midnight (UTC+5:30, no DST)', () => {
    // 2026-07-15 00:00 IST == 2026-07-14 18:30 UTC
    const at = new Date('2026-07-15T10:00:00Z') // some instant during that IST day
    const { startMs, endMs } = getLocalDayWindow('Asia/Kolkata', at)
    expect(new Date(startMs).toISOString()).toBe('2026-07-14T18:30:00.000Z')
    expect(endMs - startMs).toBe(DAY_MS)
  })

  it('Asia/Kathmandu: window starts at local midnight (UTC+5:45, no DST)', () => {
    // 2026-07-15 00:00 NPT == 2026-07-14 18:15 UTC
    const at = new Date('2026-07-15T10:00:00Z')
    const { startMs, endMs } = getLocalDayWindow('Asia/Kathmandu', at)
    expect(new Date(startMs).toISOString()).toBe('2026-07-14T18:15:00.000Z')
    expect(endMs - startMs).toBe(DAY_MS)
  })

  it('America/New_York: window reflects EST (UTC-5) in January', () => {
    // 2026-01-15 00:00 EST == 2026-01-15 05:00 UTC
    const at = new Date('2026-01-15T15:00:00Z')
    const { startMs, endMs } = getLocalDayWindow('America/New_York', at)
    expect(new Date(startMs).toISOString()).toBe('2026-01-15T05:00:00.000Z')
    expect(endMs - startMs).toBe(DAY_MS)
  })

  it('America/New_York: window reflects EDT (UTC-4) in July', () => {
    // 2026-07-15 00:00 EDT == 2026-07-15 04:00 UTC
    const at = new Date('2026-07-15T15:00:00Z')
    const { startMs, endMs } = getLocalDayWindow('America/New_York', at)
    expect(new Date(startMs).toISOString()).toBe('2026-07-15T04:00:00.000Z')
    expect(endMs - startMs).toBe(DAY_MS)
  })

  it('Australia/Sydney: window reflects AEDT (UTC+11) in January (southern summer DST)', () => {
    // 2026-01-15 00:00 AEDT == 2026-01-14 13:00 UTC
    const at = new Date('2026-01-15T05:00:00Z')
    const { startMs, endMs } = getLocalDayWindow('Australia/Sydney', at)
    expect(new Date(startMs).toISOString()).toBe('2026-01-14T13:00:00.000Z')
    expect(endMs - startMs).toBe(DAY_MS)
  })

  it('Australia/Sydney: window reflects AEST (UTC+10) in July (southern winter, standard time)', () => {
    // 2026-07-15 00:00 AEST == 2026-07-14 14:00 UTC
    const at = new Date('2026-07-15T05:00:00Z')
    const { startMs, endMs } = getLocalDayWindow('Australia/Sydney', at)
    expect(new Date(startMs).toISOString()).toBe('2026-07-14T14:00:00.000Z')
    expect(endMs - startMs).toBe(DAY_MS)
  })

  it('UTC: window is exactly [midnight, next midnight]', () => {
    const at = new Date('2026-05-04T12:34:56Z')
    const { startMs, endMs } = getLocalDayWindow('UTC', at)
    expect(new Date(startMs).toISOString()).toBe('2026-05-04T00:00:00.000Z')
    expect(new Date(endMs).toISOString()).toBe('2026-05-05T00:00:00.000Z')
  })

  it('defaults `at` to now when omitted', () => {
    const before = Date.now()
    const { startMs, endMs } = getLocalDayWindow('UTC')
    const after = Date.now()
    expect(startMs).toBeLessThanOrEqual(before)
    expect(endMs).toBeGreaterThanOrEqual(after > startMs ? before : after)
    expect(endMs - startMs).toBe(DAY_MS)
  })

  it('the given instant always falls within its own returned window', () => {
    const cases: Array<[string, string]> = [
      ['Asia/Kolkata', '2026-07-15T10:00:00Z'],
      ['America/New_York', '2026-01-15T15:00:00Z'],
      ['Australia/Sydney', '2026-01-15T05:00:00Z'],
      ['Pacific/Kiritimati', '2026-03-01T00:00:00Z'],
    ]
    for (const [zone, iso] of cases) {
      const at = new Date(iso)
      const { startMs, endMs } = getLocalDayWindow(zone, at)
      expect(at.getTime()).toBeGreaterThanOrEqual(startMs)
      expect(at.getTime()).toBeLessThan(endMs)
    }
  })
})
