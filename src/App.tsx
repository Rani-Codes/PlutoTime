import { useState } from 'react'
import { LocationPicker } from './components/LocationPicker'
import { PlutoTimeResults } from './components/PlutoTimeResults'
import type { Location } from './lib/location'

function App() {
  const [location, setLocation] = useState<Location | null>(null)

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-10 bg-slate-950 px-4 py-12 text-slate-100">
      <header className="text-center">
        <h1 className="text-3xl font-semibold">Pluto Time</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-400">
          The moment today when Earth's twilight is as dim as high noon on Pluto.
        </p>
      </header>

      {location ? (
        <PlutoTimeResults location={location} onChangeLocation={() => setLocation(null)} />
      ) : (
        <LocationPicker onSelect={setLocation} />
      )}
    </main>
  )
}

export default App
