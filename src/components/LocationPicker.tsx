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
    <div
      className="animate-fade-up flex flex-col items-center gap-5"
      style={{ animationDelay: '120ms' }}
    >
      <button
        type="button"
        onClick={request}
        disabled={state.status === 'loading'}
        className="rounded-lg bg-[#309be6] px-6 py-3 font-semibold text-space-950 shadow-lg shadow-black/40 transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:hover:brightness-100"
      >
        {state.status === 'loading' ? 'Finding you…' : 'Use my location'}
      </button>
      {state.status === 'error' && <p className="max-w-xs text-center text-sm text-alert">{state.message}</p>}

      <div className="flex w-full max-w-sm items-center gap-3 text-xs text-slate-600">
        <div className="h-px flex-1 bg-slate-800" />
        or
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <CitySearch onSelect={onSelect} />
    </div>
  )
}
