/** Formats a Date as a local time string in the given IANA timezone, e.g. "7:42 PM". */
export function formatLocalTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Formats a brightness ratio (1.0 == Pluto-noon brightness) as a whole
 * percentage, per the "no decimals" design decision — this feature is
 * explicitly illustrative, so implying more precision than a whole point
 * would overstate what the underlying model can actually back up. Values
 * under 1% collapse to "<1%" rather than "0%", since night-time ratios can
 * be several orders of magnitude below 1% and "0%" would misleadingly
 * suggest the model outputs exact zero.
 */
export function formatBrightnessPercent(ratio: number): string {
  const percent = ratio * 100
  if (percent < 1) return '<1%'
  return `${Math.round(percent)}%`
}
