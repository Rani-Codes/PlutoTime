import { useEffect } from 'react'
import { useGeolocation } from '../hooks/useGeolocation'
import { CitySearch } from './CitySearch'
import type { Location } from '../lib/location'

interface LocationPickerProps {
  onSelect: (location: Location) => void
}

export function LocationPicker({ onSelect }: LocationPickerProps) {
  const { state, request } = useGeolocation()

  useEffect(() => {
    if (state.status === 'success') onSelect(state.location)
  }, [state, onSelect])

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={request}
        disabled={state.status === 'loading'}
        className="rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {state.status === 'loading' ? 'Finding you…' : 'Use my location'}
      </button>
      {state.status === 'error' && <p className="text-sm text-amber-400">{state.message}</p>}
      <p className="text-sm text-slate-500">or</p>
      <CitySearch onSelect={onSelect} />
    </div>
  )
}
