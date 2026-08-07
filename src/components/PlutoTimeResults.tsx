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
    <div className="animate-fade-up flex w-full max-w-md flex-col items-center gap-8 text-center">
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm text-slate-300">{location.label}</p>
        <button
          type="button"
          onClick={onChangeLocation}
          className="text-xs text-slate-600 underline decoration-slate-700 underline-offset-2 transition-colors hover:text-slate-400"
        >
          change location
        </button>
      </div>

      <div className="grid w-full grid-cols-2 gap-4">
        <ResultCard label="Dawn" time={plutoTime?.morning ?? null} timeZone={location.tz} theme="dawn" />
        <ResultCard label="Dusk" time={plutoTime?.evening ?? null} timeZone={location.tz} theme="dusk" />
      </div>

      {brightnessRatio !== null && (
        <div className="relative w-full">
          <div className="animate-glow-pulse absolute -inset-1 rounded-2xl bg-gradient-to-r from-dawn-end via-dusk-start to-dusk-end opacity-20 blur-lg" />
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5 backdrop-blur-sm">
            <p className="bg-gradient-to-r from-dawn-start via-dawn-end to-dusk-start bg-clip-text text-4xl font-bold tabular-nums text-transparent">
              {formatBrightnessPercent(brightnessRatio)}
            </p>
            <p className="mt-1 text-sm text-slate-400">as bright as Pluto noon, right now</p>
            <p className="mt-4 max-w-xs mx-auto text-xs leading-relaxed text-slate-500">
              Illustrative estimate, not a light meter — real brightness can swing by one to two{' '}
              <em className="text-slate-400">orders of magnitude</em> (a factor of 10 to 100) from
              weather, moonlight, and light pollution. The dawn/dusk times above are precise; this
              number is a fun approximation.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({
  label,
  time,
  timeZone,
  theme,
}: {
  label: string
  time: Date | null
  timeZone: string
  theme: 'dawn' | 'dusk'
}) {
  const gradient = theme === 'dawn' ? 'from-dawn-start to-dawn-end' : 'from-dusk-start to-dusk-end'

  return (
    <div className="group relative rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 backdrop-blur-sm transition-colors hover:border-white/20">
      <div
        className={`mx-auto mb-2 flex size-7 items-center justify-center rounded-full bg-gradient-to-br ${gradient}`}
      >
        <SunGlyph />
      </div>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-100">
        {time ? formatLocalTime(time, timeZone) : '—'}
      </p>
      {!time && <p className="mt-1 text-xs text-slate-600">Doesn't occur today at this location</p>}
    </div>
  )
}

function SunGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-space-950" fill="none" aria-hidden="true">
      <circle cx="12" cy="14" r="4.5" fill="currentColor" />
      <path
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        d="M12 3.5v2.5M4.9 8.4l1.8 1.8M19.1 8.4l-1.8 1.8M2.5 14h2.5M19 14h2.5"
      />
    </svg>
  )
}
