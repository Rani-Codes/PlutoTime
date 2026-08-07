import { useEffect, useRef, useState } from 'react'
import { searchCities } from '../lib/citySearch'
import { locationFromCity } from '../lib/location'
import type { Location } from '../lib/location'

interface CitySearchProps {
  onSelect: (location: Location) => void
}

export function CitySearch({ onSelect }: CitySearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchCities>>>([])
  const requestId = useRef(0)

  useEffect(() => {
    const id = ++requestId.current
    searchCities(query).then((cities) => {
      // Guard against out-of-order responses from rapid typing.
      if (requestId.current === id) setResults(cities)
    })
  }, [query])

  return (
    <div className="w-full max-w-sm">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for your city…"
        aria-label="Search for your city"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-slate-100 placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-dusk-start/60 focus:bg-white/[0.07] focus:outline-none"
      />
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-space-900/90 backdrop-blur-md">
          {results.map((city) => (
            <li key={`${city.name}-${city.country}-${city.lat}-${city.lon}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(locationFromCity(city))
                  setQuery('')
                  setResults([])
                }}
                className="w-full px-4 py-2.5 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
              >
                {city.name}, <span className="text-slate-500">{city.country}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
