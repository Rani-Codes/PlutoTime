/**
 * Estimates ambient sky illuminance from sun elevation and expresses it as a
 * ratio against Pluto-noon brightness.
 *
 * IMPORTANT: this is an illustrative clear-sky approximation, not a
 * physically rigorous atmospheric radiative transfer model. It's built from
 * commonly-cited anchor illuminance values (clear-sky daylight/twilight
 * photometry figures that recur across independent sources) connected by
 * smooth interpolation curves — it is not a simulation of scattering,
 * absorption, or airglow physics. Real-world illuminance at a given sun
 * elevation can easily vary by one to two orders of magnitude from what
 * this returns, driven by cloud cover, haze/pollution, moon phase and
 * position, snow/water surface reflection, and artificial light pollution.
 * Treat the output as a "roughly this ballpark, on a clear moonless night"
 * estimate for a fun UI feature, not a photometric instrument.
 */

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

// --- Anchor points -----------------------------------------------------
// Each constant below is a commonly-cited clear-sky illuminance figure
// (lux) at a specific sun elevation (degrees). Sourced from the kind of
// photometry tables that appear repeatedly across illumination-engineering
// references and twilight literature; treat each as "the right order of
// magnitude", not a measured constant.

/** Illuminance at the zenith (elevation 90°) on a clear day, lux. Commonly cited range is ~100,000-130,000 lux; we use the low end of that range. */
const ZENITH_ILLUMINANCE_LUX = 100_000

/**
 * Exponent "k" in E = ZENITH_ILLUMINANCE_LUX * sin(elevation)^k for the
 * daytime (0°-90°) segment. k=1 would be a purely linear falloff in
 * sin(elevation); k slightly above 1 pulls the near-horizon end of the
 * curve down faster, which better matches how quickly daylight illuminance
 * drops once the sun nears the horizon (increased atmospheric path length
 * scatters/absorbs a disproportionate share of direct light). Kept within
 * the 1.0-1.25 "sublinear-to-linear" band called out in this model's brief.
 */
const DAYTIME_FALLOFF_EXPONENT = 1.25

/** Illuminance right at the horizon (elevation 0°), lux — the anchor shared with the twilight segment's log-linear fit. */
const HORIZON_ILLUMINANCE_LUX = 400

/** Elevation (degrees) marking the end of civil twilight. */
const CIVIL_TWILIGHT_ELEVATION_DEGREES = -6
/** Illuminance at civil twilight's end, lux. */
const CIVIL_TWILIGHT_ILLUMINANCE_LUX = 3.4

/** Elevation (degrees) marking the end of nautical twilight. */
const NAUTICAL_TWILIGHT_ELEVATION_DEGREES = -12
/** Illuminance at nautical twilight's end, lux. */
const NAUTICAL_TWILIGHT_ILLUMINANCE_LUX = 0.008

/** Elevation (degrees) marking the end of astronomical twilight. */
const ASTRONOMICAL_TWILIGHT_ELEVATION_DEGREES = -18
/** Illuminance at astronomical twilight's end, lux. */
const ASTRONOMICAL_TWILIGHT_ILLUMINANCE_LUX = 0.0008

/**
 * Flat illuminance floor once the sun is more than 18° below the horizon
 * ("full night" — airglow and starlight dominate; the sun's contribution is
 * negligible). Picked from the middle of the commonly cited 0.0002-0.0008
 * lux clear moonless night range.
 */
const NIGHT_FLOOR_ILLUMINANCE_LUX = 0.0005

/**
 * Reference illuminance at noon on Pluto's surface, lux. Derived from
 * "Earth noon lux ÷ ~1600" (the inverse-square falloff from Pluto's ~40 AU
 * average distance from the Sun vs Earth's 1 AU: 40² = 1600), which lands
 * independent sources in a ~60-90 lux range; we use the midpoint.
 */
const PLUTO_NOON_ILLUMINANCE_LUX = 75

/**
 * Log-linear (i.e. exponential) interpolation between two anchor points.
 * Used for the twilight segments (0° to -18°), where illuminance is known
 * to fall off by a roughly constant *factor* per degree of solar depression
 * rather than a constant amount — the hallmark of an exponential process —
 * so interpolating linearly in log-space (equivalently, geometrically in
 * linear space) reproduces that shape while passing exactly through both
 * given anchors. This app fits each twilight sub-range (civil/nautical/
 * astronomical) as its own two-point exponential segment rather than one
 * single regression across all of 0°..-18°, because the real decay rate
 * measurably slows down past -12° (see ASTRONOMICAL_TWILIGHT_* comment
 * below) — a single log-linear fit across the whole range would badly
 * misrepresent both ends to compromise on the middle.
 */
function logLinearInterpolate(
  elevationDegrees: number,
  elevationA: number,
  valueA: number,
  elevationB: number,
  valueB: number,
): number {
  const t = (elevationDegrees - elevationA) / (elevationB - elevationA)
  return valueA * Math.pow(valueB / valueA, t)
}

/**
 * Estimates clear-sky ambient illuminance (lux) for a given sun elevation
 * (degrees, positive above horizon). Piecewise model:
 *
 *  - elevation > 0°: power-law falloff from zenith illuminance, driven by
 *    sin(elevation) — the standard first-order approximation for how
 *    direct + diffuse daylight illuminance scales with solar altitude.
 *  - 0° to -6° (civil) and -6° to -12° (nautical): each fit as its own
 *    exponential (log-linear) segment through the anchor points, since
 *    twilight brightness decays multiplicatively with depression angle.
 *  - -12° to -18° (astronomical): also log-linear, but through anchors that
 *    encode a visibly slower decay rate than the -6°..-12° segment — this
 *    matches real twilight photometry, where residual scattered sunlight
 *    has mostly given out by -12° and airglow/starlight (which don't decay
 *    with solar depression) start to dominate the sky background.
 *  - beyond -18°: flat floor (astronomical night — the sun's contribution
 *    is negligible next to airglow/starlight/zodiacal light).
 *
 * Note there is a small, intentional discontinuity right at elevation 0°:
 * the daytime power law mathematically goes to 0 as elevation -> 0
 * (sin(0) = 0), while the twilight fit is anchored to a physically-real
 * ~400 lux at the horizon. Blending those two curves smoothly would need a
 * more elaborate model than this feature warrants; the jump is on the order
 * of a few hundred lux, dwarfed by the 1-2 orders of magnitude of real-world
 * variance already disclaimed above.
 */
export function estimateIlluminanceLux(elevationDegrees: number): number {
  if (elevationDegrees > 0) {
    const sinElevation = Math.sin(toRadians(Math.min(elevationDegrees, 90)))
    return ZENITH_ILLUMINANCE_LUX * Math.pow(sinElevation, DAYTIME_FALLOFF_EXPONENT)
  }

  if (elevationDegrees > CIVIL_TWILIGHT_ELEVATION_DEGREES) {
    return logLinearInterpolate(
      elevationDegrees,
      0,
      HORIZON_ILLUMINANCE_LUX,
      CIVIL_TWILIGHT_ELEVATION_DEGREES,
      CIVIL_TWILIGHT_ILLUMINANCE_LUX,
    )
  }

  if (elevationDegrees > NAUTICAL_TWILIGHT_ELEVATION_DEGREES) {
    return logLinearInterpolate(
      elevationDegrees,
      CIVIL_TWILIGHT_ELEVATION_DEGREES,
      CIVIL_TWILIGHT_ILLUMINANCE_LUX,
      NAUTICAL_TWILIGHT_ELEVATION_DEGREES,
      NAUTICAL_TWILIGHT_ILLUMINANCE_LUX,
    )
  }

  if (elevationDegrees > ASTRONOMICAL_TWILIGHT_ELEVATION_DEGREES) {
    return logLinearInterpolate(
      elevationDegrees,
      NAUTICAL_TWILIGHT_ELEVATION_DEGREES,
      NAUTICAL_TWILIGHT_ILLUMINANCE_LUX,
      ASTRONOMICAL_TWILIGHT_ELEVATION_DEGREES,
      ASTRONOMICAL_TWILIGHT_ILLUMINANCE_LUX,
    )
  }

  return NIGHT_FLOOR_ILLUMINANCE_LUX
}

/**
 * Returns current estimated brightness as a ratio of Pluto-noon brightness
 * (1.0 == exactly Pluto-noon brightness, 8.0 == 8x / "800%" as bright).
 * Callers format this for display (e.g. `Math.round(ratio * 100)}%`).
 */
export function getBrightnessRatio(elevationDegrees: number): number {
  return estimateIlluminanceLux(elevationDegrees) / PLUTO_NOON_ILLUMINANCE_LUX
}
