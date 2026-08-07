import { useMemo } from 'react'
import { getPlutoTimes, type PlutoTimeResult } from '../lib/plutoTime'
import { getLocalDayWindow } from '../lib/timezone'
import type { Location } from '../lib/location'

/** Computes today's Pluto Time crossings for a location, in that location's own local calendar day. */
export function usePlutoTime(location: Location | null): PlutoTimeResult | null {
  return useMemo(() => {
    if (!location) return null
    const { startMs, endMs } = getLocalDayWindow(location.tz)
    return getPlutoTimes(startMs, endMs, location.lat, location.lon)
  }, [location])
}
