# PlutoTime

Sunlight is much weaker on Pluto than on Earth, yet it isn't completely dark. For just a moment near dawn and dusk each day, the illumination on Earth matches that of high noon on Pluto. We call this Pluto Time. If you go outside at this time on a clear day, the world around you will be as bright as the brightest part of the day on Pluto.

This app finds that moment for any location, plus a live "how bright is it right now, relative to Pluto noon" readout. It's a fully static, client-only site — no backend, nothing to run except a browser.

## Stack

TypeScript (strict mode) + React + Vite + Tailwind CSS, deployed as a static build to Cloudflare Pages. No server, no API calls at runtime, no database.

## Why hand-rolled astronomy instead of a library

The core calculation — solar elevation angle for a given time/location, and finding when it crosses -1.5° below the horizon — is implemented from scratch in `src/lib/solarPosition.ts` and `src/lib/plutoTime.ts`, using the standard low-precision Meeus/NOAA solar position formulas.

We evaluated [`astronomy-engine`](https://github.com/cosinekitty/astronomy) first, since it ships a ready-made `SearchAltitude` root-finder and real Pluto ephemeris data. We didn't use it:

- It's ~42.5KB gzipped with no meaningful tree-shaking (it's one monolithic module covering every planet), against a hand-rolled implementation that's a few KB.
- Its headline advantage — real time-varying Pluto-Sun distance — doesn't actually matter here: Pluto's orbital period is 248 years, so its distance from the Sun is effectively constant on any timescale this app cares about. A fixed brightness constant is exactly as accurate as live ephemeris for this feature.
- It hadn't shipped a release in ~2.5 years at the time of evaluation.

We optimized for bundle weight over convenience. The tradeoff only works because the accuracy bar here (98%+, "a fun tool, not a scientific instrument") is comfortably cleared by low-precision formulas — an independent test suite validated the implementation against NOAA's own Solar Calculator across equator, both hemispheres, polar day/night, and non-UTC timezones, landing within 30 seconds of NOAA's reference values throughout.

## The brightness readout

The "% as bright as Pluto noon" number (`src/lib/brightness.ts`) is a piecewise clear-sky illuminance model — not a physically rigorous radiative transfer simulation. It's built from commonly-cited anchor illuminance values (daylight, civil/nautical/astronomical twilight, night sky) connected by smooth curves. Real-world brightness at a given sun angle can vary by one to two orders of magnitude from what it returns, driven by weather, moon phase, and light pollution — the app labels this clearly as illustrative rather than implying instrument-grade precision. The dawn/dusk *times* are precise; this number isn't, by design.

## Multi-agent build workflow

This project was partly used as an exercise in a minimal multi-agent workflow, with one hard rule: the agent that implemented the core algorithm (`solarPosition.ts`, `plutoTime.ts`, `brightness.ts`) was different from — and worked independently of — the agent that wrote the test suite (`*.test.ts`) validating it. The test agent sourced its own golden values (NOAA Solar Calculator + a second independent API) rather than trusting the implementation's own comments, and found one real bug (a boundary off-by-one in `brightness.ts`, since fixed) plus a soft cross-module tuning inconsistency (documented, not force-fit) — the kind of finding that's easy to miss when the same author writes both sides.

## Location data

Manual city search (the fallback when a user doesn't want to share browser geolocation) is powered by a bundled dataset, not a geocoding API — there's no key to leak and no rate limit to hit.

- **Source**: [GeoNames](https://www.geonames.org/) `cities15000` dump, filtered to the top 5,000 cities by population, trimmed to `{name, country, lat, lon, timezone}`. Coordinates are rounded to 3 decimal places (~111m precision) — plenty for a manual picker, and it shrinks the gzipped bundle meaningfully.
- **License**: CC BY 4.0. Attribution: location data © [GeoNames.org](https://www.geonames.org/), CC BY 4.0.
- **Size tradeoff**: the dataset is ~87KB gzipped for 5,000 cities, lazy-loaded as its own chunk only when a user opens city search (not part of the initial page load). An earlier target of ~40KB/2,000 cities was revisited once we measured actual sizes — 90-100KB is still negligible load time on any connection over a static host, and the wider coverage (fewer "my town isn't in the list" moments) matters more for the app's "intuitive" goal than the extra kilobytes cost.
- Regenerate with `node scripts/build-cities.mjs <path-to-cities15000.txt> <topN>` (see that file for where to download the source dump).

City search itself uses [Fuse.js](https://www.fusejs.io/) (~11KB gzipped) for typo-tolerant fuzzy matching, re-ranked to blend text-match quality with each city's population (the dataset is pre-sorted by population, so array position doubles as a cheap prominence signal) — this keeps well-known cities from being buried under obscure near-exact matches.

## Development

```bash
npm install
npm run dev       # local dev server
npm test          # run the test suite
npm run build     # type-check + production build
npm run deploy    # build + deploy to Cloudflare Pages (requires wrangler auth)
```
