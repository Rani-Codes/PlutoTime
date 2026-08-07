// One-off/reproducible build script: transforms the raw GeoNames "cities15000"
// dump into the compact JSON bundled with the app for the manual city-search
// fallback. Not run automatically at `npm run build` — the dump is a ~3MB
// download and the output is small and stable enough to just commit.
//
// Source data: https://download.geonames.org/export/dump/cities15000.zip
// License: GeoNames data is CC BY 4.0 — attribution is given in the app's
// README and About text ("Location data (c) GeoNames.org, CC BY 4.0").
//
// Usage: node scripts/build-cities.mjs <path-to-cities15000.txt> <top-n>

import { readFileSync, writeFileSync } from 'node:fs'

const [, , inputPath, topNArg] = process.argv
if (!inputPath) {
  console.error('Usage: node scripts/build-cities.mjs <cities15000.txt> [topN=5000]')
  process.exit(1)
}
const topN = topNArg ? Number.parseInt(topNArg, 10) : 5000

// GeoNames cities15000.txt columns (tab-separated, no header row):
// 0 geonameid, 1 name, 2 asciiname, 3 alternatenames, 4 latitude, 5 longitude,
// 6 feature class, 7 feature code, 8 country code, 9 cc2, 10 admin1 code,
// 11 admin2 code, 12 admin3 code, 13 admin4 code, 14 population, 15 elevation,
// 16 dem, 17 timezone, 18 modification date
const raw = readFileSync(inputPath, 'utf-8')
const lines = raw.split('\n').filter((line) => line.trim().length > 0)

const rows = lines.map((line) => {
  const cols = line.split('\t')
  return {
    name: cols[2], // asciiname — avoids diacritics that complicate search matching
    country: cols[8],
    lat: Number.parseFloat(cols[4]),
    lon: Number.parseFloat(cols[5]),
    tz: cols[17],
    population: Number.parseInt(cols[14], 10) || 0,
  }
})

rows.sort((a, b) => b.population - a.population)
const top = rows.slice(0, topN)

// Round coordinates to 3 decimal places (~111m precision) — a manual city
// picker doesn't need street-level GPS precision, and this materially shrinks
// the gzipped bundle (see README for the size/city-count tradeoff).
// Array-of-arrays instead of keyed objects: field names aren't repeated
// per-row, which is a meaningful chunk of the gzipped size at this row count.
const compact = top.map((c) => [
  c.name,
  c.country,
  Math.round(c.lat * 1000) / 1000,
  Math.round(c.lon * 1000) / 1000,
  c.tz,
])

const outPath = new URL('../src/data/cities.json', import.meta.url)
writeFileSync(outPath, JSON.stringify(compact))

console.log(`Wrote ${compact.length} cities to ${outPath.pathname}`)
