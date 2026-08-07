export interface City {
  name: string
  /** ISO 3166-1 alpha-2 country code, e.g. "US" */
  country: string
  lat: number
  lon: number
  /** IANA timezone identifier, e.g. "America/New_York" */
  tz: string
}

// Row shape matches scripts/build-cities.mjs's compact array-of-arrays output:
// [name, country, lat, lon, tz]. Kept as a tuple instead of {name, country, ...}
// objects to avoid repeating field names ~5000 times in the bundled JSON.
type CityRow = [string, string, number, number, string]

function rowToCity(row: CityRow): City {
  const [name, country, lat, lon, tz] = row
  return { name, country, lat, lon, tz }
}

let citiesPromise: Promise<City[]> | null = null

/**
 * Lazily loads the bundled city dataset (~87KB gzipped) as its own chunk, so
 * it's only fetched when a user actually opens manual city search — not on
 * initial page load, where geolocation is the primary path.
 *
 * Location data (c) GeoNames.org, CC BY 4.0 — see README for attribution.
 */
export async function loadCities(): Promise<City[]> {
  citiesPromise ??= import('./cities.json').then((mod) =>
    (mod.default as CityRow[]).map(rowToCity),
  )
  return citiesPromise
}
