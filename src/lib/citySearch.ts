import Fuse from 'fuse.js'
import { loadCities, type City } from '../data/cities'

let fuseAndCountPromise: Promise<{ fuse: Fuse<City>; count: number }> | null = null

function getFuse(): Promise<{ fuse: Fuse<City>; count: number }> {
  fuseAndCountPromise ??= loadCities().then((cities) => ({
    fuse: new Fuse(cities, {
      keys: ['name', 'country'],
      threshold: 0.4, // tolerates a few typos (e.g. "nwyork" -> "New York City") without matching too loosely
      ignoreLocation: true, // match "nwyork" -> "New York", not just prefixes
      minMatchCharLength: 2,
      includeScore: true,
    }),
    count: cities.length,
  }))
  return fuseAndCountPromise
}

// Pool of raw matches considered before re-ranking — wider than what's shown,
// so a popular city with a slightly-worse text score still has a chance to
// out-rank an obscure near-perfect one.
const RAW_MATCH_POOL_SIZE = 25

export async function searchCities(query: string, limit = 8): Promise<City[]> {
  if (query.trim().length === 0) return []
  const { fuse, count } = await getFuse()
  const results = fuse.search(query, { limit: RAW_MATCH_POOL_SIZE })

  // The dataset (src/data/cities.ts / cities.json) is generated pre-sorted by
  // population descending, so a match's index into it doubles as a "how
  // prominent is this place" signal — cheaper than shipping population
  // numbers just for search ranking. Blended in as a minority weight so it
  // breaks near-ties (favoring the city users actually mean) without letting
  // a big-but-irrelevant city outrank a strong text match.
  const blended = results.map((result) => {
    const popularityPenalty = (result.refIndex / count) * 0.15
    return { item: result.item, rank: (result.score ?? 0) + popularityPenalty }
  })
  blended.sort((a, b) => a.rank - b.rank)

  return blended.slice(0, limit).map((r) => r.item)
}
