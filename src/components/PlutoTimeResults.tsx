import { usePlutoTime } from '../hooks/usePlutoTime'
import { useLiveBrightness } from '../hooks/useLiveBrightness'
import { formatBrightnessPercent, formatLocalTime } from '../lib/format'
import type { Location } from '../lib/location'

interface PlutoTimeResultsProps {
  location: Location
  onChangeLocation: () => void
}

export function PlutoTimeResults({ location, onChangeLocation }: PlutoTimeResultsProps) {
  const plutoTime = usePlutoTime(location)
  const brightnessRatio = useLiveBrightness(location)

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
      <div>
        <p className="text-sm text-slate-400">{location.label}</p>
        <button
          type="button"
          onClick={onChangeLocation}
          className="text-xs text-slate-500 underline hover:text-slate-300"
        >
          change location
        </button>
      </div>

      <div className="grid w-full grid-cols-2 gap-4">
        <ResultCard label="Dawn" time={plutoTime?.morning ?? null} timeZone={location.tz} />
        <ResultCard label="Dusk" time={plutoTime?.evening ?? null} timeZone={location.tz} />
      </div>

      {brightnessRatio !== null && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-4">
          <p className="text-3xl font-semibold text-slate-100">
            {formatBrightnessPercent(brightnessRatio)}
          </p>
          <p className="text-sm text-slate-400">as bright as Pluto noon, right now</p>
          <p className="mt-3 max-w-xs text-xs text-slate-500">
            Illustrative estimate, not a light meter — real brightness can swing by one to two{' '}
            <em>orders of magnitude</em> (a factor of 10 to 100) from weather, moonlight, and light
            pollution. The dawn/dusk times above are precise; this number is a fun approximation.
          </p>
        </div>
      )}
    </div>
  )
}

function ResultCard({ label, time, timeZone }: { label: string; time: Date | null; timeZone: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-100">
        {time ? formatLocalTime(time, timeZone) : '—'}
      </p>
      {!time && <p className="mt-1 text-xs text-slate-500">Doesn't occur today at this location</p>}
    </div>
  )
}
