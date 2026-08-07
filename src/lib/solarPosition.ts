/**
 * Hand-rolled, dependency-free solar position calculation.
 *
 * We deliberately do NOT pull in an astronomy library (e.g. astronomy-engine)
 * for this app. Pluto Time only needs the SUN's position — Pluto itself never
 * enters the geometry, its orbit is only used once, elsewhere, to derive a
 * constant reference brightness. A full ephemeris library is unjustified
 * bundle weight for that.
 *
 * The algorithm below is the standard low-precision solar position formula
 * documented by Jean Meeus ("Astronomical Algorithms", ch. 25, low-accuracy
 * variant) and used, in essentially the same form, by the NOAA Solar
 * Calculator and by SunCalc.js. It ignores nutation, aberration, and
 * higher-order perturbation terms, which cost accuracy in the arcsecond
 * range — far below what a "sun is around -1.5°" feature needs. Documented
 * accuracy for this family of formulas is sub-arcminute in position, i.e.
 * well inside the 98%+ accuracy target for this app.
 *
 * Atmospheric refraction is intentionally NOT applied: this function returns
 * the sun's true geometric elevation. Pluto Time write-ups define the -1.5°
 * threshold in terms of the geometric sun position, so adding a refraction
 * correction here would silently change what "-1.5°" means relative to the
 * sources this app's constant is based on.
 */

const MILLISECONDS_PER_DAY = 86_400_000
// Julian Day of the Unix epoch (1970-01-01T00:00:00Z). Converting via Unix
// time avoids re-implementing Gregorian calendar-to-Julian-day arithmetic by
// hand, which is a common source of off-by-one-day bugs.
const JULIAN_DAY_UNIX_EPOCH = 2_440_587.5
// A Julian century is exactly 36525 Julian days by definition.
const JULIAN_DAYS_PER_CENTURY = 36_525
// Julian Day of the J2000.0 reference epoch (2000-01-01T12:00:00Z), the zero
// point every term below is measured from.
const JULIAN_DAY_J2000 = 2_451_545.0

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

/** Wraps an angle in degrees into the [0, 360) range. */
function normalizeDegrees(degrees: number): number {
  const wrapped = degrees % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

function getJulianDay(date: Date): number {
  return date.getTime() / MILLISECONDS_PER_DAY + JULIAN_DAY_UNIX_EPOCH
}

/** Julian centuries elapsed since J2000.0 — the time variable "T" in Meeus. */
function getJulianCentury(julianDay: number): number {
  return (julianDay - JULIAN_DAY_J2000) / JULIAN_DAYS_PER_CENTURY
}

/** Sun's mean geometric longitude (degrees), Meeus eq. 25.2. */
function getGeometricMeanLongitude(t: number): number {
  return normalizeDegrees(280.46646 + t * (36000.76983 + t * 0.0003032))
}

/** Sun's mean anomaly (degrees), Meeus eq. 25.3. */
function getMeanAnomaly(t: number): number {
  return 357.52911 + t * (35999.05029 - 0.0001537 * t)
}

/** Eccentricity of Earth's orbit (dimensionless), Meeus eq. 25.4. */
function getEarthOrbitEccentricity(t: number): number {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
}

/**
 * The "equation of center" (degrees): the correction added to the mean
 * anomaly/longitude to account for Earth's elliptical (non-circular) orbit.
 */
function getEquationOfCenter(t: number, meanAnomalyDegrees: number): number {
  const m = toRadians(meanAnomalyDegrees)
  return (
    Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m) * 0.000289
  )
}

/** Sun's apparent longitude (degrees), corrected for nutation/aberration approximation. */
function getApparentLongitude(t: number, trueLongitudeDegrees: number): number {
  const omega = toRadians(125.04 - 1934.136 * t)
  return trueLongitudeDegrees - 0.00569 - 0.00478 * Math.sin(omega)
}

/** Mean obliquity of the ecliptic (degrees), Meeus eq. 22.2. */
function getMeanObliquityOfEcliptic(t: number): number {
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))
  return 23 + (26 + seconds / 60) / 60
}

/** Obliquity corrected for the same nutation approximation as apparent longitude. */
function getCorrectedObliquity(t: number, meanObliquityDegrees: number): number {
  const omega = toRadians(125.04 - 1934.136 * t)
  return meanObliquityDegrees + 0.00256 * Math.cos(omega)
}

/** Sun's declination (degrees) — how far north/south of the celestial equator it sits. */
function getSolarDeclination(obliquityDegrees: number, apparentLongitudeDegrees: number): number {
  const epsilon = toRadians(obliquityDegrees)
  const lambda = toRadians(apparentLongitudeDegrees)
  return toDegrees(Math.asin(Math.sin(epsilon) * Math.sin(lambda)))
}

/**
 * Equation of time (minutes): the gap between apparent solar time and mean
 * (clock) solar time, caused by orbital eccentricity + axial tilt. Needed to
 * convert a UTC clock time into the sun's true hour angle. Meeus eq. 28.3 /
 * NOAA formulation.
 */
function getEquationOfTimeMinutes(
  meanLongitudeDegrees: number,
  meanAnomalyDegrees: number,
  eccentricity: number,
  obliquityDegrees: number,
): number {
  const epsilon = toRadians(obliquityDegrees)
  const y = Math.tan(epsilon / 2) ** 2
  const l0 = toRadians(meanLongitudeDegrees)
  const m = toRadians(meanAnomalyDegrees)

  const eqTimeRadians =
    y * Math.sin(2 * l0) -
    2 * eccentricity * Math.sin(m) +
    4 * eccentricity * y * Math.sin(m) * Math.cos(2 * l0) -
    0.5 * y * y * Math.sin(4 * l0) -
    1.25 * eccentricity * eccentricity * Math.sin(2 * m)

  return 4 * toDegrees(eqTimeRadians)
}

/**
 * Returns the sun's elevation angle in degrees for a given UTC instant and
 * location. Positive = above the horizon, negative = below.
 *
 * @param date UTC instant to evaluate (any Date is read via its absolute
 *   timestamp — `date.getTime()` — so its own timezone representation
 *   doesn't matter).
 * @param latitude degrees, positive north, range [-90, 90].
 * @param longitude degrees, positive east, range [-180, 180].
 */
export function getSolarElevation(date: Date, latitude: number, longitude: number): number {
  const julianDay = getJulianDay(date)
  const t = getJulianCentury(julianDay)

  const meanLongitude = getGeometricMeanLongitude(t)
  const meanAnomaly = getMeanAnomaly(t)
  const eccentricity = getEarthOrbitEccentricity(t)
  const equationOfCenter = getEquationOfCenter(t, meanAnomaly)

  const trueLongitude = meanLongitude + equationOfCenter
  const apparentLongitude = getApparentLongitude(t, trueLongitude)

  const meanObliquity = getMeanObliquityOfEcliptic(t)
  const correctedObliquity = getCorrectedObliquity(t, meanObliquity)

  const declination = getSolarDeclination(correctedObliquity, apparentLongitude)
  const equationOfTimeMinutes = getEquationOfTimeMinutes(
    meanLongitude,
    meanAnomaly,
    eccentricity,
    correctedObliquity,
  )

  // Minutes elapsed since UTC midnight for the given instant. The double
  // modulo handles negative `% ` results for timestamps before 1970.
  const msSinceUtcMidnight =
    ((date.getTime() % MILLISECONDS_PER_DAY) + MILLISECONDS_PER_DAY) % MILLISECONDS_PER_DAY
  const utcMinutesSinceMidnight = msSinceUtcMidnight / 60_000

  // True solar time (minutes past local apparent midnight), NOAA formulation.
  // Longitude is added directly (4 minutes of time per degree of longitude)
  // because we work entirely in UTC — there is no local clock/timezone
  // offset term to subtract, unlike the NOAA spreadsheet which is anchored
  // to a local clock.
  let trueSolarTimeMinutes = utcMinutesSinceMidnight + equationOfTimeMinutes + 4 * longitude
  trueSolarTimeMinutes = ((trueSolarTimeMinutes % 1440) + 1440) % 1440

  // Hour angle: 0° at solar noon, -180°..180° across the day, 15°/hour.
  const hourAngleDegrees = trueSolarTimeMinutes / 4 - 180

  const latRad = toRadians(latitude)
  const declRad = toRadians(declination)
  const hourAngleRad = toRadians(hourAngleDegrees)

  const sinElevation =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad)

  // Clamp before asin: floating-point error can push the value a hair
  // outside [-1, 1] (e.g. 1.0000000000000002), which would otherwise make
  // asin return NaN.
  const clamped = Math.min(1, Math.max(-1, sinElevation))

  return toDegrees(Math.asin(clamped))
}
