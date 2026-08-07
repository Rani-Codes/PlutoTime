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
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 placeholder-slate-500 focus:border-slate-400 focus:outline-none"
      />
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-900">
          {results.map((city) => (
            <li key={`${city.name}-${city.country}-${city.lat}-${city.lon}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(locationFromCity(city))
                  setQuery('')
                  setResults([])
                }}
                className="w-full px-4 py-2 text-left text-slate-200 hover:bg-slate-800"
              >
                {city.name}, {city.country}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
