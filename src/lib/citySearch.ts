import Fuse from 'fuse.js'
import { loadCities, type City } from '../data/cities'

let fusePromise: Promise<Fuse<City>> | null = null

function getFuse(): Promise<Fuse<City>> {
  fusePromise ??= loadCities().then(
    (cities) =>
      new Fuse(cities, {
        keys: ['name', 'country'],
        threshold: 0.3, // tolerates a few typos without matching too loosely
        ignoreLocation: true, // match "nwyork" -> "New York", not just prefixes
      }),
  )
  return fusePromise
}

export async function searchCities(query: string, limit = 8): Promise<City[]> {
  if (query.trim().length === 0) return []
  const fuse = await getFuse()
  return fuse
    .search(query, { limit })
    .map((result) => result.item)
}
