import { useEffect, useState } from 'react'
import { getSolarElevation } from '../lib/solarPosition'
import { getBrightnessRatio } from '../lib/brightness'
import type { Location } from '../lib/location'

const UPDATE_INTERVAL_MS = 30_000

/** Live "brightness as a ratio of Pluto-noon brightness" for a location, refreshed periodically. */
export function useLiveBrightness(location: Location | null): number | null {
  const [ratio, setRatio] = useState<number | null>(null)

  useEffect(() => {
    if (!location) {
      setRatio(null)
      return
    }

    const update = () => {
      const elevation = getSolarElevation(new Date(), location.lat, location.lon)
      setRatio(getBrightnessRatio(elevation))
    }

    update()
    const id = setInterval(update, UPDATE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [location])

  return ratio
}
