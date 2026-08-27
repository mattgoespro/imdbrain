import { formatRuntime } from '../../../../shared/types'
import { RUNTIME_CEILING, RUNTIME_FLOOR, YEAR_CEILING, YEAR_FLOOR } from './constants'

function labelMinutes(minutes: number): string {
  if (minutes <= 0) return '0m'
  return formatRuntime(minutes) ?? `${minutes}m`
}

export function runtimeCaption(min: number | null, max: number | null): string {
  const low = min ?? RUNTIME_FLOOR
  const high = max ?? RUNTIME_CEILING
  if (low <= RUNTIME_FLOOR && high >= RUNTIME_CEILING) return '· any length'
  if (low <= RUNTIME_FLOOR) return `· up to ${labelMinutes(high)}`
  if (high >= RUNTIME_CEILING) return `· ${labelMinutes(low)}+`
  return `· ${labelMinutes(low)} – ${labelMinutes(high)}`
}

export function yearCaption(min: number | null, max: number | null): string {
  const low = min ?? YEAR_FLOOR
  const high = max ?? YEAR_CEILING
  if (low <= YEAR_FLOOR && high >= YEAR_CEILING) return '· any year'
  if (low === high) return `· ${low}`
  return `· ${low} – ${high}`
}
