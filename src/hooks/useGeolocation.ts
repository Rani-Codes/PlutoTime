import { useCallback, useState } from 'react'
import { locationFromCoords, type Location } from '../lib/location'

type GeolocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; location: Location }
  | { status: 'error'; message: string }

function messageForError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location access was denied. Search for your city instead.'
    case error.POSITION_UNAVAILABLE:
      return "Your location couldn't be determined. Search for your city instead."
    case error.TIMEOUT:
      return 'Location request timed out. Search for your city instead.'
    default:
      return 'Something went wrong finding your location. Search for your city instead.'
  }
}

/** Wraps the browser Geolocation API as an explicit request/response hook — no auto-prompt on mount, since permission prompts should follow a deliberate user action. */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({ status: 'idle' })

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({
        status: 'error',
        message: "This browser doesn't support location access. Search for your city instead.",
      })
      return
    }

    setState({ status: 'loading' })
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: 'success',
          location: locationFromCoords(position.coords.latitude, position.coords.longitude),
        })
      },
      (error) => {
        setState({ status: 'error', message: messageForError(error) })
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }, [])

  return { state, request }
}
