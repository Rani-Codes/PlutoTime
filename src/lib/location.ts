import type { City } from '../data/cities'

export interface Location {
  label: string
  lat: number
  lon: number
  /** IANA timezone identifier used to render results in local time. */
  tz: string
}

/**
 * Builds a Location from browser geolocation coordinates. The browser gives
 * us lat/lon but not a timezone, so we pair it with the runtime's own IANA
 * zone via Intl — accurate as long as the device's timezone matches its
 * physical location, which holds for the overwhelming majority of visitors
 * (the rare mismatch, e.g. a travelling device with an unchanged system
 * clock, is an accepted edge case rather than something worth a geocoding
 * API call for).
 */
export function locationFromCoords(lat: number, lon: number): Location {
  return {
    label: 'Your location',
    lat,
    lon,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

export function locationFromCity(city: City): Location {
  return {
    label: `${city.name}, ${city.country}`,
    lat: city.lat,
    lon: city.lon,
    tz: city.tz,
  }
}
