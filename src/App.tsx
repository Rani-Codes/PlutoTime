import { useState } from 'react'
import { LocationPicker } from './components/LocationPicker'
import { PlutoTimeResults } from './components/PlutoTimeResults'
import type { Location } from './lib/location'

function App() {
  const [location, setLocation] = useState<Location | null>(null)

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-space-950 px-4 py-16 text-slate-100">
      <div className="starfield-far" />
      <div className="starfield-near" />
      <div className="horizon-glow" />

      <div className="relative z-10 flex w-full flex-col items-center gap-12">
        <header className="animate-fade-up text-center">
          <p className="font-mono text-xs font-medium tracking-[0.3em] text-slate-500 uppercase">
            Earth ↔ Pluto
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-cream sm:text-5xl">
            Pluto Time
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-balance text-slate-400">
            The moment today when Earth's twilight is as dim as high noon on Pluto.
          </p>
        </header>

        {location ? (
          <PlutoTimeResults location={location} onChangeLocation={() => setLocation(null)} />
        ) : (
          <LocationPicker onSelect={setLocation} />
        )}
      </div>
    </main>
  )
}

export default App
